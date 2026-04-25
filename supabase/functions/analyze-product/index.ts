/**
 * Supabase Edge Function: analyze-product
 *
 * POST  /functions/v1/analyze-product
 * Body: { barcode: string, frontImage: string (base64), labelImage: string (base64) }
 *
 * Flow:
 *  1. Try Gemini 2.0 Flash (free tier primary)
 *  2. If Gemini fails / returns invalid JSON → fall back to GPT-4o mini
 *  3. Upload both images to Supabase Storage → product-images/{barcode}/
 *  4. Log to ai_fallback_logs
 *  5. Return unified JSON: product data + image_front_url + image_label_url
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  barcode: string;
  frontImage: string;  // base64 data-URL or raw base64
  labelImage: string;  // base64 data-URL or raw base64
  userId?: string;     // optional – for logging
}

interface NutritionFacts {
  calories: string | null;
  fat: string | null;
  protein: string | null;
  carbohydrates: string | null;
  serving_size: string | null;
  sodium: string | null;
  sugar: string | null;
  fiber: string | null;
}

export interface AIProductResult {
  product_name: string | null;
  brand: string | null;
  ingredients: string[];
  nutrition_facts: NutritionFacts;
  net_weight: string | null;
  category: 'food' | 'personal_care' | 'household' | null;
  allergens_present: string[];
  image_front_url: string | null;
  image_label_url: string | null;
  model_used: 'gemini-2.0-flash' | 'gpt-4o-mini';
  latency_ms: number;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a product information extraction system. Analyze the provided product images (front packaging and nutrition/ingredient label). Return ONLY a JSON object — no markdown, no extra text.

Required JSON keys:
- "product_name": string (the full product name as printed on the package)
- "brand": string (brand/manufacturer name)
- "ingredients": array of strings (each individual ingredient, preserving order from the label)
- "nutrition_facts": object with keys:
    "calories", "fat", "protein", "carbohydrates", "sodium", "sugar", "fiber", "serving_size"
    (values as strings like "240 kcal", "5g", null if not visible)
- "net_weight": string | null (e.g. "500g", "16 oz", null if not visible)
- "category": "food" | "personal_care" | "household" | null
- "allergens_present": array of strings (allergens explicitly listed on the label, e.g. ["milk","wheat","soy"])

If any field cannot be determined from the images, set its value to null (or [] for arrays).
Return ONLY the JSON object. No explanation. No markdown code fences.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip data-URL prefix if present → returns raw base64 string */
function toRawBase64(input: string): { data: string; mimeType: string } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) return { data: match[2], mimeType: match[1] };
  return { data: input, mimeType: 'image/jpeg' };
}

/** Parse first JSON object from a string (handles extra text around it) */
function parseFirstJson(text: string): AIProductResult | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as AIProductResult;
  } catch {
    return null;
  }
}

// ─── Gemini 2.0 Flash ─────────────────────────────────────────────────────────

async function callGemini(
  frontBase64: string,
  frontMime: string,
  labelBase64: string,
  labelMime: string,
  apiKey: string,
): Promise<AIProductResult> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
    apiKey;

  const body = {
    contents: [
      {
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inline_data: { mime_type: frontMime, data: frontBase64 },
          },
          {
            inline_data: { mime_type: labelMime, data: labelBase64 },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1500,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000); // 20 s
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseFirstJson(text);
    if (!parsed) throw new Error('Gemini returned non-JSON: ' + text.slice(0, 300));
    return { ...parsed, model_used: 'gemini-2.0-flash', latency_ms: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── GPT-4o mini ──────────────────────────────────────────────────────────────

async function callGPT(
  frontBase64: string,
  frontMime: string,
  labelBase64: string,
  labelMime: string,
  apiKey: string,
): Promise<AIProductResult> {
  const body = {
    model: 'gpt-4o-mini',
    max_tokens: 1500,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${frontMime};base64,${frontBase64}`, detail: 'low' },
          },
          {
            type: 'image_url',
            image_url: { url: `data:${labelMime};base64,${labelBase64}`, detail: 'high' },
          },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000); // 25 s
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`GPT HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? '';
    const parsed = parseFirstJson(text);
    if (!parsed) throw new Error('GPT returned non-JSON: ' + text.slice(0, 300));
    return { ...parsed, model_used: 'gpt-4o-mini', latency_ms: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Image upload ─────────────────────────────────────────────────────────────

async function uploadImage(
  adminClient: ReturnType<typeof createClient>,
  barcode: string,
  slot: 'front' | 'label',
  base64: string,
  mimeType: string,
): Promise<string | null> {
  try {
    // Ensure bucket exists (noop if already there)
    await adminClient.storage
      .createBucket('product-images', { public: true })
      .catch(() => undefined);

    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const path = `${barcode}/${slot}.${ext}`;

    // Decode base64 → Uint8Array
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const { error } = await adminClient.storage
      .from('product-images')
      .upload(path, bytes, { contentType: mimeType, upsert: true });

    if (error) return null;

    const { data } = adminClient.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

// ─── Edge Function handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startMs = Date.now();

  try {
    // ── Parse body ──────────────────────────────────────────────────────────
    const body = (await req.json()) as Partial<RequestBody>;
    const { barcode, frontImage, labelImage, userId } = body;

    if (!barcode || !frontImage || !labelImage) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: barcode, frontImage, labelImage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Env vars ────────────────────────────────────────────────────────────
    const GEMINI_API_KEY  = Deno.env.get('GEMINI_API_KEY')  ?? '';
    const OPENAI_API_KEY  = Deno.env.get('OPENAI_API_KEY')  ?? '';
    const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')    ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: frontData, mimeType: frontMime } = toRawBase64(frontImage);
    const { data: labelData, mimeType: labelMime } = toRawBase64(labelImage);

    // ── AI extraction with Gemini → GPT failover ────────────────────────────
    let result: AIProductResult | null = null;
    let fallbackTriggered = false;
    let aiError: string | null = null;

    if (GEMINI_API_KEY) {
      try {
        result = await callGemini(frontData, frontMime, labelData, labelMime, GEMINI_API_KEY);
      } catch (e) {
        aiError = e instanceof Error ? e.message : String(e);
        console.warn('[analyze-product] Gemini failed:', aiError);
      }
    }

    if (!result && OPENAI_API_KEY) {
      fallbackTriggered = true;
      try {
        result = await callGPT(frontData, frontMime, labelData, labelMime, OPENAI_API_KEY);
      } catch (e) {
        const gptErr = e instanceof Error ? e.message : String(e);
        console.error('[analyze-product] GPT also failed:', gptErr);
        aiError = (aiError ? aiError + ' | GPT: ' : 'GPT: ') + gptErr;
      }
    }

    if (!result) {
      // Both AI providers failed
      await adminClient.from('ai_fallback_logs').insert({
        barcode,
        user_id: userId ?? null,
        model_used: fallbackTriggered ? 'gpt-4o-mini' : 'gemini-2.0-flash',
        success: false,
        latency_ms: Date.now() - startMs,
        fallback_triggered: fallbackTriggered,
        error_message: aiError,
      }).then(() => undefined);

      return new Response(
        JSON.stringify({
          error: 'AI analysis unavailable. Both providers failed.',
          detail: aiError,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Upload images to Supabase Storage ───────────────────────────────────
    const [frontUrl, labelUrl] = await Promise.all([
      uploadImage(adminClient, barcode, 'front', frontData, frontMime),
      uploadImage(adminClient, barcode, 'label', labelData, labelMime),
    ]);

    result.image_front_url = frontUrl;
    result.image_label_url = labelUrl;
    result.latency_ms = Date.now() - startMs;

    // ── Log to ai_fallback_logs ─────────────────────────────────────────────
    await adminClient.from('ai_fallback_logs').insert({
      barcode,
      user_id: userId ?? null,
      model_used: result.model_used,
      success: true,
      latency_ms: result.latency_ms,
      fallback_triggered: fallbackTriggered,
    }).then(() => undefined);

    // ── Upsert to products cache ────────────────────────────────────────────
    await adminClient.from('products').upsert({
      barcode,
      product_name: result.product_name,
      brand: result.brand,
      ingredients: result.ingredients ?? [],
      nutrition_facts: result.nutrition_facts ?? {},
      source: result.model_used,
      category: result.category ?? null,
      image_front_url: frontUrl,
      image_label_url: labelUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'barcode' }).then(() => undefined);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[analyze-product] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
