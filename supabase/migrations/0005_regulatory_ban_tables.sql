-- PHASE 2: Regulatory Bodies and Ban Tables
-- Created: April 2026
-- Purpose: Track ingredient bans by country/regulatory body

CREATE TABLE IF NOT EXISTS public.regulatory_bodies (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,  -- e.g. 'FDA', 'EMA', 'HEALTH_CANADA'
  name TEXT NOT NULL,
  country TEXT,
  jurisdiction_type TEXT NOT NULL CHECK (jurisdiction_type IN ('national','regional','international')),
  website_url TEXT,
  contact_email TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Country-specific ingredient bans
CREATE TABLE IF NOT EXISTS public.banned_ingredients_by_country (
  id BIGSERIAL PRIMARY KEY,
  ingredient_name TEXT NOT NULL,
  ingredient_id BIGINT REFERENCES public.ingredients(id) ON DELETE SET NULL,
  country_code TEXT NOT NULL,  -- ISO 3166-1 alpha-2
  ban_status TEXT NOT NULL CHECK (ban_status IN ('banned','restricted','regulated')),
  effective_date DATE,
  regulatory_body_id BIGINT REFERENCES public.regulatory_bodies(id),
  active BOOLEAN DEFAULT true,  -- false = ban lifted, kept for audit trail
  last_reviewed DATE,
  regulation_link TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT banned_ingredients_unique UNIQUE (country_code, ingredient_name, ban_status)
);

-- Worldwide banned products (recalls, safety bans, regulatory withdrawals)
CREATE TABLE IF NOT EXISTS public.banned_products_worldwide (
  id BIGSERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  barcode TEXT,
  countries_banned TEXT[] NOT NULL,
  ban_reason TEXT NOT NULL,
  recall_link TEXT,
  ban_date DATE,
  recall_type TEXT CHECK (recall_type IN ('safety_recall','misleading_claims','regulatory_ban','voluntary_withdrawal','contamination')),
  category TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','under_review')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Update triggers
CREATE TRIGGER banned_ingredients_updated_at BEFORE UPDATE ON public.banned_ingredients_by_country
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER banned_products_updated_at BEFORE UPDATE ON public.banned_products_worldwide
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.regulatory_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_ingredients_by_country ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_products_worldwide ENABLE ROW LEVEL SECURITY;

CREATE POLICY regulatory_bodies_read ON public.regulatory_bodies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY banned_ingredients_read ON public.banned_ingredients_by_country FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY banned_products_read ON public.banned_products_worldwide FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY regulatory_bodies_write ON public.regulatory_bodies FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY banned_ingredients_write ON public.banned_ingredients_by_country FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY banned_products_write ON public.banned_products_worldwide FOR INSERT, UPDATE, DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for common queries
CREATE INDEX banned_ingredients_country_idx ON public.banned_ingredients_by_country(country_code, active);
CREATE INDEX banned_ingredients_name_idx ON public.banned_ingredients_by_country(ingredient_name);
CREATE INDEX banned_products_category_idx ON public.banned_products_worldwide(category);
CREATE INDEX banned_products_barcode_idx ON public.banned_products_worldwide(barcode);
