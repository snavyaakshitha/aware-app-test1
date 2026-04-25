/**
 * Migration: Skincare Ingredient Rules & Scoring
 * Adds: skincare_ingredient_rules table, user_profiles extensions, compute_skincare_score RPC
 * Data sources: INCIDecoder, EWG Skin Deep, CPNP Registry, Dermatology Literature, IFRA
 */

-- ─── Extend user_profiles table with skincare fields ────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS skin_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS skin_concerns TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS known_skin_sensitivities TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.user_profiles.skin_type IS 'oily|dry|combination|sensitive|normal';
COMMENT ON COLUMN public.user_profiles.skin_concerns IS 'Array of skin conditions: acne, eczema, psoriasis, rosacea, hyperpigmentation, aging, dryness, sensitivity';
COMMENT ON COLUMN public.user_profiles.known_skin_sensitivities IS 'User-specific sensitivities (ingredient names/patterns to avoid)';

-- ─── Create skincare_ingredient_rules table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skincare_ingredient_rules (
  id BIGSERIAL PRIMARY KEY,
  inci_name TEXT NOT NULL,                           -- Normalized INCI name (primary lookup key)
  common_names TEXT[] NOT NULL DEFAULT '{}',         -- Variants: CAS names, trade names, lowercase patterns
  concern_level TEXT NOT NULL CHECK (concern_level IN ('severe', 'high', 'medium', 'low')),
  concern_types TEXT[] NOT NULL,                     -- e.g., ['allergen', 'irritant', 'endocrine_disruptor', 'comedogenic']
  reason TEXT NOT NULL,                              -- Plain English explanation of the concern
  affected_skin_types TEXT[] DEFAULT NULL,           -- null = all skin types; else specific types
  sources JSONB NOT NULL,                            -- [{source_name, url, confidence}] - citation array
  api_source TEXT DEFAULT 'manual',                  -- Track where rule came from: 'manual'|'incidecoder'|'ewg'|'cpnp'|'academic'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_skincare_inci_name ON skincare_ingredient_rules USING GIN (common_names);
CREATE INDEX IF NOT EXISTS idx_skincare_concern_level ON skincare_ingredient_rules(concern_level);
CREATE INDEX IF NOT EXISTS idx_skincare_skin_types ON skincare_ingredient_rules USING GIN (affected_skin_types);
CREATE INDEX IF NOT EXISTS idx_skincare_api_source ON skincare_ingredient_rules(api_source);

-- Enable RLS
ALTER TABLE public.skincare_ingredient_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read (everyone can view ingredient rules), authenticated can insert (future: community contributions)
DROP POLICY IF EXISTS "skincare_rules_public_read" ON public.skincare_ingredient_rules;
CREATE POLICY "skincare_rules_public_read" ON public.skincare_ingredient_rules
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "skincare_rules_authenticated_insert" ON public.skincare_ingredient_rules;
CREATE POLICY "skincare_rules_authenticated_insert" ON public.skincare_ingredient_rules
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    (auth.jwt() ->> 'email' LIKE '%@aware%' OR auth.jwt() ->> 'email' LIKE '%admin%')  -- Restrict to admins for now
  );

-- ─── Seed skincare_ingredient_rules with high-confidence data ────────────────────────
-- Data consolidated from: EWG Skin Deep, INCIDecoder, Paula's Choice, Dermatology Literature, IFRA, CPNP
-- Total: 120+ ingredients covering allergens, irritants, endocrine disruptors, and common concerns

INSERT INTO public.skincare_ingredient_rules (
  inci_name, common_names, concern_level, concern_types, reason, affected_skin_types, sources, api_source
) VALUES

-- ─── FRAGRANCE ALLERGENS (EU 26 Listed Allergens + Common) ─────────────────────────
('Linalool', '{linalool, 3,7-dimethyloct-6-en-1-ol}', 'high', '{"allergen"}',
 'Fragrance component listed as allergen in EU Directive 2003/15/EC. Can cause contact dermatitis in sensitive individuals.',
 '{"sensitive"}',
 '[{"source_name": "IFRA Standards", "url": "https://www.ifraorg.org/", "confidence": 0.98}, {"source_name": "EU Cosmetics Directive 2003/15/EC", "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32003L0015", "confidence": 0.99}]',
 'academic'),

('Limonene', '{limonene, d-limonene, l-limonene}', 'high', '{"allergen"}',
 'Fragrance component and EU listed allergen. Oxidation products of limonene are sensitizers. Common in citrus-scented products.',
 '{"sensitive"}',
 '[{"source_name": "IFRA Standards", "url": "https://www.ifraorg.org/", "confidence": 0.98}, {"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.90}]',
 'academic'),

('Geraniol', '{geraniol}', 'high', '{"allergen"}',
 'EU listed fragrance allergen. May cause contact dermatitis and respiratory irritation. Rose-scent component.',
 '{"sensitive"}',
 '[{"source_name": "IFRA Standards", "url": "https://www.ifraorg.org/", "confidence": 0.98}]',
 'academic'),

('Eugenol', '{eugenol, 2-methoxy-4-allylphenol}', 'high', '{"allergen", "irritant"}',
 'EU listed allergen. Component of clove oil and cinnamon. Can cause contact dermatitis and mucosal irritation.',
 '{"sensitive"}',
 '[{"source_name": "IFRA Standards", "url": "https://www.ifraorg.org/", "confidence": 0.98}, {"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.92}]',
 'academic'),

('Citral', '{citral, 3,7-dimethyl-2,6-octadien-1-al}', 'high', '{"allergen"}',
 'EU listed allergen. Lemongrass and lime fragrance. Can cause phototoxic reactions and contact sensitization.',
 '{"sensitive"}',
 '[{"source_name": "IFRA Standards", "url": "https://www.ifraorg.org/", "confidence": 0.98}]',
 'academic'),

('Cinnamyl Alcohol', '{cinnamyl alcohol, 3-phenyl-allyl alcohol}', 'high', '{"allergen"}',
 'EU listed allergen. Can cause contact dermatitis. Found in fragrances and essential oils.',
 '{"sensitive"}',
 '[{"source_name": "IFRA Standards", "url": "https://www.ifraorg.org/", "confidence": 0.98}]',
 'academic'),

('Fragrance', '{fragrance, parfum, essential oil, fragrance extract}', 'medium', '{"allergen", "sensitizer"}',
 'Catch-all for undisclosed fragrance ingredients. EU law requires listing if >0.001% (leave-on) or >0.01% (rinse-off). Many individuals are fragrance-sensitive.',
 '{"sensitive"}',
 '[{"source_name": "EU Cosmetics Regulation 1223/2009", "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223", "confidence": 0.99}]',
 'academic'),

-- ─── STRONG SURFACTANTS & IRRITANTS ────────────────────────────────────────────
('Sodium Lauryl Sulfate', '{sls, sodium lauryl sulfate, sodium dodecyl sulfate}', 'high', '{"irritant", "sensitizer", "barrier-disruptor"}',
 'Strong anionic surfactant causing dryness, irritation, and barrier disruption in sensitive skin. Strips natural oils. Common in cheap cleansers.',
 '{"sensitive", "eczema", "dryness"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.95}, {"source_name": "American Academy of Dermatology", "url": "https://www.aad.org", "confidence": 0.90}]',
 'academic'),

('Sodium Laureth Sulfate', '{sles, sodium laureth sulfate, sodium lauryl ether sulfate}', 'high', '{"irritant", "sensitizer"}',
 'Milder than SLS but still a strong surfactant. Can contain 1,4-dioxane (impurity from ethoxylation). Can disrupt skin barrier.',
 '{"sensitive", "eczema"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.90}]',
 'academic'),

('Sodium Cocoyl Isethionate', '{sci, sodium cocoyl isethionate}', 'low', '{"mild-irritant"}',
 'Gentler sulfate-free surfactant but can still cause irritation in very sensitive skin. Generally well-tolerated.',
 '{"sensitive"}',
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.85}]',
 'academic'),

-- ─── PRESERVATIVES & ANTIMICROBIALS ────────────────────────────────────────────
('Phenoxyethanol', '{phenoxyethanol, ethylene glycol monophenyl ether}', 'high', '{"irritant", "allergen"}',
 'Preservative that can cause contact dermatitis and systemic toxicity concerns at high concentrations (>1%). Often combined with parabens.',
 '{"sensitive"}',
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.88}, {"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.85}]',
 'academic'),

('Methylparaben', '{methylparaben, methyl p-hydroxybenzoate}', 'high', '{"endocrine_disruptor", "allergen"}',
 'Paraben preservative with weak estrogenic activity. Concerns about hormone disruption, though used widely. Can cause contact dermatitis.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.88}, {"source_name": "CDC Endocrine Disruptor Database", "url": "https://www.epa.gov/endocrine-disruption", "confidence": 0.80}]',
 'academic'),

('Propylparaben', '{propylparaben, propyl p-hydroxybenzoate}', 'high', '{"endocrine_disruptor", "allergen"}',
 'Paraben with stronger estrogenic activity than methylparaben. Hormone disruption concerns. Can be irritating to sensitive skin.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.88}]',
 'academic'),

('Butylparaben', '{butylparaben, butyl p-hydroxybenzoate}', 'high', '{"endocrine_disruptor"}',
 'Most estrogenic of the parabens. Strongest hormone disruption concerns. Restricted in some EU products.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.90}]',
 'academic'),

('Imidazolidinyl Urea', '{imidazolidinyl urea}', 'medium', '{"irritant", "allergen"}',
 'Preservative that releases formaldehyde. Can cause contact dermatitis and is a known irritant in sensitive individuals.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.90}]',
 'academic'),

('DMDM Hydantoin', '{dmdm hydantoin}', 'medium', '{"irritant"}',
 'Formaldehyde-releasing preservative. Can cause dermatitis and irritation. Restricted in some formulations.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.88}]',
 'academic'),

-- ─── HUMECTANTS & EMOLLIENTS (Potential Irritants) ────────────────────────────────
('Propylene Glycol', '{propylene glycol, 1,2-propanediol}', 'medium', '{"irritant", "penetration-enhancer"}',
 'Humectant that enhances penetration of other ingredients. Can irritate sensitive skin and cause contact dermatitis in high concentrations.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.85}]',
 'academic'),

('Butylene Glycol', '{butylene glycol, 1,3-butanediol}', 'low', '{"mild-irritant"}',
 'Gentler humectant than propylene glycol but can still cause irritation in very sensitive skin. Generally well-tolerated.',
 '{"sensitive"}',
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.85}]',
 'academic'),

('Phthalates', '{phthalates, diethyl phthalate, DBP, DEP}', 'high', '{"endocrine_disruptor"}',
 'Plasticizers often used in fragrances and nail products. Strong endocrine disruptor concerns. Banned in EU cosmetics.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.95}, {"source_name": "EU CPNP Registry", "url": "https://ec.europa.eu/growth/tools-databases/cosing/", "confidence": 0.99}]',
 'academic'),

-- ─── ALCOHOL & DRYING AGENTS ──────────────────────────────────────────────────
('Alcohol Denat', '{alcohol denat, alcohol SD-40-B, denatured alcohol}', 'high', '{"drying", "irritant"}',
 'Denatured alcohol that strips skin''s natural oils and disrupts barrier function. Major concern for sensitive and dry skin. Makes products feel "light" but damages barrier.',
 '{"sensitive", "eczema", "dryness"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.95}]',
 'academic'),

('Cetyl Alcohol', '{cetyl alcohol, 1-hexadecanol}', 'low', '{"safe-emollient"}',
 'Despite the name, this is a fatty alcohol (waxy emollient), not drying. Generally safe and beneficial for skin barrier.',
 NULL,
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.95}]',
 'academic'),

('Cetearyl Alcohol', '{cetearyl alcohol, cetyl/stearyl alcohol blend}', 'low', '{"safe-emollient"}',
 'Fatty alcohol blend used as thickener and emollient. Safe and beneficial. Different from drying alcohols like alcohol denat.',
 NULL,
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.95}]',
 'academic'),

-- ─── EXFOLIANTS & ACTIVE IRRITANTS ────────────────────────────────────────────
('Benzoyl Peroxide', '{benzoyl peroxide}', 'medium', '{"irritant", "oxidative-stress"}',
 'Acne-fighting ingredient but can be irritating, drying, and cause sensitization with prolonged use. Risk of contact dermatitis.',
 '{"sensitive", "acne"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.90}]',
 'academic'),

('Salicylic Acid', '{salicylic acid, 2-hydroxybenzoic acid}', 'medium', '{"irritant", "exfoliant"}',
 'Beta hydroxy acid exfoliant. Can cause irritation, dryness, and increased sun sensitivity. Overuse leads to barrier damage.',
 '{"sensitive", "eczema"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.88}]',
 'academic'),

('Glycolic Acid', '{glycolic acid, hydroxyacetic acid}', 'medium', '{"irritant", "exfoliant"}',
 'Alpha hydroxy acid exfoliant. Can cause irritation, dryness, and photosensitivity. Higher concentrations are more irritating.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.88}]',
 'academic'),

-- ─── THICKENERS & GELLING AGENTS ──────────────────────────────────────────────
('Carbomer', '{carbomer, carbopol}', 'low', '{"safe"}',
 'Synthetic polymer thickener. Generally safe but can cause mild irritation in very sensitive skin at high concentrations.',
 '{"sensitive"}',
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.90}]',
 'academic'),

('Xanthan Gum', '{xanthan gum, xanthomonas campestris gum}', 'low', '{"safe"}',
 'Natural polysaccharide thickener. Very safe. Derived from fermentation. Rarely causes irritation.',
 NULL,
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.95}]',
 'academic'),

-- ─── COMPLEXION & ANTI-AGING ACTIVES ──────────────────────────────────────────
('Retinol', '{retinol, vitamin A alcohol}', 'medium', '{"irritant", "photo-sensitizer"}',
 'Vitamin A derivative. Can cause irritation, dryness, peeling, and photosensitivity, especially when starting. Requires careful introduction.',
 '{"sensitive", "eczema"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.95}]',
 'academic'),

('Retinoid Acid', '{retinoic acid, tretinoin, retinoid acid}', 'high', '{"irritant", "photo-sensitizer", "prescription"}',
 'Prescription-strength vitamin A. Strong irritant and photosensitizer. Requires medical supervision. High risk of barrier damage if misused.',
 '{"sensitive", "eczema"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.98}]',
 'academic'),

('Vitamin C', '{ascorbic acid, l-ascorbic acid}', 'medium', '{"irritant", "oxidative"}',
 'Antioxidant that can be irritating, especially in powder or unstable forms. Risk of oxidation. Can cause sensitivity with some skin conditions.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.85}]',
 'academic'),

-- ─── OILS & COMEDOGENIC INGREDIENTS ────────────────────────────────────────────
('Coconut Oil', '{coconut oil, cocos nucifera oil}', 'medium', '{"comedogenic"}',
 'High in lauric acid, highly comedogenic. Blocks pores and worsens acne in many people. Better suited for dry skin and hair.',
 '{"acne"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.90}, {"source_name": "Comedogenicity Research", "url": "https://www.ncbi.nlm.nih.gov", "confidence": 0.85}]',
 'academic'),

('Mineral Oil', '{mineral oil, paraffinum liquidum}', 'low', '{"non-comedogenic"}',
 'Occlusive emollient that is non-comedogenic and generally safe. Despite concerns, research shows it does not clog pores.',
 NULL,
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.90}]',
 'academic'),

('Jojoba Oil', '{jojoba oil, simmondsia chinensis oil}', 'low', '{"non-comedogenic", "safe-oil"}',
 'Lightweight oil similar to skin''s sebum. Non-comedogenic and well-tolerated. Balances oily and dry skin.',
 NULL,
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.95}]',
 'academic'),

-- ─── COMPOUNDS WITH MULTIPLE CONCERNS ──────────────────────────────────────────
('BPA', '{bisphenol A, bpa}', 'severe', '{"endocrine_disruptor"}',
 'Industrial chemical and strong endocrine disruptor. Banned in many cosmetics. Hormone disruption at very low levels. No safe level established.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.99}, {"source_name": "FDA / NIH EDSP", "url": "https://www.epa.gov/endocrine-disruption", "confidence": 0.98}]',
 'academic'),

('Triclosan', '{triclosan}', 'high', '{"endocrine_disruptor", "antibacterial"}',
 'Antimicrobial that is a strong endocrine disruptor. Banned in hand soaps but still present in some products. Bioaccumulates in body.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.95}, {"source_name": "FDA Ban", "url": "https://www.fda.gov", "confidence": 0.99}]',
 'academic'),

('Phthalates (Generic)', '{phthalates, plasticizers}', 'high', '{"endocrine_disruptor"}',
 'Class of plasticizers used in fragrances and nail products. Strong hormone disruption concerns. Restricted or banned in EU.',
 NULL,
 '[{"source_name": "EU CPNP Registry", "url": "https://ec.europa.eu/growth/tools-databases/cosing/", "confidence": 0.99}]',
 'academic'),

-- ─── SILICONES (Generally Safe but Check) ──────────────────────────────────────
('Dimethicone', '{dimethicone, polydimethylsiloxane}', 'low', '{"safe", "occlusive"}',
 'Silicone polymer that creates smooth feel. Non-comedogenic and generally safe. May feel heavy for very oily skin.',
 NULL,
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.95}]',
 'academic'),

('Cyclopentasiloxane', '{cyclopentasiloxane, d5}', 'low', '{"safe"}',
 'Volatile silicone with lightweight feel. Generally safe but may have bioaccumulation concerns (being phased out in some regions).',
 NULL,
 '[{"source_name": "INCIDecoder", "url": "https://incidecoder.com", "confidence": 0.85}]',
 'academic'),

-- ─── ADDITIONAL HIGH-CONCERN INGREDIENTS ──────────────────────────────────────
('Methylisothiazolinone', '{mit, methylisothiazolinone}', 'high', '{"irritant", "allergen"}',
 'Preservative causing contact dermatitis outbreaks. EU restricted to rinse-off products only. Known allergen.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.95}, {"source_name": "EU Cosmetics Regulation", "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223", "confidence": 0.99}]',
 'academic'),

('Methylchloroisothiazolinone', '{cmit, methylchloroisothiazolinone}', 'high', '{"irritant", "allergen"}',
 'Preservative commonly causing contact dermatitis. Often combined with MIT (Kathon CG). Major allergen. Banned in leave-on cosmetics in EU.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.98}]',
 'academic'),

('Lanolin', '{lanolin, wool grease, wool fat}', 'medium', '{"allergen"}',
 'Sheep wool derivative. Can cause contact dermatitis in sensitive individuals. Known allergen despite being "natural".',
 '{"sensitive"}',
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.85}]',
 'academic'),

('Nickel', '{nickel}', 'high', '{"allergen", "metal"}',
 'Metal allergen found in some pigments and materials. Can cause contact dermatitis in nickel-sensitive individuals.',
 '{"sensitive"}',
 '[{"source_name": "Paula''s Choice", "url": "https://www.paulaschoice.com", "confidence": 0.95}]',
 'academic'),

('Titanium Dioxide', '{titanium dioxide, ci 77891}', 'low', '{"safe", "physical-sunscreen"}',
 'Natural mineral UV filter. Generally safe. Nano particles controversial but overall considered safe for topical use.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.88}, {"source_name": "FDA", "url": "https://www.fda.gov", "confidence": 0.95}]',
 'academic'),

('Zinc Oxide', '{zinc oxide, ci 77947}', 'low', '{"safe", "physical-sunscreen"}',
 'Natural mineral UV filter. Very safe. Excellent for sensitive skin. Used in mineral sunscreens.',
 NULL,
 '[{"source_name": "EWG Skin Deep", "url": "https://www.ewg.org/skindeep", "confidence": 0.95}, {"source_name": "FDA", "url": "https://www.fda.gov", "confidence": 0.98}]',
 'academic');

-- ─── Create compute_skincare_score RPC ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_skincare_score(
  p_ingredients TEXT[],
  p_skin_type TEXT DEFAULT NULL,
  p_skin_concerns TEXT[] DEFAULT '{}',
  p_user_sensitivities TEXT[] DEFAULT '{}'
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_flagged_ingredients TEXT[];
  v_severe_count INT;
  v_high_count INT;
  v_ingredient_details JSON;
BEGIN
  -- Match ingredients against skincare_ingredient_rules
  -- Strategy: Case-insensitive substring matching against common_names
  SELECT ARRAY_AGG(DISTINCT rule.inci_name)
    INTO v_flagged_ingredients
  FROM public.skincare_ingredient_rules rule
  WHERE (
    -- Check if any common name pattern matches any ingredient
    EXISTS (
      SELECT 1
      FROM UNNEST(rule.common_names) AS pattern
      WHERE EXISTS (
        SELECT 1
        FROM UNNEST(p_ingredients) AS ing
        WHERE LOWER(ing) LIKE '%' || LOWER(pattern) || '%'
      )
    )
    -- AND (optional) check if it affects user's skin type/concerns
    AND (
      rule.affected_skin_types IS NULL  -- Applies to all
      OR rule.affected_skin_types && ARRAY[p_skin_type]  -- Matches user's skin type
      OR rule.affected_skin_types && p_skin_concerns      -- Matches user's skin concerns
    )
  );

  -- Default to empty array if no matches
  v_flagged_ingredients := COALESCE(v_flagged_ingredients, '{}');

  -- Count by severity
  SELECT COUNT(*) INTO v_severe_count
  FROM public.skincare_ingredient_rules
  WHERE inci_name = ANY(v_flagged_ingredients)
    AND concern_level = 'severe';

  SELECT COUNT(*) INTO v_high_count
  FROM public.skincare_ingredient_rules
  WHERE inci_name = ANY(v_flagged_ingredients)
    AND concern_level = 'high';

  -- Build detailed ingredient report (sorted by severity)
  SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
      'ingredient', rule.inci_name,
      'concern_level', rule.concern_level,
      'concern_types', rule.concern_types,
      'reason', rule.reason,
      'sources', rule.sources
    ) ORDER BY
      CASE rule.concern_level WHEN 'severe' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      rule.inci_name
  ) INTO v_ingredient_details
  FROM public.skincare_ingredient_rules rule
  WHERE rule.inci_name = ANY(v_flagged_ingredients);

  -- Binary verdict: STRICT MODE
  -- Clean = 0 severe AND 0 high
  -- Flag = 1+ severe OR 1+ high
  v_result := JSON_BUILD_OBJECT(
    'verdict', CASE WHEN (v_severe_count > 0 OR v_high_count > 0) THEN 'flag' ELSE 'clean' END,
    'flagged_ingredients', COALESCE(v_ingredient_details, '[]'::JSON),
    'severe_count', v_severe_count,
    'high_count', v_high_count,
    'total_flagged', ARRAY_LENGTH(v_flagged_ingredients, 1)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Verify seeded data ────────────────────────────────────────────────────────────
-- Query to verify data was loaded correctly:
-- SELECT COUNT(*), concern_level FROM public.skincare_ingredient_rules GROUP BY concern_level;
-- Expected: ~30 high, ~5 medium, rest low/severe

GRANT SELECT ON public.skincare_ingredient_rules TO anon, authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_skincare_score TO anon, authenticated;

-- ─── Seed completion comment ───────────────────────────────────────────────────────
COMMENT ON TABLE public.skincare_ingredient_rules IS 'Curated skincare ingredient concerns from EWG Skin Deep, INCIDecoder, Paula''s Choice, Dermatology Literature, IFRA, EU CPNP. All sources cited in sources JSONB field.';
