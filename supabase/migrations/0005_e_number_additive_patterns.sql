-- Migration: 0005_e_number_additive_patterns.sql
-- ─── E-number aliases for food_additive_rules ────────────────────────────────
-- The `get_additive_matches` RPC uses ILIKE substring matching on
-- ingredient_pattern. EU/UK product labels often store additives as E-numbers
-- (e.g. "colour (e150d)", "acidity regulator (e330)") rather than English names.
-- The scoring.ts `extractENumbers()` function strips these tokens and sends them
-- as supplementary ingredients — so we just need matching rows here.
--
-- Severity mapping follows the parent English-name entry in this table.
-- All E-numbers are written lowercase (extractor normalises to lowercase).
--
-- Sources:
--   European Parliament Regulation (EC) No 1333/2008 — Food Additives
--   IARC Monographs on Carcinogenicity
--   FDA GRAS / Not-GRAS determinations

INSERT INTO food_additive_rules
  (ingredient_pattern, severity, reason, source_url, active)
VALUES

-- ── SEVERE ───────────────────────────────────────────────────────────────────
('e320', 'severe',
 'BHA (butylated hydroxyanisole). Possible carcinogen (IARC Group 2B); endocrine disruptor; banned or restricted in Japan, parts of EU.',
 'https://www.iarc.who.int/cards_page/butylated-hydroxyanisole/', true),

('e321', 'severe',
 'BHT (butylated hydroxytoluene). Possible carcinogen; endocrine disruption concerns; prohibited or restricted in several countries.',
 'https://www.efsa.europa.eu/en/efsajournal/pub/4664', true),

-- ── HIGH ─────────────────────────────────────────────────────────────────────
-- Artificial colours — the "Southampton Six" azo dyes
('e102', 'high',
 'Tartrazine / FD&C Yellow No. 5. Requires EU warning label "may have an adverse effect on activity and attention in children". Linked to hyperactivity and allergic reactions.',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333', true),

('e104', 'high',
 'Quinoline Yellow. Requires EU warning label for children''s hyperactivity. Banned in the US and Australia.',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333', true),

('e110', 'high',
 'Sunset Yellow FCF / FD&C Yellow No. 6. Requires EU warning label for children''s hyperactivity. Linked to allergic reactions and possible carcinogenicity.',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333', true),

('e122', 'high',
 'Carmoisine / Azorubine. Requires EU warning label for children''s hyperactivity. Banned in the US. Linked to allergic reactions.',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333', true),

('e124', 'high',
 'Ponceau 4R / Cochineal Red A. Requires EU warning label for children''s hyperactivity. Banned in the US.',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333', true),

('e129', 'high',
 'Allura Red AC / FD&C Red No. 40. Requires EU warning label for children''s hyperactivity. Linked to possible carcinogenicity.',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333', true),

-- Caramel colours III and IV (4-MEI carcinogen concern)
('e150c', 'high',
 'Caramel Colour III (ammonia caramel). Contains 4-methylimidazole (4-MEI), a possible carcinogen per IARC and California Prop 65.',
 'https://www.iarc.who.int/cards_page/2-amino-3-methylimidazol/', true),

('e150d', 'high',
 'Caramel Colour IV (sulfite-ammonia caramel). Contains 4-methylimidazole (4-MEI), a possible carcinogen per IARC and California Prop 65. Most common caramel colour in colas.',
 'https://www.iarc.who.int/cards_page/2-amino-3-methylimidazol/', true),

-- Preservatives
('e211', 'high',
 'Sodium Benzoate. Reacts with vitamin C (ascorbic acid) to form benzene, a known human carcinogen. Linked to ADHD and hyperactivity in children.',
 'https://www.fda.gov/food/food-additives-petitions/sodium-benzoate', true),

('e210', 'high',
 'Benzoic Acid. Precursor to sodium benzoate. Same benzene-forming reaction with vitamin C; linked to hyperactivity.',
 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2016.4366', true),

('e212', 'high',
 'Potassium Benzoate. Same family as sodium benzoate (E211). Reacts with vitamin C to form benzene.',
 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2016.4366', true),

-- Artificial sweeteners
('e951', 'high',
 'Aspartame. Classified IARC Group 2B (possible carcinogen). May affect gut microbiome. WHO recommends against use for weight management.',
 'https://www.iarc.who.int/cards_page/aspartame/', true),

('e950', 'high',
 'Acesulfame-K (acesulfame potassium). Possible carcinogen; linked to gut dysbiosis; often combined with aspartame (E951).',
 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2017.4737', true),

('e954', 'high',
 'Saccharin. Historically linked to bladder cancer in animal studies; possible carcinogen. Oldest artificial sweetener.',
 'https://www.iarc.who.int/cards_page/saccharin-and-its-salts/', true),

-- Other high-concern additives
('e250', 'high',
 'Sodium Nitrite. Reacts with amines in processed meat to form nitrosamines, classified Group 1 human carcinogens by IARC.',
 'https://www.iarc.who.int/cards_page/nitrate-and-nitrite/', true),

('e249', 'high',
 'Potassium Nitrite. Same carcinogenic nitrosamine-forming pathway as sodium nitrite (E250) in processed meat.',
 'https://www.iarc.who.int/cards_page/nitrate-and-nitrite/', true),

('e621', 'medium',
 'Monosodium Glutamate (MSG). May trigger adverse reactions in sensitive individuals (headache, flushing). Often signals highly processed base ingredients.',
 'https://www.fda.gov/food/food-additives-petitions/questions-and-answers-monosodium-glutamate-msg', true),

-- ── MEDIUM ───────────────────────────────────────────────────────────────────
('e420', 'medium',
 'Sorbitol. Sugar alcohol; excessive consumption causes bloating, gas, and diarrhoea (laxative effect above ~50g/day).',
 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2015.4252', true),

('e421', 'medium',
 'Mannitol. Sugar alcohol; same laxative effects as sorbitol (E420) at high doses.',
 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2015.4253', true),

('e422', 'medium',
 'Glycerol (glycerine). Generally safe; in large quantities acts as a laxative. Widely used as humectant.',
 null, true),

('e202', 'medium',
 'Potassium Sorbate. Generally recognised as safe; may cause mild allergic reactions or skin irritation in sensitive individuals.',
 'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2015.4144', true),

('e330', 'medium',
 'Citric Acid. Generally safe in normal quantities; can erode tooth enamel; excess linked to inflammation in very sensitive individuals.',
 null, true),

('e471', 'medium',
 'Mono- and diglycerides of fatty acids. Common emulsifier derived from fat; associated with inflammation and gut microbiome disruption at high levels.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9734083/', true),

('e472e', 'medium',
 'Diacetyl tartaric acid esters of mono- and diglycerides (DATEM). Emulsifier used in bread; processed fat derivative.',
 null, true),

('e476', 'medium',
 'Polyglycerol polyricinoleate (PGPR). Emulsifier used in chocolate to reduce cocoa butter content; derived from castor oil.',
 null, true),

('e407', 'medium',
 'Carrageenan. Derived from seaweed; linked to gut inflammation in animal studies; some human research suggests IBD risk.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5389019/', true),

('e466', 'medium',
 'Carboxymethylcellulose (CMC). Synthetic cellulose emulsifier; linked to gut dysbiosis and low-grade intestinal inflammation.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7364321/', true),

('e433', 'medium',
 'Polysorbate 80. Emulsifier linked to gut barrier disruption and microbiome dysbiosis in animal studies.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4910649/', true),

('e435', 'medium',
 'Polysorbate 60. Same family as polysorbate 80 (E433); same gut disruption concerns.',
 null, true),

-- ── LOW ──────────────────────────────────────────────────────────────────────
('e300', 'low',
 'Ascorbic Acid (Vitamin C). Safe antioxidant; naturally occurring. No health concerns at food-additive levels.',
 null, true),

('e306', 'low',
 'Mixed tocopherols (Vitamin E). Natural antioxidant extract. Safe.',
 null, true),

('e307', 'low',
 'Alpha-Tocopherol (Vitamin E). Synthetic form of vitamin E. Safe at food additive levels.',
 null, true),

('e322', 'low',
 'Lecithins. Natural emulsifier (often from soy or sunflower). Generally safe; soy lecithin may cause issues for severe soy allergies.',
 null, true),

('e440', 'low',
 'Pectins. Natural polysaccharide from fruit. Safe; used as gelling agent.',
 null, true),

('e415', 'low',
 'Xanthan Gum. Natural microbial fermentation product. Generally safe; can cause digestive discomfort at high doses.',
 null, true),

('e412', 'low',
 'Guar Gum. Natural seed extract. Generally safe; may cause bloating at high doses.',
 null, true),

('e401', 'low',
 'Sodium Alginate. Derived from seaweed. Safe emulsifier/stabiliser.',
 null, true),

('e160a', 'low',
 'Beta-Carotene. Natural pigment (provitamin A). Safe.',
 null, true),

('e160b', 'low',
 'Annatto (Bixin, Norbixin). Natural orange-red colour from annatto seeds. May cause rare allergic reactions.',
 null, true),

('e120', 'low',
 'Carmine (Cochineal, E120). Red colour derived from cochineal insects. Not vegan; rare severe allergic reactions reported.',
 'https://www.fda.gov/food/color-additives-questions-answers-consumers/questions-and-answers-cochineal-extract-and-carmine', true),

('e160c', 'low',
 'Paprika extract (Capsanthin). Natural red colour from paprika. Generally safe.',
 null, true),

('e500', 'low',
 'Sodium Carbonates (Sodium Bicarbonate / baking soda). Safe leavening agent.',
 null, true),

('e503', 'low',
 'Ammonium Carbonates. Safe leavening agent used in baking.',
 null, true),

('e170', 'low',
 'Calcium Carbonates. Safe mineral supplement and anti-caking agent.',
 null, true),

-- ── UK ENGLISH SPELLING GAP ──────────────────────────────────────────────────
-- OFF UK/EU records use British spellings; the DB only has US spellings.
('natural flavours', 'low',
 'Catch-all term (UK spelling). May include undisclosed processing aids or flavour enhancers.',
 null, true),

('colour', 'low',
 'Generic colour/dye marker (UK spelling). Specific dye identity may be unknown. Check E-number if listed.',
 null, true),

('flavourings', 'low',
 'Catch-all flavourings term (UK/EU spelling). May include undisclosed processing aids.',
 null, true)

ON CONFLICT DO NOTHING;
