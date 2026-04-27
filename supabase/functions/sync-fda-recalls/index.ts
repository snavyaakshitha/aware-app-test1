/**
 * Supabase Edge Function: sync-fda-recalls
 *
 * Fetches FDA Class I & II food/cosmetic enforcement recalls and upserts
 * them into banned_products_worldwide. Designed to run daily via pg_cron.
 *
 * POST /functions/v1/sync-fda-recalls
 * Auth: service_role key required (called internally only)
 *
 * FDA API: https://api.fda.gov/food/enforcement.json
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const FDA_API_BASE = 'https://api.fda.gov/food/enforcement.json';
const BATCH_SIZE = 100;
const MAX_PAGES = 5; // 500 records max per run (FDA free tier limit)

interface FDARecall {
  product_description: string;
  recalling_firm: string;
  reason_for_recall: string;
  recall_initiation_date: string;
  voluntary_mandated: string;
  product_type: string;
  classification: string;
  status: string;
}

interface BannedProduct {
  product_name: string;
  brand_name: string;
  countries_banned: string[];
  ban_reason: string;
  recall_link: string;
  ban_date: string | null;
  recall_type: string;
  category: string;
  status: string;
}

function detectCategory(productDesc: string, brandName: string, productType: string): string {
  const d = productDesc.toLowerCase();
  const b = brandName.toLowerCase();
  const p = productType.toLowerCase();

  if (p === 'drugs') return 'pharma';
  if (p === 'cosmetics') return 'cosmetics';
  if (p === 'devices') return 'household';

  const supplementKeywords = ['supplement', 'capsule', 'tablet', 'softgel', 'protein powder', 'probiotic', 'vitamin ', 'dietary supplement', 'herbal'];
  if (supplementKeywords.some(k => d.includes(k))) return 'supplement';

  const cosmeticKeywords = ['lipstick', 'mascara', 'foundation', 'face wash', 'body wash', 'moisturizer', 'sunscreen', 'shampoo', 'conditioner', 'lotion', 'serum', 'toner', 'blush', 'eyeshadow'];
  if (cosmeticKeywords.some(k => d.includes(k) || b.includes(k))) return 'cosmetics';

  const householdKeywords = ['hand sanitizer', 'sanitiser', 'disinfect', 'cleaning spray', 'laundry', 'bleach', 'detergent'];
  if (householdKeywords.some(k => d.includes(k))) return 'household';

  return 'food';
}

function parseDate(raw: string): string | null {
  if (!raw || raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\n/g, ' ').trim().slice(0, maxLen);
}

async function fetchFDAPage(skip: number): Promise<{ results: FDARecall[]; total: number }> {
  const search = 'status:Ongoing+AND+(classification:%22Class+I%22+OR+classification:%22Class+II%22)';
  const url = `${FDA_API_BASE}?search=${search}&limit=${BATCH_SIZE}&skip=${skip}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'AwareApp/1.0 (sync-fda-recalls; contact: safety@aware.app)' },
  });
  if (!resp.ok) {
    throw new Error(`FDA API error: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  return {
    results: data.results ?? [],
    total: data.meta?.results?.total ?? 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST with service_role key (or from pg_cron via internal call)
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader?.includes(serviceKey.slice(-20))) {
    // Also allow calls with explicit API key from pg_cron / cron trigger
    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    if (!cronSecret || !authHeader?.includes(cronSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const stats = { fetched: 0, inserted: 0, skipped: 0, errors: 0 };

  try {
    // First call to get total count
    const firstPage = await fetchFDAPage(0);
    const total = Math.min(firstPage.total, MAX_PAGES * BATCH_SIZE);
    console.log(`FDA API: ${firstPage.total} total recalls, processing up to ${total}`);

    const allRecalls: FDARecall[] = [...firstPage.results];

    // Fetch remaining pages
    for (let skip = BATCH_SIZE; skip < total; skip += BATCH_SIZE) {
      await new Promise(r => setTimeout(r, 300)); // Rate limit: 300ms between requests
      const page = await fetchFDAPage(skip);
      allRecalls.push(...page.results);
    }

    stats.fetched = allRecalls.length;

    // Transform to BannedProduct rows
    const rows: BannedProduct[] = allRecalls.map(r => {
      const isVoluntary = !r.voluntary_mandated?.includes('Mandated');
      return {
        product_name: truncate(r.product_description ?? '', 300),
        brand_name: truncate(r.recalling_firm ?? 'Unknown', 150),
        countries_banned: ['US'],
        ban_reason: truncate(r.reason_for_recall ?? '', 500),
        recall_link: 'https://www.accessdata.fda.gov/scripts/ires/index.cfm',
        ban_date: parseDate(r.recall_initiation_date ?? ''),
        recall_type: isVoluntary ? 'voluntary_withdrawal' : 'safety_recall',
        category: detectCategory(r.product_description ?? '', r.recalling_firm ?? '', r.product_type ?? ''),
        status: 'active',
      };
    }).filter(r => r.product_name.length > 0);

    // Upsert in chunks of 50
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('banned_products_worldwide')
        .upsert(chunk, {
          onConflict: 'product_name,brand_name,ban_date',
          ignoreDuplicates: true,
        });

      if (error) {
        console.error(`Upsert error at chunk ${i}:`, error.message);
        stats.errors++;
      } else {
        stats.inserted += chunk.length;
      }
    }

    // Log the sync run
    await supabase.from('scan_logs').insert({
      event_type: 'fda_recall_sync',
      metadata: {
        ...stats,
        source: 'FDA Enforcement API',
        run_at: new Date().toISOString(),
      },
    }).then(() => {});

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('sync-fda-recalls error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
