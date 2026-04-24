
const DEFAULT_BASE = 'https://world.openfoodfacts.org';

/** Where barcode/product data was resolved (Open *Facts family, USDA FDC, openFDA, or AI). */
export type ProductCatalogSource =
  | 'off' | 'obf' | 'opf'
  | 'usda_fdc'
  | 'openfda'
  | 'ai_gemini'
  | 'ai_gpt'
  | 'supabase_cache';

export type NutritionFacts = {
  calories: string | null;
  fat: string | null;
  protein: string | null;
  carbohydrates: string | null;
  sodium: string | null;
  sugar: string | null;
  fiber: string | null;
  serving_size: string | null;
};

/** Universal nutriments from OFF (per 100g). All keys are number | null. */
export type OffNutriments = {
  energy_kj_100g: number | null;
  energy_kcal_100g: number | null;
  fat_100g: number | null;
  saturated_fat_100g: number | null;
  carbohydrates_100g: number | null;
  sugars_100g: number | null;
  fiber_100g: number | null;
  proteins_100g: number | null;
  sodium_100g: number | null;
  salt_100g: number | null;
};

export type OffProductSnapshot = {
  code: string;
  productName: string;
  brand: string;
  imageUrl: string | null;
  ingredientsText: string;
  allergensTags: string[];
  tracesTags: string[];
  nutriscoreGrade: string | null;
  novaGroup: number | null;
  ingredientsAnalysisTags: string[];
  nutriments: OffNutriments | null;           // OFF nutriments (per 100g) — present for all OFF products
  catalogSource?: ProductCatalogSource;
  catalogSourceLabel?: string;
  // AI-extracted extras (only present when catalogSource = 'ai_gemini' | 'ai_gpt')
  nutritionFacts?: NutritionFacts;
  netWeight?: string | null;
  imageFrontUrl?: string | null;
  imageLabelUrl?: string | null;
};

export type OffFetchResult =
  | { ok: true; product: OffProductSnapshot }
  | { ok: false; status: number; message: string };

function getBaseUrl(): string {
  const b = process.env.EXPO_PUBLIC_OPEN_FOOD_FACTS_BASE_URL?.replace(/\/$/, '');
  return b && b.length > 0 ? b : DEFAULT_BASE;
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export async function fetchOpenFoodFactsProduct(barcode: string): Promise<OffFetchResult> {
  const fields = [
    'product_name',
    'brands',
    'image_front_small_url',
    'ingredients_text',
    'allergens_tags',
    'traces_tags',
    'nutriscore_grade',
    'nova_group',
    'ingredients_analysis_tags',
    'nutriments',            // ← was missing — required for sugar/fat/protein headlines
    'serving_size',
  ].join(',');

  const url = `${getBaseUrl()}/api/v2/product/${encodeURIComponent(barcode)}?fields=${fields}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Aware/1.0 (mobile app; not-for-bot-scraping)',
      },
    });

    const json = (await res.json()) as {
      status?: number;
      status_verbose?: string;
      product?: Record<string, unknown>;
    };

    if (json.status !== 1 || !json.product) {
      return {
        ok: false,
        status: json.status ?? 0,
        message: json.status_verbose ?? 'Product not found',
      };
    }

    const p = json.product;
    const nova = p.nova_group;
    const nm = (p.nutriments ?? {}) as Record<string, unknown>;

    const nutriments: OffNutriments = {
      energy_kj_100g:      parseNum(nm['energy-kj_100g']     ?? nm['energy_kj_100g']),
      energy_kcal_100g:    parseNum(nm['energy-kcal_100g']   ?? nm['energy_kcal_100g']),
      fat_100g:            parseNum(nm['fat_100g']),
      saturated_fat_100g:  parseNum(nm['saturated-fat_100g'] ?? nm['saturated_fat_100g']),
      carbohydrates_100g:  parseNum(nm['carbohydrates_100g']),
      sugars_100g:         parseNum(nm['sugars_100g']),
      fiber_100g:          parseNum(nm['fiber_100g']),
      proteins_100g:       parseNum(nm['proteins_100g']),
      sodium_100g:         parseNum(nm['sodium_100g']),
      salt_100g:           parseNum(nm['salt_100g']),
    };

    const hasNutriments = Object.values(nutriments).some((v) => v !== null);

    return {
      ok: true,
      product: {
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
        nutriments: hasNutriments ? nutriments : null,
        catalogSource: 'off',
        catalogSourceLabel: 'Open Food Facts',
      },
    };
  } catch (e) {
    return {
      ok: false,
      status: -1,
      message: e instanceof Error ? e.message : 'Network error',
    };
  }
}
