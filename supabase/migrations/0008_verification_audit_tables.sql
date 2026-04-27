-- PHASE 5: Data Verification and Audit Tables
-- Created: April 2026
-- Purpose: Track source URLs, verification status, and ingredient conflicts

CREATE TABLE IF NOT EXISTS public.source_urls (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,  -- e.g. 'regulatory','academic','government','api'
  organization TEXT,
  last_checked TIMESTAMPTZ,
  http_status INT,
  is_working BOOLEAN DEFAULT true,
  next_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Data verification log (audit trail for what was verified and when)
CREATE TABLE IF NOT EXISTS public.data_verification_logs (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id BIGINT,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('url_check','manual_review','api_sync','cross_reference')),
  verified_by TEXT,
  status TEXT CHECK (status IN ('passed','failed','warning','pending')),
  notes TEXT,
  verified_at TIMESTAMPTZ DEFAULT now()
);

-- Ingredient interaction conflicts (dangerous combinations)
CREATE TABLE IF NOT EXISTS public.ingredient_conflicts (
  id BIGSERIAL PRIMARY KEY,
  ingredient_1_name TEXT NOT NULL,
  ingredient_1_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_2_name TEXT NOT NULL,
  ingredient_2_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('chemical_reaction','toxicity_increase','efficacy_decrease','allergen_risk')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description TEXT NOT NULL,
  health_risk TEXT,
  mitigation TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ingredient_conflict_unique UNIQUE (ingredient_1_name, ingredient_2_name, conflict_type)
);

-- RLS Policies
ALTER TABLE public.source_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_urls_read ON public.source_urls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY verification_logs_read ON public.data_verification_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY ingredient_conflicts_read ON public.ingredient_conflicts FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY source_urls_write ON public.source_urls FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY verification_logs_write ON public.data_verification_logs FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY ingredient_conflicts_write ON public.ingredient_conflicts FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes
CREATE INDEX verification_logs_table_idx ON public.data_verification_logs(table_name);
CREATE INDEX ingredient_conflicts_ingredient1_idx ON public.ingredient_conflicts(ingredient_1_name);
CREATE INDEX ingredient_conflicts_ingredient2_idx ON public.ingredient_conflicts(ingredient_2_name);

-- RPC: Check ingredient conflicts for a set of ingredients
CREATE OR REPLACE FUNCTION public.check_ingredient_conflicts(p_ingredients TEXT[])
RETURNS TABLE (ingredient_1_name TEXT, ingredient_2_name TEXT, conflict_type TEXT, severity TEXT, description TEXT, health_risk TEXT) AS $$
SELECT
  ic.ingredient_1_name,
  ic.ingredient_2_name,
  ic.conflict_type,
  ic.severity,
  ic.description,
  ic.health_risk
FROM public.ingredient_conflicts ic
WHERE (ic.ingredient_1_name = ANY(p_ingredients) AND ic.ingredient_2_name = ANY(p_ingredients))
ORDER BY ic.severity DESC, ic.ingredient_1_name ASC;
$$ LANGUAGE SQL STABLE;
