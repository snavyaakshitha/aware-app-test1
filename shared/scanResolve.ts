/**
 * Normalize QR / barcode scan strings to a GTIN / product code for Open Food Facts.
 * Handles: plain EAN/UPC digits, GS1 Digital Link URLs, query params, OFF product URLs.
 */
export function extractProductCode(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const gs1 = s.match(/\/01\/(\d{8,14})(?:\/|$|\?|#)/);
  if (gs1) return gs1[1];

  const param = s.match(/[?&#](?:gtin|ean|code|barcode)=(\d{8,14})/i);
  if (param) return param[1];

  if (
    (s.includes('openfoodfacts') ||
      s.includes('openbeautyfacts') ||
      s.includes('openproductsfacts')) &&
    s.includes('product')
  ) {
    const m = s.match(/\/product\/(\d{8,14})\b/);
    if (m) return m[1];
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length < 8) return null;

  for (const len of [14, 13, 12, 8] as const) {
    if (digits.length >= len) {
      return digits.slice(-len);
    }
  }
  return null;
}
