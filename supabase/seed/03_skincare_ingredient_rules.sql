-- Skincare Ingredient Rules Seed Data
-- Created: April 2026
-- Purpose: Define concern types and health implications for skincare ingredients

INSERT INTO public.skincare_ingredient_rules
  (ingredient_name, concern_type, severity, health_concern, efficacy, sourced_from, created_at)
VALUES
  ('Sodium Lauryl Sulfate (SLS)', 'irritant', 'high', 'Can cause skin irritation, especially in sensitive individuals', false, 'EWG', CURRENT_TIMESTAMP),
  ('Methylisothiazolinone', 'sensitizer', 'medium', 'Can cause contact sensitization', false, 'CosIng', CURRENT_TIMESTAMP),
  ('Parabens', 'estrogenic_activity', 'medium', 'May disrupt endocrine system at high concentrations', false, 'Academic Studies', CURRENT_TIMESTAMP),
  ('Retinol', 'sun_sensitivity', 'medium', 'Increases photosensitivity; use with sunscreen', true, 'Cosmetic Safety', CURRENT_TIMESTAMP),
  ('Salicylic Acid', 'irritant', 'medium', 'Can cause dryness and irritation in sensitive skin', true, 'Cosmetic Safety', CURRENT_TIMESTAMP),
  ('BHT', 'allergen', 'low', 'Potential allergen for sensitive individuals', false, 'EWG', CURRENT_TIMESTAMP),
  ('Propylene Glycol', 'irritant', 'low', 'Rare sensitizer but can irritate some individuals', false, 'CosIng', CURRENT_TIMESTAMP),
  ('Niacinamide', 'efficacy', 'low', 'Generally well-tolerated; supports skin barrier', true, 'Academic Studies', CURRENT_TIMESTAMP),
  ('Aloe Vera', 'soothing', 'low', 'Natural botanical with soothing properties', true, 'Cosmetic Safety', CURRENT_TIMESTAMP),
  ('Chamomile Extract', 'soothing', 'low', 'Natural anti-inflammatory and soothing', true, 'Cosmetic Safety', CURRENT_TIMESTAMP)
ON CONFLICT (ingredient_name, concern_type) DO NOTHING;
