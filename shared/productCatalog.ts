/**
 * Unified barcode + text search across Open Food/Beauty/Products Facts, USDA FDC, and openFDA.
 */
import type { OffFetchResult, OffProductSnapshot, OffNutriments, ProductCatalogSource } from './openFoodFacts';

const UA = 'Aware/1.0 (mobile app; community-data; not-a-bot)';

const OPEN_FACTS_FIELDS = [
  'product_name',
  'brands',
  'image_front_small_url',
  'ingredients_text',
  'allergens_tags',
  'traces_tags',
  'nutriscore_grade',
  'nova_group',
  'ingredients_analysis_tags',
  'nutriments',
].join(',');

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function extractNutriments(p: Record<string, unknown>): OffNutriments | null {
  const nm = (p.nutriments ?? {}) as Record<string, unknown>;
  const result: OffNutriments = {
    energy_kj_100g:     parseNum(nm['energy-kj_100g']     ?? nm['energy_kj_100g']),
    energy_kcal_100g:   parseNum(nm['energy-kcal_100g']   ?? nm['energy_kcal_100g']),
    fat_100g:           parseNum(nm['fat_100g']),
    saturated_fat_100g: parseNum(nm['saturated-fat_100g'] ?? nm['saturated_fat_100g']),
    carbohydrates_100g: parseNum(nm['carbohydrates_100g']),
    sugars_100g:        parseNum(nm['sugars_100g']),
    fiber_100g:         parseNum(nm['fiber_100g']),
    proteins_100g:      parseNum(nm['proteins_100g']),
    sodium_100g:        parseNum(nm['sodium_100g']),
    salt_100g:          parseNum(nm['salt_100g']),
  };
  return Object.values(result).some((v) => v !== null) ? result : null;
}

type OpenFactsBase = {
  source: ProductCatalogSource;
  label: string;
  /** Override for OFF only (env). */
  baseUrl?: string;
};

const OPEN_FACTS_CHAIN: OpenFactsBase[] = [
  { source: 'off', label: 'Open Food Facts' },
  { source: 'obf', label: 'Open Beauty Facts', baseUrl: 'https://world.openbeautyfacts.org' },
  { source: 'opf', label: 'Open Products Facts', baseUrl: 'https://world.openproductsfacts.org' },
];

function getOffBaseUrl(): string {
  const b = process.env.EXPO_PUBLIC_OPEN_FOOD_FACTS_BASE_URL?.replace(/\/$/, '');
  return b && b.length > 0 ? b : 'https://world.openfoodfacts.org';
}

function getOpenFactsProductUrl(base: string, barcode: string): string {
  return `${base.replace(/\/$/, '')}/api/v2/product/${encodeURIComponent(barcode)}?fields=${OPEN_FACTS_FIELDS}`;
}

async function fetchOpenFactsStyle(
  base: string,
  barcode: string,
  source: ProductCatalogSource,
  label: string
): Promise<OffFetchResult> {
  const url = getOpenFactsProductUrl(base, barcode);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    const json = (await res.json()) as {
      status?: number;
      status_verbose?: string;
      product?: Record<string, unknown>;
    };
    if (json.status !== 1 || !json.product) {
      return { ok: false, status: json.status ?? 0, message: json.status_verbose ?? 'Not found' };
    }
    const p = json.product;
    const nova = p.nova_group;
    const product: OffProductSnapshot = {
      code: barcode,
      productName: String(p.product_name ?? 'Unknown product'),
      brand: String(p.brands ?? '').split(',')[0]?.trim() || 'Unknown brand',
      imageUrl: (p.image_front_small_url as string) ?? null,
      ingredientsText: String(p.ingredients_text ?? ''),
      allergensTags: Array.isArray(p.allergens_tags) ? (p.allergens_tags as string[]) : [],
      tracesTags: Array.isArray(p.traces_tags) ? (p.traces_tags as string[]) : [],
      nutriscoreGrade: (() => {
        const raw = p.nutriscore_grade as string | null | undefined;
        if (!raw) return null;
        const g = raw.toLowerCase().trim();
        if (['not-applicable', 'not_applicable', 'unknown', 'n/a', ''].includes(g)) return null;
        return ['a', 'b', 'c', 'd', 'e'].includes(g) ? g : null;
      })(),
      novaGroup: typeof nova === 'number' ? nova : null,
      ingredientsAnalysisTags: Array.isArray(p.ingredients_analysis_tags)
        ? (p.ingredients_analysis_tags as string[])
        : [],
      nutriments: extractNutriments(p),
      catalogSource: source,
      catalogSourceLabel: label,
    };
    return { ok: true, product };
  } catch (e) {
    return {
      ok: false,
      status: -1,
      message: e instanceof Error ? e.message : 'Network error',
    };
  }
}

function normalizeGtin(s: string): string {
  const d = s.replace(/\D/g, '');
  return d.replace(/^0+/, '') || d;
}

async function fetchUsdaFdcProduct(barcode: string): Promise<OffFetchResult | null> {
  // USDA FDC text search does NOT reliably index by GTIN/UPC when given a raw barcode
  // string as query. We try two GTIN-targeted strategies:
  //   1. Solr-style field query: gtinUpc:<barcode> — works for exact 12-digit UPC-A matches.
  //   2. Padded/stripped variants — USDA sometimes stores leading zeros differently.
  // EAN-13 barcodes starting with a non-US country prefix (≠0) will typically not be in
  // USDA (which covers US branded products). We detect those and skip early.
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY?.trim() || 'DEMO_KEY';
  const USDA = 'https://api.nal.usda.gov/fdc/v1';

  // Skip EAN-13 barcodes with non-US country codes (first digit ≠ 0)
  const digits = barcode.replace(/\D/g, '');
  if (digits.length === 13 && digits[0] !== '0') return null;

  // Build candidate GTIN variants to try
  const target = normalizeGtin(digits);
  const candidates = new Set<string>([
    digits,
    target,
    digits.padStart(12, '0'),
    digits.padStart(13, '0'),
  ]);

  type SearchFood = { fdcId: number; gtinUpc?: string; description?: string; brandName?: string; brandOwner?: string };

  const trySearch = async (query: string): Promise<SearchFood[] | null> => {
    try {
      const url = `${USDA}/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=10&dataType=Branded`;
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
      if (!res.ok) return null;
      const json = (await res.json()) as { foods?: SearchFood[] };
      return json.foods?.length ? json.foods : null;
    } catch {
      return null;
    }
  };

  let hit: SearchFood | undefined;

  // Strategy 1: Solr field query for exact GTIN match (most precise)
  for (const variant of candidates) {
    const foods = await trySearch(`gtinUpc:${variant}`);
    if (foods) {
      hit = foods.find((f) => f.gtinUpc && normalizeGtin(f.gtinUpc) === target) ?? foods[0];
      if (hit) break;
    }
  }

  // Strategy 2: plain numeric search + GTIN filter (broader net, requires exact match)
  if (!hit) {
    const foods = await trySearch(digits);
    if (foods) {
      hit = foods.find((f) => f.gtinUpc && normalizeGtin(f.gtinUpc) === target);
    }
  }

  if (!hit) return null;

  try {
    const detailUrl = `${USDA}/food/${hit.fdcId}?api_key=${encodeURIComponent(apiKey)}`;
    const dRes = await fetch(detailUrl, { headers: { Accept: 'application/json', 'User-Agent': UA } });
    if (!dRes.ok) return null;
    const food = (await dRes.json()) as {
      description?: string;
      ingredients?: string;
      brandName?: string;
      brandOwner?: string;
      gtinUpc?: string;
    };

    const ingredientsText = String(food.ingredients ?? '').trim();
    const brand = String(food.brandOwner ?? food.brandName ?? hit.brandOwner ?? hit.brandName ?? 'Unknown brand');
    const name  = String(food.description ?? hit.description ?? 'Packaged product (USDA)');

    const product: OffProductSnapshot = {
      code: barcode,
      productName: name,
      brand,
      imageUrl: null,
      ingredientsText,
      allergensTags: [],
      tracesTags: [],
      nutriscoreGrade: null,
      novaGroup: null,
      ingredientsAnalysisTags: [],
      nutriments: null,
      catalogSource: 'usda_fdc',
      catalogSourceLabel: 'USDA FoodData Central',
    };
    return { ok: true, product };
  } catch {
    return null;
  }
}

function collectOpenFdaIngredientText(r: Record<string, unknown>): string {
  const parts: string[] = [];

  const pushStrings = (label: string, arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const block of arr) {
      if (typeof block === 'string' && block.trim()) {
        parts.push(`${label}: ${block.trim()}`);
      } else if (block && typeof block === 'object') {
        const o = block as Record<string, unknown>;
        const t = o.active_ingredient ?? o.inactive_ingredient ?? o.purpose ?? o.text;
        if (typeof t === 'string' && t.trim()) parts.push(`${label}: ${t.trim()}`);
      }
    }
  };

  pushStrings('Active', r.active_ingredient);
  pushStrings('Inactive', r.inactive_ingredient);
  pushStrings('Purpose', r.purpose);

  if (parts.length === 0) {
    const spl = r.spl_product_data_elements as string[] | undefined;
    if (Array.isArray(spl) && spl[0]) parts.push(String(spl[0]));
  }
  return parts.join('\n\n');
}

async function fetchOpenFdaDrugLabel(barcode: string): Promise<OffFetchResult | null> {
  const attempts = [
    `https://api.fda.gov/drug/label.json?search=openfda.upc:"${encodeURIComponent(barcode)}"&limit=1`,
    `https://api.fda.gov/drug/label.json?search=upc:"${encodeURIComponent(barcode)}"&limit=1`,
  ];
  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
      if (!res.ok) continue;
      const json = (await res.json()) as { results?: Record<string, unknown>[] };
      const r = json.results?.[0];
      if (!r) continue;

      const openfda = (r.openfda ?? {}) as Record<string, string[]>;
      const brand = openfda.brand_name?.[0] ?? openfda.generic_name?.[0] ?? 'OTC / drug label (FDA)';
      const name =
        openfda.brand_name?.[0] ??
        openfda.generic_name?.[0] ??
        String((r as { products?: Array<{ marketing_status?: string }> }).products?.[0]?.marketing_status ?? 'Drug facts (openFDA)');

      const ingredientsText =
        collectOpenFdaIngredientText(r).trim() ||
        'See FDA drug labeling for full ingredient and warning details.';

      const product: OffProductSnapshot = {
        code: barcode,
        productName: name,
        brand,
        imageUrl: null,
        ingredientsText,
        allergensTags: [],
        tracesTags: [],
        nutriscoreGrade: null,
        novaGroup: null,
        ingredientsAnalysisTags: [],
        nutriments: null,
        catalogSource: 'openfda',
        catalogSourceLabel: 'openFDA (drug labels)',
      };
      return { ok: true, product };
    } catch {
      /* try next URL */
    }
  }
  return null;
}

// ─── UPC Item DB (trial — 100 lookups/day, no API key required) ──────────────

async function fetchUpcItemDb(barcode: string): Promise<OffFetchResult | null> {
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      items?: Array<{
        title?: string;
        brand?: string;
        description?: string;
        images?: string[];
        ingredients?: string;
        category?: string;
      }>;
    };
    if (json.code !== 'OK' || !json.items?.length) return null;
    const item = json.items[0];
    if (!item.title) return null;

    const product: OffProductSnapshot = {
      code: barcode,
      productName: item.title,
      brand: item.brand ?? 'Unknown brand',
      imageUrl: item.images?.[0] ?? null,
      ingredientsText: item.ingredients ?? '',
      allergensTags: [],
      tracesTags: [],
      nutriscoreGrade: null,
      novaGroup: null,
      ingredientsAnalysisTags: [],
      nutriments: null,
      catalogSource: 'upcitemdb',
      catalogSourceLabel: 'UPC Item Database',
    };
    return { ok: true, product };
  } catch {
    return null;
  }
}

// ─── Data quality validation ──────────────────────────────────────────────────

const SUSPICIOUS_NON_FOOD_TERMS = [
  'ethyl alcohol', 'isopropyl', 'hand sanitizer', 'benzalkonium',
  'naphthylamine', 'industrial', 'motor oil', 'petroleum jelly ingredient',
  'active: ethanol', 'inactive: water purified',
];

const COSMETICS_BARCODE_PREFIXES = ['200','201','202','203','204','205','206','207','208','209'];

function validateProductPlausibility(
  barcode: string,
  product: OffProductSnapshot,
): { plausible: boolean; confidence: 'high' | 'medium' | 'low'; warnings: string[] } {
  const warnings: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';

  // 1. Missing product name
  if (!product.productName || product.productName === 'Unknown product') {
    warnings.push('Product name missing — data may be incomplete.');
    confidence = 'medium';
  }

  // 2. Ingredient count sanity
  const ingCount = product.ingredientsText
    ? product.ingredientsText.split(',').filter((s) => s.trim()).length
    : 0;
  if (ingCount === 0) {
    warnings.push('No ingredients listed — verify on package.');
    confidence = confidence === 'high' ? 'medium' : confidence;
  }
  if (ingCount > 60) {
    warnings.push(`Unusual ingredient count (${ingCount}) — possible data error.`);
    confidence = 'low';
  }

  // 3. Barcode prefix vs database source mismatch
  const prefix3 = barcode.substring(0, 3);
  if (COSMETICS_BARCODE_PREFIXES.includes(prefix3) && product.catalogSource === 'off') {
    warnings.push('Barcode prefix suggests cosmetics but found in food database.');
    confidence = 'low';
  }

  // 4. Suspicious non-food chemicals in ingredient text
  const text = (product.ingredientsText ?? '').toLowerCase();
  for (const term of SUSPICIOUS_NON_FOOD_TERMS) {
    if (text.includes(term)) {
      warnings.push(`Unexpected ingredient detected: "${term}" — verify this is the right product.`);
      confidence = 'low';
      break;
    }
  }

  return { plausible: confidence !== 'low', confidence, warnings };
}

/**
 * Lookup order: USDA FDC (food primary) → OFF → OBF → OPF → openFDA.
 *
 * USDA is tried first because it has authoritative ingredient text for US branded foods.
 * If USDA finds the product but has no ingredient text, we continue to the OFF chain to
 * try to get ingredient text, then fall back to the USDA partial result if OFF also fails.
 */
export async function fetchProductByBarcode(barcode: string): Promise<OffFetchResult> {
  const code = barcode.trim();
  if (!code) {
    return { ok: false, status: 400, message: 'Missing barcode' };
  }

  function applyValidation(r: OffFetchResult): OffFetchResult {
    if (!r.ok) return r;
    const v = validateProductPlausibility(code, r.product);
    if (v.warnings.length === 0) return r;
    return { ok: true, product: { ...r.product, dataWarnings: v.warnings, dataConfidence: v.confidence } };
  }

  // 1. USDA FoodData Central — primary source for food products
  const usda = await fetchUsdaFdcProduct(code);
  if (usda?.ok && usda.product.ingredientsText?.trim()) {
    return applyValidation(usda);
  }

  // 2. Open Food/Beauty/Products Facts chain
  let offResult: OffFetchResult | null = null;
  for (const entry of OPEN_FACTS_CHAIN) {
    const base =
      entry.source === 'off' ? getOffBaseUrl() : entry.baseUrl ?? 'https://world.openfoodfacts.org';
    const r = await fetchOpenFactsStyle(base, code, entry.source, entry.label);
    if (r.ok) { offResult = r; break; }
  }
  if (offResult) return applyValidation(offResult);

  // 3. USDA partial result (found product but no ingredient text) — better than nothing
  if (usda?.ok) return applyValidation(usda);

  // 4. openFDA drug labels (OTC medications, drug-food crossovers)
  const fda = await fetchOpenFdaDrugLabel(code);
  if (fda?.ok) return applyValidation(fda);

  // 5. UPC Item DB — broad general product catalogue (trial: 100 req/day, no key)
  const upcdb = await fetchUpcItemDb(code);
  if (upcdb?.ok) return applyValidation(upcdb);

  return {
    ok: false,
    status: 404,
    message: 'Product not found in connected databases',
  };
}

export type TextSearchHit = {
  code: string;
  productName: string;
  brand: string;
  sourceLabel: string;
};

async function searchOpenFactsPl(
  base: string,
  query: string
): Promise<Array<{ code: string; productName: string; brand: string }>> {
  const url = `${base.replace(/\/$/, '')}/cgi/search.pl?search_terms=${encodeURIComponent(
    query
  )}&json=1&page_size=12&fields=code,product_name,brands`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    products?: Array<{ code?: string; product_name?: string; brands?: string }>;
  };
  const products = json.products;
  if (!products?.length) return [];
  return products
    .filter((p) => p.code)
    .map((p) => ({
      code: String(p.code),
      productName: String(p.product_name ?? '').trim() || 'Unknown',
      brand: String(p.brands ?? '').split(',')[0]?.trim() || '',
    }));
}

/**
 * Search Open Food Facts, Open Beauty Facts, and Open Products Facts; merge unique by code.
 */
export async function searchProductsText(query: string): Promise<TextSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const bases: Array<{ base: string; label: string }> = [
    { base: getOffBaseUrl(), label: 'Open Food Facts' },
    { base: 'https://world.openbeautyfacts.org', label: 'Open Beauty Facts' },
    { base: 'https://world.openproductsfacts.org', label: 'Open Products Facts' },
  ];

  const seen = new Set<string>();
  const out: TextSearchHit[] = [];

  for (const { base, label } of bases) {
    const rows = await searchOpenFactsPl(base, q);
    for (const row of rows) {
      if (seen.has(row.code)) continue;
      seen.add(row.code);
      out.push({
        code: row.code,
        productName: row.productName,
        brand: row.brand,
        sourceLabel: label,
      });
    }
  }

  return out;
}

/**
 * Resolve typed text to a single barcode using the first search hit across OFF → OBF → OPF.
 */
export async function resolveTextToBarcode(query: string): Promise<string | null> {
  const hits = await searchProductsText(query);
  return hits[0]?.code ?? null;
}

/**
 * Detect product category by trying OBF first, then barcode prefix patterns.
 * Returns: 'skincare' if found in beauty DB or matches beauty prefix, 'food' otherwise.
 */
export async function detectProductCategory(barcode: string): Promise<'food' | 'skincare' | 'unknown'> {
  const code = barcode.trim();
  if (!code) return 'unknown';

  // Strategy 1: Try Open Beauty Facts first (fastest indicator)
  const obfUrl = `https://world.openbeautyfacts.org/api/v2/product/${code}?fields=code`;
  try {
    const res = await fetch(obfUrl, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (res.ok) {
      const json = (await res.json()) as { status?: number };
      if (json.status === 1) return 'skincare';
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Check barcode prefix patterns
  // EAN-13/UPC-A prefixes for cosmetics/beauty (200-299 range)
  const prefix = code.substring(0, 3);
  if (['200', '201', '202', '203', '204', '205', '206', '207', '208', '209'].includes(prefix)) {
    return 'skincare';
  }

  // Strategy 3: Default to food (most common)
  return 'food';
}

// ─── OBF name-search enrichment ───────────────────────────────────────────────

/**
 * Simple name-similarity score: what fraction of words in `query` appear in `candidate`.
 * Returns 0–1. Used to filter out clearly unrelated search hits.
 */
function nameSimilarity(query: string, candidate: string): number {
  const qWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!qWords.length) return 0;
  const cLower = candidate.toLowerCase();
  const matches = qWords.filter((w) => cLower.includes(w)).length;
  return matches / qWords.length;
}

/**
 * Search Open Beauty Facts by product name and return the best-matching full product,
 * or null if no sufficiently similar result is found.
 *
 * Minimum similarity threshold (0.5) means at least half the meaningful words in
 * `productName` must appear in the OBF hit's name — guards against false positives
 * for generic names like "Moisturizer".
 */
async function fetchObfByName(
  productName: string,
  brand?: string | null,
): Promise<OffFetchResult | null> {
  const query = [productName, brand].filter(Boolean).join(' ').trim();
  if (query.length < 4) return null;

  const OBF_BASE = 'https://world.openbeautyfacts.org';

  const hits = await searchOpenFactsPl(OBF_BASE, query);
  if (!hits.length) return null;

  // Score each hit by name similarity (brand match is a bonus)
  const scored = hits
    .map((h) => {
      let score = nameSimilarity(productName, h.productName);
      if (brand && h.brand && h.brand.toLowerCase().includes(brand.toLowerCase())) {
        score += 0.3; // boost for brand match
      }
      return { hit: h, score };
    })
    .filter(({ score }) => score >= 0.5)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  // Fetch full product data for the top match
  const best = scored[0].hit;
  return fetchOpenFactsStyle(OBF_BASE, best.code, 'obf', 'Open Beauty Facts (name match)');
}

/**
 * Fetch product by barcode with automatic category detection.
 * Routes to OBF for skincare, OFF chain for food.
 *
 * Cross-DB enrichment: if the barcode is found in a non-OBF source but the
 * product looks like personal care, we also try an OBF text-search by name so
 * that skincare-specific data (OBF categories, INCI ingredient list) is used
 * when available.
 */
export async function fetchProductWithCategory(barcode: string): Promise<OffFetchResult> {
  const category = await detectProductCategory(barcode);

  if (category === 'skincare') {
    // 1. Try OBF by exact barcode first (fastest, most accurate)
    const base = 'https://world.openbeautyfacts.org';
    const r = await fetchOpenFactsStyle(base, barcode, 'obf', 'Open Beauty Facts');
    if (r.ok) return r;
  }

  // 2. Fall back to the full standard chain (USDA → OFF → OBF → OPF → FDA → UPC Item DB)
  const fallback = await fetchProductByBarcode(barcode);

  // 3. Cross-DB enrichment: if found elsewhere with a usable name, try OBF text-search
  //    to get a potentially richer / skincare-tagged version of the same product.
  if (
    fallback.ok &&
    category === 'skincare' &&
    fallback.product.catalogSource !== 'obf' &&
    fallback.product.productName &&
    fallback.product.productName !== 'Unknown product'
  ) {
    const obfByName = await fetchObfByName(
      fallback.product.productName,
      fallback.product.brand,
    );
    if (obfByName?.ok) return obfByName;
  }

  return fallback;
}
