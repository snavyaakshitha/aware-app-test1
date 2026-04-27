-- Basic Ingredients Seed Data
-- Created: April 2026
-- Purpose: Initialize common ingredients found in products

INSERT INTO public.ingredients
  (inci_name, description, ingredient_category, properties, created_at)
VALUES
  ('Water', 'Base ingredient found in most formulations', 'solvent', '{"classification":"natural","ecocert":true}'::jsonb, CURRENT_TIMESTAMP),
  ('Glycerin', 'Humectant for skin hydration', 'humectant', '{"classification":"natural"}'::jsonb, CURRENT_TIMESTAMP),
  ('Butylated Hydroxytoluene (BHT)', 'Synthetic preservative and antioxidant', 'preservative', '{"classification":"synthetic","synthetic_type":"antioxidant"}'::jsonb, CURRENT_TIMESTAMP),
  ('Propylene Glycol', 'Solvent and humectant', 'solvent', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Methylisothiazolinone', 'Preservative for aqueous products', 'preservative', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Sodium Lauryl Sulfate (SLS)', 'Surfactant and foaming agent', 'surfactant', '{"classification":"synthetic","irritant":true}'::jsonb, CURRENT_TIMESTAMP),
  ('Cetyl Alcohol', 'Emollient and thickening agent', 'emollient', '{"classification":"natural"}'::jsonb, CURRENT_TIMESTAMP),
  ('Salicylic Acid', 'Beta hydroxy acid for exfoliation', 'exfoliant', '{"classification":"chemical"}'::jsonb, CURRENT_TIMESTAMP),
  ('Titanium Dioxide', 'UV filter and pigment', 'uv_filter', '{"classification":"mineral"}'::jsonb, CURRENT_TIMESTAMP),
  ('Zinc Oxide', 'Mineral UV filter', 'uv_filter', '{"classification":"mineral"}'::jsonb, CURRENT_TIMESTAMP),
  ('Retinol', 'Vitamin A derivative for anti-aging', 'vitamin', '{"classification":"natural"}'::jsonb, CURRENT_TIMESTAMP),
  ('Niacinamide', 'Vitamin B3 derivative', 'vitamin', '{"classification":"natural"}'::jsonb, CURRENT_TIMESTAMP),
  ('Sodium Benzoate', 'Food preservative', 'preservative', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Potassium Sorbate', 'Food preservative', 'preservative', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Tartrazine (FD&C Yellow No. 5)', 'Food colorant', 'colorant', '{"classification":"synthetic","allergen":true}'::jsonb, CURRENT_TIMESTAMP),
  ('Sunset Yellow (FD&C Yellow No. 6)', 'Food colorant', 'colorant', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Allura Red (FD&C Red No. 40)', 'Food colorant', 'colorant', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Monosodium Glutamate (MSG)', 'Flavor enhancer', 'flavor_enhancer', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Sodium Nitrite', 'Food preservative', 'preservative', '{"classification":"synthetic","health_concern":"carcinogenic_potential"}'::jsonb, CURRENT_TIMESTAMP),
  ('BPA (Bisphenol A)', 'Endocrine disruptor found in packaging', 'chemical', '{"classification":"synthetic","health_concern":"hormone_disruption"}'::jsonb, CURRENT_TIMESTAMP),
  ('Phthalates', 'Plasticizers and fragrance fixatives', 'chemical', '{"classification":"synthetic","health_concern":"reproductive_concerns"}'::jsonb, CURRENT_TIMESTAMP),
  ('Parabens', 'Preservative family (methyl, propyl, butyl)', 'preservative', '{"classification":"synthetic","health_concern":"estrogenic_activity"}'::jsonb, CURRENT_TIMESTAMP),
  ('Phenoxyethanol', 'Preservative alternative to parabens', 'preservative', '{"classification":"synthetic"}'::jsonb, CURRENT_TIMESTAMP),
  ('Aloe Vera', 'Natural botanical extract', 'botanical', '{"classification":"natural","ecocert":true}'::jsonb, CURRENT_TIMESTAMP),
  ('Chamomile Extract', 'Natural plant extract for soothing', 'botanical', '{"classification":"natural","ecocert":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT (inci_name) DO NOTHING;
