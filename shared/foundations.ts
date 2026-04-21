import type {
  Allergen,
  DietType,
  HealthCondition,
  IngredientToAvoid,
} from './types';

export const SCORING_VERSION = 'v1.0.0' as const;

export type ScoreBand = 'great' | 'good' | 'caution' | 'avoid';

export type ScoreReasonCode =
  | 'condition_fit'
  | 'allergen_risk'
  | 'diet_fit'
  | 'ingredient_concern'
  | 'ultra_processed'
  | 'nutrition_balance'
  | 'insufficient_data';

export interface ScoringInput {
  barcode: string;
  profile: {
    conditions: HealthCondition[];
    allergens: Allergen[];
    diets: DietType[];
    avoids: IngredientToAvoid[];
  };
  product: {
    ingredientsText?: string;
    ingredients?: string[];
    allergens?: string[];
    nutriments?: Record<string, number | string | null | undefined>;
    labels?: string[];
    categories?: string[];
  };
}

export interface ScoreReason {
  code: ScoreReasonCode;
  title: string;
  detail: string;
  impact: number;
}

export interface ScoringOutput {
  score: number;
  band: ScoreBand;
  reasons: ScoreReason[];
  warnings: string[];
  confidence: number;
  version: typeof SCORING_VERSION;
}

export interface ScoringCacheKeyParts {
  barcode: string;
  scoringVersion: string;
  profileHash: string;
}

export const SCORE_BAND_RANGES: Record<ScoreBand, [number, number]> = {
  great: [80, 100],
  good: [60, 79],
  caution: [35, 59],
  avoid: [0, 34],
};

export const SUPABASE_ENV = {
  url: 'EXPO_PUBLIC_SUPABASE_URL',
  anonKey: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
} as const;

export const PRODUCT_ENV = {
  openFoodFactsBaseUrl: 'EXPO_PUBLIC_OPEN_FOOD_FACTS_BASE_URL',
  /** USDA FoodData Central — optional; enables branded/supplement lookup by barcode. */
  usdaApiKey: 'EXPO_PUBLIC_USDA_API_KEY',
} as const;

export const AI_ENV = {
  provider: 'SUPABASE_AI_PROVIDER',
  apiKey: 'SUPABASE_AI_API_KEY',
  model: 'SUPABASE_AI_MODEL',
} as const;

export function buildScoringCacheKey(parts: ScoringCacheKeyParts): string {
  return [parts.barcode, parts.scoringVersion, parts.profileHash].join(':');
}
