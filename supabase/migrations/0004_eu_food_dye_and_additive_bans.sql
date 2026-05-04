-- Migration: 0004_eu_food_dye_and_additive_bans.sql
-- ─── EU/US food dye & additive bans ─────────────────────────────────────────
-- Sources:
--   EU Regulation (EC) No 1333/2008 Annex II (food additives)
--   EU Regulation (EC) No 1333/2008 + Amendment warning-label dyes (Annex V)
--   FDA revocation of BVO authorisation (effective 2024-08-02)
--   Norwegian Food Safety Authority ban list
-- ban_status values:
--   'banned'     = outright prohibited in that jurisdiction
--   'restricted' = permitted but with mandatory warning label or concentration limits

INSERT INTO banned_ingredients_by_country
  (ingredient_name, country_code, ban_status, reason, regulation_link, effective_date, active)
VALUES

-- ── Allura Red AC / Red 40 (E129) ────────────────────────────────────────────
('Allura Red AC', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('Red 40', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('E129', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),

-- ── Tartrazine / Yellow 5 (E102) ─────────────────────────────────────────────
('Tartrazine', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('Yellow 5', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('E102', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),

-- ── Sunset Yellow FCF / Yellow 6 (E110) ──────────────────────────────────────
('Sunset Yellow FCF', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('Yellow 6', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('E110', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),

-- ── Quinoline Yellow (E104) ───────────────────────────────────────────────────
('Quinoline Yellow', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('E104', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),

-- ── Ponceau 4R / Cochineal Red A (E124) ──────────────────────────────────────
('Ponceau 4R', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('E124', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),

-- ── Carmoisine / Azorubine (E122) ─────────────────────────────────────────────
('Carmoisine', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('Azorubine', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),
('E122', 'EU', 'restricted',
 'Requires EU warning label: "may have an adverse effect on activity and attention in children"',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2010-07-20', true),

-- ── Brominated Vegetable Oil (BVO) ────────────────────────────────────────────
('Brominated Vegetable Oil', 'EU', 'banned',
 'Not authorised as a food additive under EU Regulation (EC) 1333/2008',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2008-01-01', true),
('BVO', 'EU', 'banned',
 'Not authorised as a food additive under EU Regulation (EC) 1333/2008',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2008-01-01', true),
('Brominated Vegetable Oil', 'US', 'banned',
 'FDA revoked authorisation for brominated vegetable oil in food',
 'https://www.fda.gov/food/cfsan-constituent-updates/fda-revokes-authorization-brominated-vegetable-oil-bvo-food',
 '2024-08-02', true),
('BVO', 'US', 'banned',
 'FDA revoked authorisation for brominated vegetable oil in food',
 'https://www.fda.gov/food/cfsan-constituent-updates/fda-revokes-authorization-brominated-vegetable-oil-bvo-food',
 '2024-08-02', true),

-- ── Potassium Bromate ─────────────────────────────────────────────────────────
('Potassium Bromate', 'EU', 'banned',
 'Prohibited in EU as flour treatment agent; classified as possibly carcinogenic (IARC Group 2B)',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '1990-01-01', true),
('Potassium Bromate', 'GB', 'banned',
 'Prohibited in the UK as flour treatment agent',
 'https://www.legislation.gov.uk/uksi/1995/3187/contents',
 '1990-01-01', true),
('Potassium Bromate', 'CA', 'banned',
 'Not permitted in Canadian bread as of 1994',
 'https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.,_c._870/',
 '1994-01-01', true),

-- ── Propyl Paraben (E216) ─────────────────────────────────────────────────────
('Propyl Paraben', 'EU', 'banned',
 'Removed from EU authorised food additives list in 2006 due to endocrine disruption concerns',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2006-01-01', true),
('E216', 'EU', 'banned',
 'Removed from EU authorised food additives list in 2006 due to endocrine disruption concerns',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333',
 '2006-01-01', true)

ON CONFLICT DO NOTHING;
