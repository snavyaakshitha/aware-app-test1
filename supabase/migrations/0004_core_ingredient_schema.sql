-- PHASE 1: Core Ingredient Master Schema
-- Created: April 2026
-- Purpose: Central ingredient repository with identifiers, metadata, and sourcing

-- Master ingredients table
CREATE TABLE IF NOT EXISTS public.ingredients (
  id BIGSERIAL PRIMARY KEY,
  inci_name TEXT NOT NULL UNIQUE,
  common_names TEXT[] DEFAULT '{}',
  chemical_synonyms TEXT[] DEFAULT '{}',
  cas_number TEXT UNIQUE,
  ewg_id TEXT,
  incidecoder_id TEXT,
  ingredient_category TEXT NOT NULL DEFAULT 'uncategorized',
  molecular_formula TEXT,
  description TEXT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ
);

-- Ingredient source URLs and citations
CREATE TABLE IF NOT EXISTS public.ingredient_sources (
  id BIGSERIAL PRIMARY KEY,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('government','academic','manufacturer','regulatory','pubchem','ewg','other')),
  source_url TEXT NOT NULL,
  source_name TEXT,
  accessed_date DATE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingredient name aliases (INCI, IUPAC, common names)
CREATE TABLE IF NOT EXISTS public.ingredient_aliases (
  id BIGSERIAL PRIMARY KEY,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  alias_type TEXT NOT NULL CHECK (alias_type IN ('common_name','inci','iupac','trade_name','deprecated')),
  region TEXT DEFAULT 'global',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon users to read
CREATE POLICY ingredients_read ON public.ingredients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY ingredient_sources_read ON public.ingredient_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY ingredient_aliases_read ON public.ingredient_aliases FOR SELECT TO anon, authenticated USING (true);

-- Allow only authenticated admins to write (implement in app layer)
CREATE POLICY ingredients_write ON public.ingredients FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY ingredient_sources_write ON public.ingredient_sources FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY ingredient_aliases_write ON public.ingredient_aliases FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
