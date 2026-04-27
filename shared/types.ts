/**
 * Aware — Core TypeScript Types
 *
 * All shared data shapes live here. When backend arrives, these
 * interfaces become the contract between API responses and UI.
 */

// ─── Questionnaire / User Profile ────────────────────────────────────────────

export type HealthCondition =
  | 'diabetes_t1' | 'diabetes_t2'
  | 'pcos' | 'pcod'
  | 'hypothyroidism' | 'hyperthyroidism'
  | 'celiac'
  | 'crohns' | 'ibd'
  | 'ibs'
  | 'hypertension'
  | 'high_cholesterol'
  | 'heart_disease'
  | 'kidney_disease'
  | 'gerd' | 'acid_reflux'
  | 'fatty_liver'
  | 'anemia'
  | 'eczema' | 'psoriasis'
  | 'adhd'
  | 'autism'
  | 'cancer'
  | 'pregnancy' | 'breastfeeding'
  | 'osteoporosis'
  | 'migraines'
  | 'lupus'
  | 'fibromyalgia'
  | 'endometriosis';

export type Allergen =
  // ── FDA Top 9 (US) ──────────────────────────────────────────
  | 'milk'       // replaces 'dairy' for DB alignment
  | 'dairy'      // legacy alias → maps to 'milk'
  | 'eggs'
  | 'fish'
  | 'shellfish'
  | 'crustaceans'
  | 'tree_nuts'
  | 'peanuts'
  | 'wheat'
  | 'soy'
  | 'sesame'     // FDA 9th allergen since Jan 2023 (FASTER Act)
  // ── EU-14 Additional Allergens ──────────────────────────────
  | 'gluten'     // celiac / gluten sensitivity (wheat + barley + rye)
  | 'mollusks'
  | 'mustard'
  | 'celery'
  | 'lupin'
  | 'sulfites'
  // ── Food Intolerances ───────────────────────────────────────
  | 'lactose'    // lactose intolerance
  | 'fructose'   // hereditary fructose intolerance / malabsorption
  | 'histamine'  // histamine intolerance (DAO deficiency)
  | 'fodmap'     // IBS / FODMAP sensitivity
  | 'nightshades'
  | 'corn'
  | 'salicylates'
  | 'coconut'
  | 'bee_pollen' // bee products (honey, propolis, royal jelly)
  // ── Contact / Skin Allergens ────────────────────────────────
  | 'fragrance_mix'
  | 'parabens'
  | 'formaldehyde'
  | 'methylisothiazolinone'
  | 'propylene_glycol'
  | 'lanolin'
  | 'latex'
  | 'nickel'
  | 'cobalt'
  | 'chromium'
  | 'balsam_peru';

export type DietType =
  | 'vegan'
  | 'vegetarian'
  | 'pescatarian'
  | 'keto'
  | 'low_carb'
  | 'paleo'
  | 'carnivore'
  | 'gluten_free'
  | 'dairy_free'
  | 'whole30'
  | 'mediterranean'
  | 'low_fodmap'
  | 'halal'
  | 'kosher'
  | 'jain'
  | 'raw_vegan'
  | 'anti_inflammatory';

export type IngredientToAvoid =
  | 'hfcs'
  | 'aspartame' | 'sucralose' | 'saccharin' | 'acesulfame_k' | 'stevia_refined'
  | 'artificial_dyes' | 'red40' | 'yellow5' | 'yellow6' | 'blue1' | 'blue2'
  | 'sodium_nitrate' | 'sodium_nitrite'
  | 'bha' | 'bht' | 'tbhq'
  | 'carrageenan'
  | 'msg'
  | 'trans_fats' | 'partially_hydrogenated'
  | 'seed_oils' | 'canola_oil' | 'soybean_oil' | 'sunflower_oil' | 'cottonseed_oil'
  | 'maltodextrin'
  | 'titanium_dioxide'
  | 'carboxymethylcellulose'
  | 'polysorbate_80'
  | 'natural_flavors'
  | 'sodium_benzoate' | 'potassium_benzoate'
  | 'potassium_bromate'
  | 'brominated_veg_oil'
  | 'propyl_gallate'
  | 'silicon_dioxide'
  | 'caramel_color';

export type SkinType = 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal';

export type SkinConcern =
  | 'acne' | 'eczema' | 'psoriasis' | 'rosacea'
  | 'aging' | 'hyperpigmentation' | 'sensitivity'
  | 'dryness' | 'oiliness';

export interface UserPreferences {
  name: string;
  avatar?: string;
  healthConditions: HealthCondition[];
  allergens: Allergen[];
  diets: DietType[];
  ingredientsToAvoid: IngredientToAvoid[];
  customAvoids: string[]; // free-text user additions
  location: string;
  membershipTier: 'free' | 'supporter' | 'annual';
  onboardingComplete: boolean;
  // Skincare profile fields
  skin_type?: SkinType | null;
  skin_concerns?: SkinConcern[];
  known_skin_sensitivities?: string[];
}

// ─── Products ─────────────────────────────────────────────────────────────────

export type ProductBadge =
  | 'cleanest'
  | 'best_for_you'
  | 'best_overall'
  | 'best_value'
  | 'top_rated'
  | 'new';

export type ConfidenceBadge = 'verified' | 'community' | 'pending';

export interface Ingredient {
  name: string;
  isClean: boolean;
  isConcern: boolean;
  reason?: string; // e.g. "Linked to inflammation"
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  subcategory?: string;
  emoji: string; // placeholder for image
  cleanScore: number;    // 0-100
  healthScore: number;   // 0-100: fit for user's conditions
  valueScore: number;    // 0-100
  badges: ProductBadge[];
  confidenceBadge: ConfidenceBadge;
  healthConditionsGoodFor: HealthCondition[];
  allergensPresent: Allergen[];
  dietCompatible: DietType[];
  ingredientConcerns: IngredientToAvoid[];
  allIngredients: Ingredient[];
  servingSize: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  sodium?: number;
  fiber?: number;
  whyClean: string;
  whyGoodForCondition?: Record<string, string>;
  price?: string;
  stores: string[]; // store IDs where available
  verified: boolean;
}

export type ProductCategory =
  // Food & Nutrition
  | 'snacks' | 'chocolate' | 'bars'
  | 'dairy_alternatives' | 'dairy'
  | 'beverages' | 'water' | 'tea' | 'coffee'
  | 'bread_grains' | 'pasta' | 'cereals'
  | 'condiments' | 'oils' | 'dressings'
  | 'frozen' | 'meat' | 'seafood'
  | 'produce'
  | 'supplements' | 'protein'
  | 'baking'
  | 'sauces' | 'spreads'
  | 'chips_crackers'
  // Skincare & Beauty
  | 'skincare_cleansers' | 'skincare_moisturizers' | 'skincare_treatments'
  | 'skincare_sunscreen' | 'skincare_masks' | 'skincare_serums'
  | 'makeup' | 'haircare' | 'bodycare'
  // Household & General
  | 'household_cleaning' | 'laundry' | 'personal_care';

// ─── Stores ───────────────────────────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  emoji: string;
  color: string;          // brand color for card accent
  productCount: string;   // e.g. "11,500+"
  distance?: string;      // e.g. "0.8 mi"
  isOpen?: boolean;
  categories: ProductCategory[];
}

// ─── Lists / Carts ────────────────────────────────────────────────────────────

export interface ListItem {
  id: string;
  product: Product;
  quantity: number;
  checked: boolean;
  note?: string;
  addedAt: Date;
}

export interface ShoppingList {
  id: string;
  name: string;
  storeId?: string;
  storeName?: string;
  items: ListItem[];
  createdAt: Date;
  updatedAt: Date;
  isShared?: boolean;
  sharedWith?: string[];
  cleanScoreAvg?: number;
}

// ─── Skincare Analysis ────────────────────────────────────────────────────────

export interface SkincareIngredientFlag {
  ingredient: string;
  concern_level: 'severe' | 'high' | 'medium' | 'low';
  concern_types: string[];
  reason: string;
  sources: Array<{ source_name: string; url: string; confidence: number }>;
}

export interface SkinCareAnalysisResult {
  verdict: 'clean' | 'flag';
  flagged_ingredients: SkincareIngredientFlag[];
  severe_count: number;
  high_count: number;
  total_flagged?: number;
}

export type ProductDetectionCategory = 'food' | 'skincare' | 'unknown';

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  Main: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Store: { storeId: string };
  SearchResults: { query: string; storeId?: string };
  ProductDetail: { productId: string };
};

export type ScannerStackParamList = {
  Scanner: undefined;
  /** `productId` = mock catalog id; `barcode` = Open Food Facts / AI lookup. */
  ScanResult: { productId?: string; barcode?: string; category?: ProductDetectionCategory };
  /** AI fallback: user takes 2 photos → Gemini/GPT extracts product data. */
  AIFallback: { barcode: string; category?: ProductDetectionCategory };
};

export type ListsStackParamList = {
  Lists: undefined;
  ListDetail: { listId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditPreferences: undefined;
};

// ─── Database Types (new regulatory schema) ───────────────────────────────────

export interface DBIngredient {
  id: number;
  inci_name: string;
  common_names: string[];
  cas_number: string | null;
  ingredient_category: string;
  description: string | null;
}

export interface DBBannedIngredient {
  ingredient_name: string;
  country_code: string;
  ban_status: 'banned' | 'restricted' | 'regulated';
  effective_date: string | null;
  active: boolean;
  regulation_link: string | null;
  reason: string | null;
  category_restricted_to: string[] | null;
  max_concentration_ppm: number | null;
  notes: string | null;
  regulatory_body_code?: string | null;
}

export interface DBBannedProduct {
  id: number;
  product_name: string;
  brand_name: string;
  barcode: string | null;
  countries_banned: string[];
  ban_reason: string;
  recall_link: string | null;
  ban_date: string | null;
  recall_type: 'safety_recall' | 'misleading_claims' | 'regulatory_ban' | 'voluntary_withdrawal' | 'contamination' | null;
  category: string | null;
  status: 'active' | 'expired' | 'under_review';
}

export interface DBAllergenDefinition {
  id: number;
  allergen_code: string;
  display_name: string;
  is_food_allergen: boolean;
  is_contact_allergen: boolean;
  prevalence_percent: number | null;
  symptoms: string[];
  regulatory_mention: string | null;
}

export interface DBIngredientConflict {
  ingredient_1_name: string;
  ingredient_2_name: string;
  conflict_type: 'chemical_reaction' | 'contraindicated' | 'reduced_efficacy' | 'increased_toxicity' | 'amplified_side_effect' | 'drug_interaction';
  severity: 'severe' | 'high' | 'medium' | 'low';
  description: string | null;
  health_risk: string | null;
  product_type_context: string | null;
}

export interface DBHouseholdRule {
  ingredient_pattern: string;
  concern_type: string;
  severity: 'severe' | 'high' | 'medium' | 'low';
  human_health_impacts: string[];
  environmental_impact: string[];
  safer_alternatives: string[];
  reason: string | null;
}

export interface DBSupplementRule {
  ingredient_pattern: string;
  concern_type: string;
  severity: 'severe' | 'high' | 'medium' | 'low';
  health_impacts: string[];
  drug_interactions: string[];
  contraindicated_conditions: string[];
  safe_dose_range: Record<string, unknown> | null;
  banned_by_agencies: string[] | null;
}

export interface DBBodycareRule {
  ingredient_pattern: string;
  concern_type: string;
  severity: 'severe' | 'high' | 'medium' | 'low';
  health_impacts: string[];
  affected_skin_types: string[] | null;
  better_alternatives: string[];
}

// RPC return types
export interface BannedIngredientMatch {
  ingredient_name: string;
  country_code: string;
  ban_status: string;
  reason: string | null;
  regulation_link: string | null;
  regulatory_body_code: string | null;
  category_restricted_to: string[] | null;
  notes: string | null;
}

export interface IngredientConflictMatch {
  ingredient_1_name: string;
  ingredient_2_name: string;
  conflict_type: string;
  severity: string;
  description: string | null;
  health_risk: string | null;
}

export interface AllergenMatch {
  ingredient_name: string;
  allergen_code: string;
  display_name: string;
  relationship_type: string;
  confidence: number;
}

// ─── Extended DB Interface Types (regulatory schema) ──────────────────────────

export interface DBIngredientSource {
  id: number;
  ingredient_id: number;
  source_type: 'official_database' | 'regulatory_body' | 'research_paper' | 'scientific_study' | 'industry_organization' | 'manufacturer' | 'other';
  source_name: string;
  source_url: string;
  url_status: 'active' | 'archived' | '404' | 'paywalled' | 'unknown' | 'redirects';
  last_checked_at: string | null;
  confidence_score: number;
  excerpt: string | null;
  publication_date: string | null;
  verified: boolean;
}

export interface DBIngredientAllergenRelationship {
  id: number;
  ingredient_id: number | null;
  ingredient_name: string;
  allergen_id: number;
  allergen_code: string;
  relationship_type: 'contains' | 'cross_reacts' | 'derived_from' | 'labeled_as' | 'may_contain' | 'processed_on_shared_equipment';
  confidence: number;
  notes: string | null;
  source_url: string | null;
}

export interface DBRegulatoryBody {
  id: number;
  code: string;    // e.g. "FDA", "EMA", "MHRA", "TGA"
  name: string;
  country: string | null;
  jurisdiction_type: 'national' | 'regional' | 'international';
  established_year: number | null;
  website_url: string | null;
  database_url: string | null;
}

export interface DBSourceUrl {
  id: number;
  url: string;
  source_name: string;
  domain: string | null;
  url_status: 'active' | 'archived' | '404' | 'redirects' | 'paywalled' | 'unknown';
  last_checked_at: string | null;
  http_status_code: number | null;
  confidence_score: number;
  credibility_tier: 'official' | 'academic' | 'professional' | 'industry' | 'consumer' | 'unverified';
  total_citations: number;
  created_at: string;
  updated_at: string;
}

export interface DBProductCategory {
  id: number;
  code: string;          // e.g. "food_snacks", "skincare_cleanser"
  display_name: string;
  category_type: 'food' | 'beauty_skincare' | 'beauty_bodycare' | 'cosmetics' | 'household' | 'supplement' | 'pharma';
  parent_category_code: string | null;
  description: string | null;
  icon_name: string | null;
  applicable_rules_table: string | null;
}

export interface DBIngredientAlias {
  id: number;
  ingredient_id: number;
  alias_name: string;
  language: string;
  region: string | null;
  is_common_name: boolean;
}

export interface DBFoodAdditiveRule {
  id: number;
  ingredient_pattern: string;
  ingredient_id: number | null;
  concern_type: string;
  severity: 'severe' | 'high' | 'medium' | 'low';
  penalty_points: number;
  reason: string | null;
  health_impacts: string[];
  applicable_categories: string[];
  active: boolean;
}

/** Full scan analysis result returned by fetchProductAnalysis() */
export interface FullProductAnalysis {
  safety: import('./scoring').SafetyAnalysis;
  additives: import('./scoring').AdditiveAnalysis;
  bannedSubstances: import('./scoring').BannedSubstanceMatch[];
  globalBans: import('./scoring').GlobalBanResult;
  conflicts: import('./scoring').ConflictResult;
  allergenMatches: AllergenMatch[];
}
