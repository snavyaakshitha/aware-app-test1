import type { UserPreferences } from './types';
import type { IngredientToAvoid, Allergen, HealthCondition } from './types';

const DEFAULT_BASE = 'https://world.openfoodfacts.org';

/** Where barcode/product data was resolved (Open *Facts family, USDA FDC, openFDA, or AI). */
export type ProductCatalogSource =
  | 'off' | 'obf' | 'opf'
  | 'usda_fdc'
  | 'openfda'
  | 'ai_gemini'    // Gemini 2.0 Flash vision extraction
  | 'ai_gpt'       // GPT-4o mini vision extraction (Gemini fallback)
  | 'supabase_cache'; // Fetched from our own products table

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

/** Map OFF allergen tags (e.g. en:gluten) to rough keyword hits vs user allergens. */
const OFF_TAG_TO_ALLERGEN: Record<string, Allergen[]> = {
  'en:gluten': ['gluten', 'wheat'],
  'en:milk': ['dairy', 'lactose'],
  'en:eggs': ['eggs'],
  'en:peanuts': ['peanuts'],
  'en:nuts': ['tree_nuts'],
  'en:soybeans': ['soy'],
  'en:fish': ['fish'],
  'en:celery': [],
  'en:mustard': [],
  'en:sesame-seeds': ['sesame'],
  'en:sulphur-dioxide-and-sulphites': ['sulfites'],
  'en:crustaceans': ['shellfish'],
  'en:molluscs': ['shellfish'],
};

const AVOID_KEYWORDS: Partial<Record<IngredientToAvoid, string[]>> = {
  hfcs: ['high fructose', 'hfcs', 'glucose-fructose'],
  aspartame: ['aspartame'],
  msg: ['monosodium glutamate', ' msg'],
  trans_fats: ['trans fat', 'hydrogenated'],
  partially_hydrogenated: ['partially hydrogenated'],
  artificial_dyes: ['red 40', 'yellow 5', 'yellow 6', 'tartrazine', 'fd&c'],
  carrageenan: ['carrageenan'],
  maltodextrin: ['maltodextrin'],
  seed_oils: ['canola', 'soybean oil', 'sunflower oil', 'corn oil'],
};

export type HealthFitResult = {
  healthScore: number;
  cleanScore: number;
  concerns: string[];
  positives: string[];
  allergensHit: string[];
};

export function scoreProductForProfile(
  off: OffProductSnapshot,
  prefs: Partial<UserPreferences> | null
): HealthFitResult {
  const concerns: string[] = [];
  const positives: string[] = [];
  const allergensHit: string[] = [];

  const ing = off.ingredientsText.toLowerCase();
  const isFoodish =
    !off.catalogSource || off.catalogSource === 'off' || off.catalogSource === 'usda_fdc';
  const userAllergens = prefs?.allergens ?? [];
  const avoids = prefs?.ingredientsToAvoid ?? [];
  const custom = prefs?.customAvoids?.map((c) => c.toLowerCase()) ?? [];

  for (const tag of off.allergensTags) {
    const mapped = OFF_TAG_TO_ALLERGEN[tag];
    if (!mapped || mapped.length === 0) continue;
    for (const a of mapped) {
      if (userAllergens.includes(a)) {
        allergensHit.push(tag.replace(/^en:/, '').replace(/-/g, ' '));
      }
    }
  }

  for (const a of userAllergens) {
    const hints: Record<string, string[]> = {
      gluten: ['wheat', 'barley', 'rye', 'gluten'],
      dairy: ['milk', 'cream', 'butter', 'whey', 'casein', 'lactose'],
      eggs: ['egg'],
      peanuts: ['peanut'],
      tree_nuts: ['almond', 'cashew', 'hazelnut', 'walnut', 'pecan'],
      soy: ['soy'],
      fish: ['fish'],
      shellfish: ['shrimp', 'crab', 'lobster', 'shellfish'],
      sesame: ['sesame'],
    };
    const words = hints[a];
    if (words && words.some((w) => ing.includes(w))) {
      if (!allergensHit.includes(a)) allergensHit.push(String(a).replace(/_/g, ' '));
    }
  }

  for (const id of avoids) {
    const keys = AVOID_KEYWORDS[id];
    if (!keys) continue;
    if (keys.some((k) => ing.includes(k))) {
      concerns.push(`Contains avoided ingredient pattern: ${String(id).replace(/_/g, ' ')}`);
    }
  }
  for (const c of custom) {
    if (c.length > 1 && ing.includes(c)) {
      concerns.push(`Contains your custom avoid: "${c}"`);
    }
  }

  const conditions = (prefs?.healthConditions ?? []) as HealthCondition[];
  if (isFoodish) {
    if (conditions.includes('diabetes_t2') || conditions.includes('diabetes_t1')) {
      if (/\b(sugar|syrup|glucose fructose|maltodextrin)\b/i.test(off.ingredientsText)) {
        concerns.push('High glycemic ingredients — review for diabetes');
      }
    }
    if (conditions.includes('hypertension')) {
      const low = off.ingredientsText.toLowerCase();
      if (/\b(sodium|salt|msg|monosodium)\b/i.test(low)) {
        concerns.push('Sodium-related ingredients — review for blood pressure');
      }
    }
  }

  if (off.ingredientsAnalysisTags.includes('en:palm-oil')) {
    concerns.push('Contains palm oil (processing / sourcing concern for some users)');
  }

  if (isFoodish) {
    if (off.novaGroup != null && off.novaGroup >= 4) {
      concerns.push('Ultra-processed food (NOVA 4)');
    } else if (off.novaGroup === 1) {
      positives.push('Unprocessed / minimally processed (NOVA 1)');
    }

    if (off.nutriscoreGrade === 'a' || off.nutriscoreGrade === 'b') {
      positives.push(`Nutri-Score ${String(off.nutriscoreGrade).toUpperCase()}`);
    }
  }

  let healthScore = 88;
  healthScore -= allergensHit.length * 22;
  healthScore -= concerns.length * 8;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  let cleanScore = 75;
  cleanScore -= concerns.filter((c) => c.includes('avoided')).length * 12;
  if (isFoodish) {
    cleanScore -= off.novaGroup != null && off.novaGroup >= 4 ? 15 : 0;
  }
  cleanScore = Math.max(0, Math.min(100, Math.round(cleanScore)));

  return {
    healthScore,
    cleanScore,
    concerns,
    positives,
    allergensHit,
  };
}
