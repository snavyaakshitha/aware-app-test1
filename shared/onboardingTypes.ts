export type Category = 'food' | 'personalCare' | 'household';
export type StepId = 'S1' | 'S2' | 'S3F' | 'S3P' | 'S3BOTH' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9';
export type AllergySeverity = 'severe' | 'moderate' | 'mild';

export interface FoodAllergyEntry {
  name: string;
  severity: AllergySeverity;
}

export interface FoodIntoleranceEntry {
  type: string;
  subPreference: string;
}

export interface OnboardingData {
  // Screen 1
  categories: Category[];
  // Screen 2
  healthConditions: string[];
  // Screen 3 – food allergies
  foodAllergies: FoodAllergyEntry[];
  foodAllergyTraces: boolean;
  foodAllergyOther: string;
  // Screen 3 – personal care allergens
  skinAllergens: string[];
  skinAllergenTraces: boolean;
  skinAllergenOther: string;
  // Screen 4
  foodIntolerances: FoodIntoleranceEntry[];
  // Screen 5
  dietaryPatterns: string[];
  dietStrictness: 'strict' | 'moderate' | 'flexible' | '';
  // Screen 6 – skin
  skinType: string;
  skinConcerns: string[];
  skinIngredientsToAvoid: string[];
  // Screen 6 – hair
  hairType: string;
  hairConcerns: string[];
  hairIngredientsToAvoid: string[];
  // Screen 7
  householdReasons: string[];
  householdIngredients: string[];
  // Screen 8
  supplementAvoids: string[];
}

export const EMPTY_ONBOARDING: OnboardingData = {
  categories: [],
  healthConditions: [],
  foodAllergies: [],
  foodAllergyTraces: true,
  foodAllergyOther: '',
  skinAllergens: [],
  skinAllergenTraces: true,
  skinAllergenOther: '',
  foodIntolerances: [],
  dietaryPatterns: [],
  dietStrictness: '',
  skinType: '',
  skinConcerns: [],
  skinIngredientsToAvoid: [],
  hairType: '',
  hairConcerns: [],
  hairIngredientsToAvoid: [],
  householdReasons: [],
  householdIngredients: [],
  supplementAvoids: [],
};

// ─── Legacy types (used by StepDiet.tsx) ─────────────────────────────────────
export type DietPatternId =
  | 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan' | 'paleo' | 'keto'
  | 'mediterranean' | 'whole30' | 'clean_eating' | 'no_specific';

export interface DietaryBlock {
  patterns: DietPatternId[];
  strictness?: 'strict' | 'moderate' | 'flexible';
}
