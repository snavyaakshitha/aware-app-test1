/**
 * Barcode extraction from a static image.
 *
 * Web:    @zxing/browser — decodes locally, no network needed.
 * Native: Supabase edge function (extract-barcode) using Gemini Flash.
 */

import { Platform } from 'react-native';

const EDGE_FUNCTION_URL =
  'https://mthfyruozrgrncmfyegq.supabase.co/functions/v1/extract-barcode';

// ─── Web path (@zxing/browser) ────────────────────────────────────────────────

async function extractBarcodeWeb(imageUri: string): Promise<string | null> {
  try {
    // Dynamic import keeps the ~200 KB @zxing bundle out of the native bundle.
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(imageUri);
    return result.getText() ?? null;
  } catch {
    // ZXing throws NotFoundException when no barcode found — that's expected.
    return null;
  }
}

// ─── Native path (Supabase edge function) ────────────────────────────────────

async function extractBarcodeNative(imageBase64: string): Promise<string | null> {
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!anonKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ image: imageBase64 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = (await res.json()) as { barcode?: string | null };
    return json.barcode ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decode a barcode from a picked image.
 *
 * @param imageUri    The local file URI (from expo-image-picker).
 * @param imageBase64 The base64 data-URL (required for native path).
 * @returns The barcode string, or null if not found / error.
 */
export async function extractBarcodeFromImage(
  imageUri: string,
  imageBase64: string,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return extractBarcodeWeb(imageUri);
  }
  return extractBarcodeNative(imageBase64);
}
