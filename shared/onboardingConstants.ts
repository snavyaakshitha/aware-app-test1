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

// ─── Screen 6 – Personal Care (Skincare) ──────────────────────────────────────
export interface SkinTypeOption {
  id: string;
  label: string;
}

export const SKIN_TYPES: SkinTypeOption[] = [
  { id: 'dry', label: 'Dry' },
  { id: 'oily', label: 'Oily' },
  { id: 'combination', label: 'Combination' },
  { id: 'sensitive', label: 'Sensitive' },
  { id: 'normal', label: 'Normal' },
  { id: 'not_sure', label: 'Not sure' },
];

export interface SkinConcernOption {
  id: string;
  label: string;
  emoji?: string;
}

export const SKIN_CONCERNS: SkinConcernOption[] = [
  { id: 'acne', label: 'Acne / Breakouts', emoji: '🤔' },
  { id: 'eczema', label: 'Eczema / Dermatitis', emoji: '😤' },
  { id: 'psoriasis', label: 'Psoriasis', emoji: '😤' },
  { id: 'rosacea', label: 'Rosacea', emoji: '🔴' },
  { id: 'aging', label: 'Anti-aging / Wrinkles', emoji: '⏰' },
  { id: 'hyperpigmentation', label: 'Dark spots / Hyperpigmentation', emoji: '⚫' },
  { id: 'sensitivity', label: 'Sensitive / Reactive', emoji: '⚠️' },
  { id: 'dryness', label: 'Dry / Dehydrated', emoji: '🏜️' },
  { id: 'oiliness', label: 'Oily / Acne-prone', emoji: '💦' },
  { id: 'none', label: 'None / Just want clean products', emoji: '✅' },
];

export interface SkinIngredientAvoidOption {
  id: string;
  label: string;
  concern_type: 'allergen' | 'irritant' | 'endocrine_disruptor' | 'photo_sensitizer' | 'comedogenic' | 'drying' | 'other';
}

export const SKIN_INGREDIENTS_TO_AVOID: SkinIngredientAvoidOption[] = [
  { id: 'fragrance', label: 'Fragrance / Parfum', concern_type: 'allergen' },
  { id: 'sls', label: 'SLS (Sodium Lauryl Sulfate)', concern_type: 'irritant' },
  { id: 'parabens', label: 'Parabens', concern_type: 'endocrine_disruptor' },
  { id: 'phthalates', label: 'Phthalates', concern_type: 'endocrine_disruptor' },
  { id: 'formaldehyde_releasers', label: 'Formaldehyde-releasing preservatives', concern_type: 'irritant' },
  { id: 'mit_mci', label: 'Methylisothiazolinone (MI/MCI)', concern_type: 'allergen' },
  { id: 'essential_oils', label: 'Essential oils', concern_type: 'allergen' },
  { id: 'retinoids', label: 'Retinoids (Retinol, Retinoid Acid)', concern_type: 'photo_sensitizer' },
  { id: 'salicylic_acid', label: 'Salicylic acid / BHA', concern_type: 'irritant' },
  { id: 'benzoyl_peroxide', label: 'Benzoyl peroxide', concern_type: 'irritant' },
  { id: 'alcohol_denat', label: 'Alcohol denat', concern_type: 'drying' },
  { id: 'silicones', label: 'Silicones', concern_type: 'other' },
  { id: 'mineral_oil', label: 'Mineral oil / Petrolatum', concern_type: 'comedogenic' },
  { id: 'none', label: 'None / Just show clean scores', concern_type: 'other' },
];

export const HAIR_TYPES: { id: string; label: string }[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'wavy', label: 'Wavy' },
  { id: 'curly', label: 'Curly' },
  { id: 'coily', label: 'Coily / Textured' },
  { id: 'not_sure', label: 'Not sure' },
];

export const HAIR_CONCERNS: { id: string; label: string }[] = [
  { id: 'dry_damaged', label: 'Dry / Damaged' },
  { id: 'oily', label: 'Oily / Greasy' },
  { id: 'frizz', label: 'Frizz' },
  { id: 'breakage', label: 'Breakage' },
  { id: 'color_treated', label: 'Color-treated' },
  { id: 'sensitive_scalp', label: 'Sensitive scalp' },
  { id: 'dandruff', label: 'Dandruff' },
  { id: 'fine_thin', label: 'Fine / Thin' },
  { id: 'thick_coarse', label: 'Thick / Coarse' },
  { id: 'none', label: 'None' },
];

export const HAIR_INGREDIENTS_TO_AVOID: { id: string; label: string }[] = [
  { id: 'sulfates', label: 'Sulfates (SLS / SLES)' },
  { id: 'silicones', label: 'Silicones' },
  { id: 'parabens', label: 'Parabens' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'protein_overload', label: 'Protein overload' },
  { id: 'heavy_oils', label: 'Heavy oils' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'none', label: 'None / Not sure' },
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
