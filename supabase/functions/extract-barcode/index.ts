/**
 * Supabase Edge Function: extract-barcode
 *
 * POST /functions/v1/extract-barcode
 * Body: { image: string (base64 data-URL or raw base64) }
 *
 * Uses Gemini 2.0 Flash to read a barcode from a product photo.
 * Returns: { barcode: string | null }
 */

import { corsHeaders } from '../_shared/cors.ts';

function toRawBase64(input: string): { data: string; mimeType: string } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) return { data: match[2], mimeType: match[1] };
  return { data: input, mimeType: 'image/jpeg' };
}

const PROMPT =
  'This is a photo of a retail product. Find any barcode visible in the image ' +
  '(EAN-13, UPC-A, UPC-E, EAN-8, Code128, QR code, etc.). ' +
  'Return ONLY the barcode value as a plain string \u2014 digits only for numeric barcodes, ' +
  'alphanumeric for Code128. No spaces, no explanation, no punctuation. ' +
  'If no barcode is clearly visible, return the single word: null';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as { image?: string };
    if (!body.image) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Gemini not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data, mimeType } = toRawBase64(body.image);

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      GEMINI_API_KEY;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let rawText = '';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType, data } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 64 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      rawText = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    } finally {
      clearTimeout(timeout);
    }

    // Sanitize: keep only digits/letters/hyphens; reject "null"
    const cleaned = rawText.replace(/\s+/g, '').replace(/[^a-zA-Z0-9\-]/g, '');
    const barcode = cleaned.toLowerCase() === 'null' || cleaned.length < 4 ? null : cleaned;

    return new Response(JSON.stringify({ barcode }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[extract-barcode] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
