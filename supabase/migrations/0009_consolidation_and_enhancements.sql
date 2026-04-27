-- PHASE 6: Consolidation, Enhancements, and Data Migration
-- Created: April 2026
-- Purpose: Enhance skincare rules, migrate old data, deprecate duplicate tables

-- Add new columns to skincare_ingredient_rules
ALTER TABLE public.skincare_ingredient_rules
ADD COLUMN IF NOT EXISTS ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ewg_hazard_score INT CHECK (ewg_hazard_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS verified_source_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS academic_studies INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS ifra_restrictions TEXT,
ADD COLUMN IF NOT EXISTS formulator_notes TEXT;

-- Mark duplicate tables as deprecated (don't drop—app code may reference them)
COMMENT ON TABLE public.profiles IS 'DEPRECATED: Use user_profiles instead. This table is kept for backwards compatibility but should not be used for new code.';
COMMENT ON TABLE public.scans IS 'DEPRECATED: Use scanned_history instead. This table is kept for backwards compatibility but should not be used for new code.';

-- Migrate data from old clean_score_rules to new food_additive_rules (if clean_score_rules exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clean_score_rules') THEN
    INSERT INTO public.food_additive_rules (ingredient_name, concern_type, risk_level, created_at, updated_at)
    SELECT DISTINCT
      ingredient_name,
      category as concern_type,
      'medium' as risk_level,
      now() as created_at,
      now() as updated_at
    FROM public.clean_score_rules
    ON CONFLICT (ingredient_name, concern_type) DO NOTHING;
  END IF;
END $$;

-- RPC: Get all ingredient concerns for a set of ingredients by category type
CREATE OR REPLACE FUNCTION public.get_all_ingredient_concerns(p_ingredients TEXT[], p_category_type TEXT DEFAULT 'all')
RETURNS TABLE (
  ingredient_name TEXT,
  concern_type TEXT,
  risk_level TEXT,
  health_effects TEXT[],
  source_table TEXT
) AS $$
SELECT DISTINCT
  ar.ingredient_name,
  ar.concern_type,
  ar.risk_level,
  ar.health_effects,
  'food_additive_rules' as source_table
FROM public.food_additive_rules ar
WHERE ar.ingredient_name = ANY(p_ingredients)
  AND (p_category_type = 'all' OR p_category_type = 'food')

UNION ALL

SELECT DISTINCT
  hr.ingredient_name,
  hr.concern_type,
  hr.toxicity_level,
  hr.hazard_effects,
  'household_ingredient_rules'
FROM public.household_ingredient_rules hr
WHERE hr.ingredient_name = ANY(p_ingredients)
  AND (p_category_type = 'all' OR p_category_type = 'household')

UNION ALL

SELECT DISTINCT
  sr.ingredient_name,
  sr.concern_type,
  'unknown',
  ARRAY[]::TEXT[],
  'supplement_ingredient_rules'
FROM public.supplement_ingredient_rules sr
WHERE sr.ingredient_name = ANY(p_ingredients)
  AND (p_category_type = 'all' OR p_category_type = 'supplement')

UNION ALL

SELECT DISTINCT
  br.ingredient_name,
  br.concern_type,
  'unknown',
  ARRAY[]::TEXT[],
  'bodycare_ingredient_rules'
FROM public.bodycare_ingredient_rules br
WHERE br.ingredient_name = ANY(p_ingredients)
  AND (p_category_type = 'all' OR p_category_type = 'bodycare')

ORDER BY ingredient_name, risk_level DESC;
$$ LANGUAGE SQL STABLE;

-- RPC: Check if ingredients are banned worldwide or in specific country
CREATE OR REPLACE FUNCTION public.check_banned_ingredients_worldwide(p_ingredients TEXT[], p_country_code TEXT DEFAULT NULL)
RETURNS TABLE (
  ingredient_name TEXT,
  country_code TEXT,
  ban_status TEXT,
  effective_date DATE,
  regulation_link TEXT,
  reason TEXT
) AS $$
SELECT
  bic.ingredient_name,
  bic.country_code,
  bic.ban_status,
  bic.effective_date,
  bic.regulation_link,
  bic.reason
FROM public.banned_ingredients_by_country bic
WHERE bic.ingredient_name = ANY(p_ingredients)
  AND bic.active = true
  AND (p_country_code IS NULL OR bic.country_code = p_country_code)
ORDER BY bic.country_code, bic.ingredient_name;
$$ LANGUAGE SQL STABLE;
