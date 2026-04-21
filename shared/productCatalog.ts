/**
 * Unified barcode + text search across Open Food/Beauty/Products Facts, USDA FDC, and openFDA.
 */
import type { OffFetchResult, OffProductSnapshot, ProductCatalogSource } from './openFoodFacts';

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
].join(',');

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
      nutriscoreGrade: (p.nutriscore_grade as string) ?? null,
      novaGroup: typeof nova === 'number' ? nova : null,
      ingredientsAnalysisTags: Array.isArray(p.ingredients_analysis_tags)
        ? (p.ingredients_analysis_tags as string[])
        : [],
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
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY?.trim();
  if (!apiKey) return null;

  const USDA = 'https://api.nal.usda.gov/fdc/v1';
  try {
    const searchUrl = `${USDA}/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(
      barcode
    )}&pageSize=25&dataType=Branded`;
    const sRes = await fetch(searchUrl, { headers: { Accept: 'application/json', 'User-Agent': UA } });
    if (!sRes.ok) return null;
    const sJson = (await sRes.json()) as {
      foods?: Array<{
        fdcId: number;
        gtinUpc?: string;
        description?: string;
        brandName?: string;
        brandOwner?: string;
      }>;
    };
    const foods = sJson.foods;
    if (!foods?.length) return null;

    const target = normalizeGtin(barcode);
    let hit = foods.find((f) => f.gtinUpc && normalizeGtin(f.gtinUpc) === target);
    if (!hit) hit = foods.find((f) => f.gtinUpc === barcode);
    if (!hit) hit = foods[0];

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
    const name = String(food.description ?? hit.description ?? 'Packaged product (USDA)');

    const product: OffProductSnapshot = {
      code: barcode,
      productName: name,
      brand,
      imageUrl: null,
      ingredientsText: ingredientsText || 'See USDA FoodData Central for full label details.',
      allergensTags: [],
      tracesTags: [],
      nutriscoreGrade: null,
      novaGroup: null,
      ingredientsAnalysisTags: [],
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

/**
 * Try Open Food Facts → Open Beauty Facts → Open Products Facts → USDA (if key) → openFDA.
 */
export async function fetchProductByBarcode(barcode: string): Promise<OffFetchResult> {
  const code = barcode.trim();
  if (!code) {
    return { ok: false, status: 400, message: 'Missing barcode' };
  }

  for (const entry of OPEN_FACTS_CHAIN) {
    const base =
      entry.source === 'off' ? getOffBaseUrl() : entry.baseUrl ?? 'https://world.openfoodfacts.org';
    const r = await fetchOpenFactsStyle(base, code, entry.source, entry.label);
    if (r.ok) return r;
  }

  const usda = await fetchUsdaFdcProduct(code);
  if (usda?.ok) return usda;

  const fda = await fetchOpenFdaDrugLabel(code);
  if (fda?.ok) return fda;

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
