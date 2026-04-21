import type { DietPatternId } from './onboardingTypes';

// ─── Screen 2 – Health Conditions ────────────────────────────────────────────
export const HEALTH_CONDITIONS: { id: string; label: string }[] = [
  { id: 'pcos', label: 'PCOS' },
  { id: 'hypothyroidism', label: 'Hypothyroidism / Hashimoto\'s' },
  { id: 'hyperthyroidism', label: 'Hyperthyroidism' },
  { id: 'lactose_intolerance', label: 'Lactose Intolerance' },
  { id: 'celiac', label: 'Celiac Disease' },
  { id: 'gluten_sensitivity', label: 'Non-Celiac Gluten Sensitivity' },
  { id: 'ibs', label: 'IBS' },
  { id: 'ibd', label: 'IBD' },
  { id: 'gerd', label: 'GERD / Acid Reflux' },
  { id: 'diabetes_t2', label: 'Type 2 Diabetes' },
  { id: 'pre_diabetes', label: 'Pre-Diabetes' },
  { id: 'high_cholesterol', label: 'High Cholesterol / Heart Health' },
  { id: 'eczema', label: 'Eczema / Atopic Dermatitis' },
  { id: 'psoriasis', label: 'Psoriasis' },
  { id: 'acne', label: 'Acne' },
  { id: 'asthma', label: 'Asthma / Respiratory' },
  { id: 'migraines', label: 'Migraines / Headaches' },
  { id: 'anxiety_depression', label: 'Anxiety / Depression (dietary triggers)' },
  { id: 'autoimmune', label: 'Autoimmune conditions (general)' },
  { id: 'candida', label: 'Candida / Fungal concerns' },
  { id: 'none', label: 'None of the above' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// ─── Screen 3A – Food Allergens ───────────────────────────────────────────────
export const FOOD_ALLERGENS: string[] = [
  'Milk / Dairy',
  'Eggs',
  'Fish',
  'Shellfish',
  'Tree Nuts',
  'Peanuts',
  'Wheat',
  'Soybeans',
  'Sesame',
  'Other',
];

// ─── Screen 3B – Skin / Personal Care Allergens ───────────────────────────────
export const SKIN_ALLERGENS: string[] = [
  'Tree nuts (e.g. almond oil, shea butter)',
  'Peanut oil / extracts',
  'Sesame oil / seed',
  'Coconut oil / derivatives',
  'Soy (soybean oil, lecithin)',
  'Gluten',
  'Latex',
  'Fragrance / Parfum (incl. essential oils)',
  'Preservatives (parabens, formaldehyde releasers)',
  'Nickel / metals',
  'Lanolin',
  'Propylene glycol',
  'Other',
];

// ─── Screen 4 – Food Intolerances ────────────────────────────────────────────
export interface IntoleranceOption {
  id: string;
  label: string;
  subOptions?: { id: string; label: string }[];
}

export const FOOD_INTOLERANCES: IntoleranceOption[] = [
  {
    id: 'lactose',
    label: 'Lactose Intolerance',
    subOptions: [
      { id: 'none_at_all', label: "Can't digest any" },
      { id: 'moderate', label: 'Moderate (small amounts OK)' },
      { id: 'yogurt_ok', label: 'Only yogurt / hard cheese OK' },
    ],
  },
  {
    id: 'histamine',
    label: 'Histamine Sensitivity',
    subOptions: [
      { id: 'very', label: 'Very (avoid all fermented)' },
      { id: 'moderate', label: 'Moderate (fermented OK, no aged cheese)' },
      { id: 'mild', label: 'Mild (just want warnings)' },
    ],
  },
  {
    id: 'fodmap',
    label: 'FODMAP Sensitivity',
    subOptions: [
      { id: 'strict', label: 'Low (strict avoidance)' },
      { id: 'modified', label: 'Modified (some fruits/veggies OK)' },
      { id: 'unsure', label: "Not sure, just flag items" },
    ],
  },
  { id: 'salicylate', label: 'Salicylate Sensitivity' },
  { id: 'sulfite', label: 'Sulfite Sensitivity' },
  { id: 'sensory', label: 'Sensory Sensitivities (texture, temperature)' },
  { id: 'none', label: 'None of the above' },
];

// ─── Screen 5 – Dietary Patterns ─────────────────────────────────────────────
export const DIET_PATTERN_ROWS: { id: DietPatternId; label: string }[] = [
  { id: 'omnivore', label: 'Omnivore / No restrictions' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'keto', label: 'Keto / Low-carb' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'whole30', label: 'Whole30' },
  { id: 'clean_eating', label: 'Clean Eating' },
  { id: 'no_specific', label: "I don't follow a specific diet" },
];

export const DIET_NON_SPECIFIC: string[] = ['omnivore', 'no_specific'];

// ─── Screen 6 – Personal Care ─────────────────────────────────────────────────
export const SKIN_TYPES: string[] = [
  'Dry', 'Oily', 'Combination', 'Sensitive', 'Normal', 'Not sure',
];

export const SKIN_CONCERNS: string[] = [
  'Acne / Breakouts',
  'Eczema / Dermatitis',
  'Psoriasis',
  'Rosacea',
  'Anti-aging / Wrinkles',
  'Dark spots / Hyperpigmentation',
  'Sensitive / Reactive',
  'Dry / Dehydrated',
  'Oily / Acne-prone',
  'None / Just want clean products',
];

export const SKIN_INGREDIENTS_TO_AVOID: string[] = [
  'Fragrance / Parfum',
  'SLS',
  'Parabens',
  'Phthalates',
  'Formaldehyde-releasing preservatives',
  'Methylisothiazolinone (MI/MCI)',
  'Essential oils',
  'Retinoids',
  'Salicylic acid / BHA',
  'Benzoyl peroxide',
  'Alcohol denat',
  'Silicones',
  'Mineral oil / Petrolatum',
  'None / Just show clean scores',
];

export const HAIR_TYPES: string[] = [
  'Straight', 'Wavy', 'Curly', 'Coily / Textured', 'Not sure',
];

export const HAIR_CONCERNS: string[] = [
  'Dry / Damaged',
  'Oily / Greasy',
  'Frizz',
  'Breakage',
  'Color-treated',
  'Sensitive scalp',
  'Dandruff',
  'Fine / Thin',
  'Thick / Coarse',
  'None',
];

export const HAIR_INGREDIENTS_TO_AVOID: string[] = [
  'Sulfates (SLS / SLES)',
  'Silicones',
  'Parabens',
  'Fragrance',
  'Protein overload',
  'Heavy oils',
  'Alcohol',
  'None / Not sure',
];

// ─── Screen 7 – Household ─────────────────────────────────────────────────────
export const HOUSEHOLD_REASONS: string[] = [
  'Asthma / Respiratory concerns',
  'Skin conditions',
  'Allergies',
  'Chemical sensitivity',
  'Pregnancy / Young children',
  'Pets',
  'Environmental concern',
  'Just prefer non-toxic',
  'None / Not concerned',
];

export const HOUSEHOLD_INGREDIENTS: string[] = [
  'Chlorine / Bleach',
  'Ammonia',
  'Fragrance / Phthalates',
  'Phosphates',
  'Synthetic chemicals',
  'Carcinogens / Reproductive toxins',
  'Heavy metals',
  'Triclosan',
  'Concerned about ANY toxic exposure',
  'Prefer all-natural / plant-based',
  'None / Not concerned',
];

// ─── Screen 8 – Supplements ───────────────────────────────────────────────────
export const SUPPLEMENT_AVOIDS: string[] = [
  'Gelatin (animal-derived)',
  'Sugar / Artificial sweeteners',
  'Gluten',
  'Fillers / Binders (clean label)',
  'Allergen-derived binders (soy lecithin, tree nut oils)',
  'None / No preference',
];
