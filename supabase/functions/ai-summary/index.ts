/**
 * Supabase Edge Function: ai-summary
 *
 * POST /functions/v1/ai-summary
 * Body: { barcode, userId?, productName, ingredientsText, healthConditions }
 *
 * Returns: { summary: string } — a 1-2 sentence personalized product insight.
 * Caches results in ai_summary_cache; same barcode+conditions combo hits cache.
 *
 * Provider order: Gemini 2.0 Flash → GPT-4o mini fallback.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  barcode: string;
  userId: string | null;
  productName: string;
  ingredientsText: string;
  healthConditions: string[];
}

function buildPrompt(
  productName: string,
  ingredientsText: string,
  healthConditions: string[],
): string {
  const conditionPhrase =
    healthConditions.length > 0
      ? `The person has: ${healthConditions.join(', ')}.`
      : 'No specific health conditions provided.';

  return (
    `You are a concise nutritional analyst. Give a 1-2 sentence health insight about this product for this specific person.\n\n` +
    `Product: ${productName}\n` +
    `Ingredients (first 600 chars): ${ingredientsText}\n` +
    `${conditionPhrase}\n\n` +
    `Rules:\n` +
    `- Maximum 2 sentences. No bullet points.\n` +
    `- Be specific: name the concerning or beneficial ingredient if relevant.\n` +
    `- If conditions are present, address them directly.\n` +
    `- If no obvious concern, say something genuinely useful about the nutrition or processing level.\n` +
    `- Do NOT start with "This product" or restate the product name.\n` +
    `- Do NOT say "Unable to generate" unless the product data is completely blank.\n` +
    `- Plain text only. No markdown.`
  );
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
    apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 120 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('Gemini returned empty text');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGPT(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 120,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`GPT HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new Error('GPT returned empty text');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startMs = Date.now();

  try {
    const body = (await req.json()) as Partial<RequestBody>;
    const { barcode, userId, productName, ingredientsText, healthConditions } = body;

    if (!barcode || !productName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: barcode, productName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const GEMINI_API_KEY     = Deno.env.get('GEMINI_API_KEY')            ?? '';
    const OPENAI_API_KEY     = Deno.env.get('OPENAI_API_KEY')            ?? '';
    const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')              ?? '';
    const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Build a stable cache key: barcode + sorted conditions
    const sortedConditions = [...(healthConditions ?? [])].sort();
    const cacheKey = `${barcode}::${sortedConditions.join(',')}`;

    // Check cache (TTL: 7 days — summaries don't change)
    const { data: cached } = await adminClient
      .from('ai_summary_cache')
      .select('summary')
      .eq('cache_key', cacheKey)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (cached?.summary) {
      return new Response(
        JSON.stringify({ summary: cached.summary }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const prompt = buildPrompt(
      productName ?? 'Unknown product',
      (ingredientsText ?? '').slice(0, 600),
      healthConditions ?? [],
    );

    let summary: string | null = null;
    let providerUsed = 'none';

    if (GEMINI_API_KEY) {
      try {
        summary = await callGemini(prompt, GEMINI_API_KEY);
        providerUsed = 'gemini-2.0-flash';
      } catch (e) {
        console.warn('[ai-summary] Gemini failed:', e instanceof Error ? e.message : e);
      }
    }

    if (!summary && OPENAI_API_KEY) {
      try {
        summary = await callGPT(prompt, OPENAI_API_KEY);
        providerUsed = 'gpt-4o-mini';
      } catch (e) {
        console.error('[ai-summary] GPT also failed:', e instanceof Error ? e.message : e);
      }
    }

    if (!summary) {
      return new Response(
        JSON.stringify({ error: 'Unable to generate summary — both AI providers failed.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Persist to cache (non-blocking)
    void adminClient.from('ai_summary_cache').upsert({
      cache_key:   cacheKey,
      barcode,
      user_id:     userId ?? null,
      summary,
      provider:    providerUsed,
      latency_ms:  Date.now() - startMs,
      created_at:  new Date().toISOString(),
    }, { onConflict: 'cache_key' });

    return new Response(
      JSON.stringify({ summary }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[ai-summary] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
