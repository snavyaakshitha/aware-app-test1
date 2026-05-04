/**
 * seed-usda-products — Edge Function
 *
 * Seeds `cached_products` with popular US branded food products from USDA FoodData Central.
 * Call this once (or on a schedule) to pre-cache common barcodes so scans are instant.
 *
 * POST /functions/v1/seed-usda-products
 * Body: { page?: number; pageSize?: number; dataType?: string }
 *
 * Uses EXPO_PUBLIC_USDA_API_KEY env var (falls back to DEMO_KEY).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

interface UsdaSearchFood {
  fdcId: number;
  gtinUpc?: string;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  ingredients?: string;
}

interface UsdaDetailFood {
  fdcId?: number;
  description?: string;
  ingredients?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('EXPO_PUBLIC_USDA_API_KEY') ?? 'DEMO_KEY';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.headers.get('content-type')?.includes('application/json')
      ? await req.json().catch(() => ({}))
      : {};

    const page = Number(body?.page ?? 1);
    const pageSize = Math.min(Number(body?.pageSize ?? 200), 200);

    // Fetch popular branded foods from USDA (sorted by fdcId for consistency)
    const searchUrl =
      `${USDA_BASE}/foods/list?api_key=${encodeURIComponent(apiKey)}` +
      `&dataType=Branded&pageSize=${pageSize}&pageNumber=${page}` +
      `&sortBy=fdcId&sortOrder=asc`;

    const sRes = await fetch(searchUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'Aware/1.0 (seed-usda-products)' },
    });

    if (!sRes.ok) {
      return new Response(
        JSON.stringify({ error: `USDA API error: ${sRes.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const foods = (await sRes.json()) as UsdaSearchFood[];

    if (!Array.isArray(foods) || foods.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, message: 'No foods returned by USDA' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Filter to foods that have a GTIN/UPC barcode
    const withBarcode = foods.filter((f) => f.gtinUpc?.trim());

    // Build upsert rows
    const rows = withBarcode
      .filter((f) => {
        const ing = String(f.ingredients ?? '').trim();
        return ing.length > 5; // skip products with no ingredient text
      })
      .map((f) => ({
        barcode: f.gtinUpc!.trim(),
        product_name: String(f.description ?? 'Unknown product').trim(),
        brand: String(f.brandOwner ?? f.brandName ?? 'Unknown brand').trim(),
        ingredients: String(f.ingredients ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        source: 'usda_fdc',
        category: 'food',
        nutrition_facts: null,
        image_front_url: null,
        image_label_url: null,
        created_at: new Date().toISOString(),
      }));

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, message: 'No rows with ingredient text to insert' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error, count } = await supabase
      .from('cached_products')
      .upsert(rows, { onConflict: 'barcode', ignoreDuplicates: false })
      .select('barcode', { count: 'exact', head: true });

    if (error) {
      console.error('[seed-usda] upsert error:', error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        fetched: foods.length,
        withBarcode: withBarcode.length,
        inserted: count ?? rows.length,
        page,
        pageSize,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
