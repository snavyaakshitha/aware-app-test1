-- Migration: 0006_clean_score_rules_e_number_aliases.sql
-- ─── E-number aliases + British-English spellings for clean_score_rules ───────
-- The get_additive_matches RPC reads clean_score_rules (not food_additive_rules).
-- It matches: ing ILIKE '%' || rule.ingredient_pattern || '%'
--         OR: ing ILIKE ANY(rule.normalized_names)
--
-- EU/UK OFF records often list additives as E-numbers or British spellings.
-- The scoring.ts extractENumbers() function strips tokens like 'e150d' from
-- ingredient text like "colour (e150d)" and appends them to the ingredient array.
-- This migration adds E-number aliases to normalized_names so those tokens match.

-- Acesulfame-K → E950
UPDATE clean_score_rules
SET normalized_names = ARRAY['acesulfame', 'acesulfame-k', 'acesulfame potassium', 'e950']
WHERE ingredient_pattern = 'acesulfame';

-- Caramel Color / Colouring → E150a/b/c/d (4-MEI carcinogen concern)
UPDATE clean_score_rules
SET normalized_names = ARRAY['caramel color', 'caramel colour', 'caramel coloring', 'caramel colouring',
                              'e150a', 'e150b', 'e150c', 'e150d']
WHERE ingredient_pattern = 'caramel color';

UPDATE clean_score_rules
SET normalized_names = ARRAY['caramel colour', 'caramel color', 'caramel coloring', 'caramel colouring',
                              'e150a', 'e150b', 'e150c', 'e150d']
WHERE ingredient_pattern = 'caramel colouring';

-- Sodium Benzoate → E211
UPDATE clean_score_rules
SET normalized_names = ARRAY['sodium benzoate', 'e211']
WHERE ingredient_pattern = 'sodium benzoate';

-- Quinoline Yellow → E104
UPDATE clean_score_rules
SET normalized_names = ARRAY['quinoline yellow', 'e104']
WHERE ingredient_pattern = 'quinoline yellow';

-- Carmoisine / Azorubine → E122
UPDATE clean_score_rules
SET normalized_names = ARRAY['carmoisine', 'azorubine', 'e122']
WHERE ingredient_pattern = 'carmoisine';

-- Ponceau 4R → E124
UPDATE clean_score_rules
SET normalized_names = ARRAY['ponceau 4r', 'cochineal red a', 'e124']
WHERE ingredient_pattern = 'ponceau 4r';

-- Saccharin → E954
UPDATE clean_score_rules
SET normalized_names = ARRAY['saccharin', 'e954']
WHERE ingredient_pattern = 'saccharin';

-- Potassium Nitrite → E249 (same carcinogenic pathway as E250; upgrade to high)
UPDATE clean_score_rules
SET normalized_names = ARRAY['potassium nitrite', 'e249'],
    severity = 'high'
WHERE ingredient_pattern = 'potassium nitrite';

-- BHA → E320
UPDATE clean_score_rules
SET normalized_names = ARRAY['bha', 'butylated hydroxyanisole', 'e320']
WHERE ingredient_pattern = 'bha';

-- BHT → E321
UPDATE clean_score_rules
SET normalized_names = ARRAY['bht', 'butylated hydroxytoluene', 'e321']
WHERE ingredient_pattern = 'bht';

-- Natural Flavors → add British spellings (flavourings, natural flavours, etc.)
UPDATE clean_score_rules
SET normalized_names = ARRAY['natural flavor', 'natural flavors',
                              'natural flavour', 'natural flavours',
                              'natural flavoring', 'natural flavourings',
                              'flavourings', 'flavourings (natural)']
WHERE ingredient_pattern = 'natural flavors';

-- Red 40 / Allura Red → extend with FDA name variants
UPDATE clean_score_rules
SET normalized_names = ARRAY['red 40', 'allura red', 'allura red ac', 'e129',
                              'fd&c red 40', 'fd&c red no. 40']
WHERE ingredient_pattern = 'red 40';

-- Yellow 5 / Tartrazine → extend
UPDATE clean_score_rules
SET normalized_names = ARRAY['yellow 5', 'tartrazine', 'e102',
                              'fd&c yellow 5', 'fd&c yellow no. 5']
WHERE ingredient_pattern = 'yellow 5';

-- Yellow 6 / Sunset Yellow → extend
UPDATE clean_score_rules
SET normalized_names = ARRAY['yellow 6', 'sunset yellow', 'sunset yellow fcf', 'e110',
                              'fd&c yellow 6']
WHERE ingredient_pattern = 'yellow 6';

-- Aspartame → extend with brand names
UPDATE clean_score_rules
SET normalized_names = ARRAY['aspartame', 'e951', 'nutrasweet', 'equal']
WHERE ingredient_pattern = 'aspartame';

-- Sodium Nitrite → extend
UPDATE clean_score_rules
SET normalized_names = ARRAY['sodium nitrite', 'e250', 'nitrite de sodium']
WHERE ingredient_pattern = 'sodium nitrite';

-- MSG → extend with alternate spellings
UPDATE clean_score_rules
SET normalized_names = ARRAY['msg', 'monosodium glutamate', 'e621',
                              'glutamate de sodium', 'sodium glutamate']
WHERE ingredient_pattern = 'msg';

-- Carrageenan → extend
UPDATE clean_score_rules
SET normalized_names = ARRAY['carrageenan', 'carrageenan (e407)', 'e407', 'carrageenans']
WHERE ingredient_pattern = 'carrageenan';

-- HFCS → extend with European glucose-fructose syrup names
UPDATE clean_score_rules
SET normalized_names = ARRAY['high fructose corn syrup', 'hfcs', 'glucose-fructose',
                              'isoglucose', 'glucose-fructose syrup', 'fructose-glucose syrup',
                              'high fructose corn syrup (hfcs)']
WHERE ingredient_pattern = 'high fructose corn syrup';
