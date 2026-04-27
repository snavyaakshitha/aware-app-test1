-- PHASE 4: Product Category Rules and Concerns
-- Created: April 2026
-- Purpose: Define category-specific ingredient restrictions and concerns

CREATE TABLE IF NOT EXISTS public.product_categories (
  id BIGSERIAL PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  category_code TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Food additive specific rules (replaces clean_score_rules)
CREATE TABLE IF NOT EXISTS public.food_additive_rules (
  id BIGSERIAL PRIMARY KEY,
  ingredient_name TEXT NOT NULL,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
  concern_type TEXT NOT NULL CHECK (concern_type IN (
    'artificial_colorant','preservative','sweetener','flavor_enhancer',
    'emulsifier','thickener','bleaching_agent','additive',
    'nitrate_nitrite','heavy_metal','pesticide_residue','processing_aid',
    'dye','flour_improver','stabilizer','trans_fat'
  )),
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  health_effects TEXT[] DEFAULT '{}',
  regulatory_status TEXT,
  allowed_regions TEXT[] DEFAULT '{}',
  banned_regions TEXT[] DEFAULT '{}',
  daily_limit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT food_additive_unique UNIQUE (ingredient_name, concern_type)
);

-- Household product ingredient concerns
CREATE TABLE IF NOT EXISTS public.household_ingredient_rules (
  id BIGSERIAL PRIMARY KEY,
  ingredient_name TEXT NOT NULL,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
  concern_type TEXT NOT NULL,  -- e.g. 'toxic_fume','skin_irritant','respiratory_hazard'
  toxicity_level TEXT DEFAULT 'moderate' CHECK (toxicity_level IN ('low','moderate','high','severe')),
  exposure_route TEXT[] DEFAULT '{}',  -- inhalation, dermal, ingestion
  hazard_effects TEXT[] DEFAULT '{}',
  safety_measures TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Supplement ingredient rules
CREATE TABLE IF NOT EXISTS public.supplement_ingredient_rules (
  id BIGSERIAL PRIMARY KEY,
  ingredient_name TEXT NOT NULL,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
  concern_type TEXT NOT NULL,  -- e.g. 'heavy_metal','herb_interaction','overdose_risk'
  concentration_concern BOOLEAN DEFAULT false,
  max_daily_intake TEXT,
  drug_interactions TEXT[] DEFAULT '{}',
  contraindications TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Body care and personal care ingredient rules
CREATE TABLE IF NOT EXISTS public.bodycare_ingredient_rules (
  id BIGSERIAL PRIMARY KEY,
  ingredient_name TEXT NOT NULL,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
  concern_type TEXT NOT NULL,  -- e.g. 'hormone_disruption','sensitizer','irritant'
  skin_sensitivity BOOLEAN DEFAULT false,
  concentration_limit DECIMAL(5,2),
  age_restrictions TEXT,  -- e.g. 'not_for_children'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Update triggers
CREATE TRIGGER food_additive_rules_updated_at BEFORE UPDATE ON public.food_additive_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_additive_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_ingredient_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_ingredient_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodycare_ingredient_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_categories_read ON public.product_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY food_additive_rules_read ON public.food_additive_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY household_rules_read ON public.household_ingredient_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY supplement_rules_read ON public.supplement_ingredient_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY bodycare_rules_read ON public.bodycare_ingredient_rules FOR SELECT TO anon, authenticated USING (true);

-- Write policies (admin only)
CREATE POLICY product_categories_write ON public.product_categories FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY food_additive_rules_write ON public.food_additive_rules FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY household_rules_write ON public.household_ingredient_rules FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY supplement_rules_write ON public.supplement_ingredient_rules FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY bodycare_rules_write ON public.bodycare_ingredient_rules FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes
CREATE INDEX food_additive_ingredient_idx ON public.food_additive_rules(ingredient_id);
CREATE INDEX household_ingredient_idx ON public.household_ingredient_rules(ingredient_id);
CREATE INDEX supplement_ingredient_idx ON public.supplement_ingredient_rules(ingredient_id);
CREATE INDEX bodycare_ingredient_idx ON public.bodycare_ingredient_rules(ingredient_id);
