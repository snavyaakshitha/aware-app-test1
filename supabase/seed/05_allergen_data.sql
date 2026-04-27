-- Allergen Data Seed
-- Created: April 2026
-- Purpose: Initialize common allergen information

INSERT INTO public.allergen_types
  (allergen_name, scientific_name, description, created_at)
VALUES
  ('Peanut', 'Arachis hypogaea', 'Legume allergen, one of the most common food allergens', CURRENT_TIMESTAMP),
  ('Tree Nuts', NULL, 'Includes almond, walnut, cashew, pistachio, and other tree nuts', CURRENT_TIMESTAMP),
  ('Sesame', 'Sesamum indicum', 'Increasingly recognized allergen in food products', CURRENT_TIMESTAMP),
  ('Shellfish', NULL, 'Crustaceans and mollusks', CURRENT_TIMESTAMP),
  ('Fish', NULL, 'Finfish allergens', CURRENT_TIMESTAMP),
  ('Egg', NULL, 'Egg protein allergen', CURRENT_TIMESTAMP),
  ('Milk/Dairy', NULL, 'Casein and whey proteins', CURRENT_TIMESTAMP),
  ('Gluten/Wheat', NULL, 'Wheat protein allergen and gluten-containing grains', CURRENT_TIMESTAMP),
  ('Soy', 'Glycine max', 'Soy protein allergen', CURRENT_TIMESTAMP),
  ('Mustard', NULL, 'Mustard seed allergen', CURRENT_TIMESTAMP),
  ('Sulfites', NULL, 'Food preservative allergen', CURRENT_TIMESTAMP),
  ('Celery', NULL, 'Celery plant allergen', CURRENT_TIMESTAMP),
  ('Latex', NULL, 'Natural rubber latex allergen (cross-react with certain fruits)', CURRENT_TIMESTAMP),
  ('Fragrance Mix', NULL, 'Common cosmetic allergen (multiple fragrance compounds)', CURRENT_TIMESTAMP),
  ('Nickel', NULL, 'Metal allergen found in some cosmetic products and jewelry', CURRENT_TIMESTAMP)
ON CONFLICT (allergen_name) DO NOTHING;

INSERT INTO public.allergen_ingredients
  (allergen_id, ingredient_id, ingredient_name, concentration_percent, warning_label_required, created_at)
SELECT
  (SELECT id FROM public.allergen_types WHERE allergen_name = 'Fragrance Mix' LIMIT 1),
  (SELECT id FROM public.ingredients WHERE inci_name = 'Phthalates' LIMIT 1),
  'Phthalates',
  NULL,
  true,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM public.allergen_types WHERE allergen_name = 'Fragrance Mix')
  AND EXISTS (SELECT 1 FROM public.ingredients WHERE inci_name = 'Phthalates')
ON CONFLICT (allergen_id, ingredient_name) DO NOTHING;
