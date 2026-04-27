-- Food Additive Rules Seed Data
-- Created: April 2026
-- Purpose: Define food additive concerns and regulatory information

INSERT INTO public.food_additive_rules
  (ingredient_name, concern_type, risk_level, health_effects, regulatory_status, allowed_regions, created_at)
VALUES
  ('Tartrazine (FD&C Yellow No. 5)', 'artificial_colorant', 'medium', '{"health_concerns":["allergen","hyperactivity_in_children"]}'::jsonb, 'restricted_labeling', ARRAY['US', 'EU'], CURRENT_TIMESTAMP),
  ('Sunset Yellow (FD&C Yellow No. 6)', 'artificial_colorant', 'low', '{"health_concerns":["potential_allergen"]}'::jsonb, 'approved', ARRAY['US', 'EU', 'CA'], CURRENT_TIMESTAMP),
  ('Allura Red (FD&C Red No. 40)', 'artificial_colorant', 'low', '{"health_concerns":["potential_allergen"]}'::jsonb, 'approved', ARRAY['US', 'EU', 'CA'], CURRENT_TIMESTAMP),
  ('Monosodium Glutamate (MSG)', 'flavor_enhancer', 'low', '{"health_concerns":["msg_sensitivity_in_some_individuals"]}'::jsonb, 'approved_with_labeling', ARRAY['US', 'EU', 'CA'], CURRENT_TIMESTAMP),
  ('Sodium Nitrite', 'preservative', 'high', '{"health_concerns":["carcinogenic_potential","forms_nitrosamines"]}'::jsonb, 'approved_limited_use', ARRAY['US', 'EU', 'CA'], CURRENT_TIMESTAMP),
  ('Sodium Benzoate', 'preservative', 'low', '{"health_concerns":["metabolic_concern_in_combination_with_ascorbic_acid"]}'::jsonb, 'approved', ARRAY['US', 'EU', 'CA'], CURRENT_TIMESTAMP),
  ('Potassium Sorbate', 'preservative', 'low', '{"health_concerns":["rare_allergen"]}'::jsonb, 'approved', ARRAY['US', 'EU', 'CA'], CURRENT_TIMESTAMP),
  ('BPA (Bisphenol A)', 'chemical', 'high', '{"health_concerns":["hormone_disruption","reproductive_concerns"]}'::jsonb, 'restricted_foods', ARRAY[]::TEXT[], CURRENT_TIMESTAMP)
ON CONFLICT (ingredient_name, concern_type) DO NOTHING;
