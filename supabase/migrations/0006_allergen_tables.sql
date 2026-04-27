-- PHASE 3: Allergen and Cross-Reactivity Schema
-- Created: April 2026
-- Purpose: Track allergen definitions and ingredient-allergen relationships

CREATE TABLE IF NOT EXISTS public.allergen_definitions (
  id BIGSERIAL PRIMARY KEY,
  allergen_code TEXT NOT NULL UNIQUE,  -- e.g. 'MILK', 'PEANUT', 'TREE_NUT', 'LATEX'
  display_name TEXT NOT NULL,
  is_food_allergen BOOLEAN DEFAULT false,
  is_contact_allergen BOOLEAN DEFAULT false,
  is_inhalant_allergen BOOLEAN DEFAULT false,
  prevalence_percent FLOAT,  -- population prevalence
  symptoms TEXT[] DEFAULT '{}',
  regulatory_mention TEXT,  -- e.g. 'FDA Top 9', 'EU-14'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Links ingredients to allergens with relationship type
CREATE TABLE IF NOT EXISTS public.ingredient_allergen_relationships (
  id BIGSERIAL PRIMARY KEY,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  allergen_id BIGINT REFERENCES public.allergen_definitions(id) ON DELETE CASCADE,
  allergen_code TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'contains','cross_reacts','derived_from','labeled_as','may_contain','processed_on_shared_equipment'
  )),
  confidence INT DEFAULT 80 CHECK (confidence BETWEEN 0 AND 100),
  notes TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.allergen_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_allergen_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY allergen_definitions_read ON public.allergen_definitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY ingredient_allergen_read ON public.ingredient_allergen_relationships FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY allergen_definitions_write ON public.allergen_definitions FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY ingredient_allergen_write ON public.ingredient_allergen_relationships FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes
CREATE INDEX ingredient_allergen_ingredient_idx ON public.ingredient_allergen_relationships(ingredient_id);
CREATE INDEX ingredient_allergen_allergen_idx ON public.ingredient_allergen_relationships(allergen_code);

-- RPC: Get allergens for a set of ingredients
CREATE OR REPLACE FUNCTION public.get_allergens_for_ingredients(p_ingredients TEXT[])
RETURNS TABLE (ingredient_name TEXT, allergen_code TEXT, display_name TEXT, relationship_type TEXT, confidence INT) AS $$
SELECT DISTINCT
  iar.ingredient_name,
  ad.allergen_code,
  ad.display_name,
  iar.relationship_type,
  iar.confidence
FROM public.ingredient_allergen_relationships iar
JOIN public.allergen_definitions ad ON iar.allergen_id = ad.id
WHERE iar.ingredient_name = ANY(p_ingredients)
ORDER BY iar.confidence DESC, ad.display_name ASC;
$$ LANGUAGE SQL STABLE;
