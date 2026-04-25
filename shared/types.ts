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
  | 'gluten' | 'wheat'
  | 'dairy' | 'lactose'
  | 'eggs'
  | 'peanuts'
  | 'tree_nuts'
  | 'soy'
  | 'fish'
  | 'shellfish'
  | 'sesame'
  | 'corn'
  | 'nightshades'
  | 'sulfites'
  | 'fructose';

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
