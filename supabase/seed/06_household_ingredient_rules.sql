-- Household Ingredient Rules Seed Data
-- Created: April 2026
-- Purpose: Define hazards and safety information for household product ingredients

INSERT INTO public.household_ingredient_rules
  (ingredient_name, concern_type, toxicity_level, exposure_route, hazard_effects, safety_measures, created_at)
VALUES
  ('Sodium Hypochlorite', 'toxic_fume', 'severe', ARRAY['inhalation', 'dermal', 'ingestion'],
   ARRAY['respiratory_irritation', 'corrosive_to_skin', 'toxic_chlorine_gas_if_mixed_with_acids'],
   ARRAY['use_in_ventilated_area', 'avoid_mixing_with_other_products', 'wear_gloves_and_eye_protection'],
   CURRENT_TIMESTAMP),
  ('Ammonia', 'toxic_fume', 'high', ARRAY['inhalation', 'dermal'],
   ARRAY['respiratory_irritation', 'eye_irritation', 'skin_irritation'],
   ARRAY['ensure_good_ventilation', 'wear_protective_equipment', 'avoid_skin_contact'],
   CURRENT_TIMESTAMP),
  ('Phenol', 'skin_irritant', 'high', ARRAY['dermal', 'ingestion', 'inhalation'],
   ARRAY['severe_skin_burns', 'systemic_toxicity', 'respiratory_effects'],
   ARRAY['avoid_skin_contact', 'use_in_ventilated_area', 'wear_protective_gloves'],
   CURRENT_TIMESTAMP),
  ('Xylene', 'respiratory_hazard', 'high', ARRAY['inhalation', 'dermal'],
   ARRAY['dizziness', 'respiratory_irritation', 'nervous_system_effects'],
   ARRAY['use_in_well_ventilated_space', 'avoid_prolonged_inhalation', 'wear_respiratory_protection'],
   CURRENT_TIMESTAMP),
  ('Formaldehyde', 'respiratory_hazard', 'high', ARRAY['inhalation', 'dermal'],
   ARRAY['carcinogenic', 'respiratory_irritation', 'allergic_dermatitis'],
   ARRAY['ensure_adequate_ventilation', 'minimize_exposure', 'use_protective_equipment'],
   CURRENT_TIMESTAMP),
  ('Triclosan', 'bioaccumulative', 'moderate', ARRAY['dermal', 'ingestion'],
   ARRAY['endocrine_disruption', 'bioaccumulative', 'antimicrobial_resistance'],
   ARRAY['rinse_thoroughly_after_use', 'avoid_prolonged_skin_contact'],
   CURRENT_TIMESTAMP)
ON CONFLICT (ingredient_name, concern_type) DO NOTHING;
