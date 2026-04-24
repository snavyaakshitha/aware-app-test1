-- 0002_scoring_rpcs.sql
-- Reference tables, seed data, three scoring RPCs, and scan_events analytics table.
-- PREREQUISITE: run this before any ScanResultScreen analysis features go live.

-- ─── Reference tables ─────────────────────────────────────────────────────────

create table if not exists public.additives (
  id         bigserial primary key,
  names      text[]  not null,  -- lowercase name variants used for matching
  severity   text    not null check (severity in ('severe', 'high', 'medium', 'low')),
  reason     text,
  source_url text,
  categories text[]  not null default '{}'  -- empty = applies to all categories
);

create table if not exists public.banned_substances (
  id               bigserial primary key,
  substance_names  text[]  not null,  -- lowercase name variants for matching
  jurisdictions    text[]  not null,
  regulatory_body  text,
  reason           text,
  source_url       text
);

-- Per-condition ingredient flags (avoid / caution / beneficial)
create table if not exists public.health_ingredient_flags (
  id                  bigserial primary key,
  condition           text    not null,  -- matches UserPreferences.healthConditions keys
  ingredient_patterns text[]  not null,  -- lowercase substrings to match against ingredient text
  flag_type           text    not null check (flag_type in ('avoid', 'caution', 'beneficial')),
  reason              text,
  source              text
);

-- AI summary cache: keyed by barcode + health conditions combo; 7-day TTL enforced in app
create table if not exists public.ai_summary_cache (
  id          bigserial primary key,
  cache_key   text        not null unique,  -- "{barcode}::{sorted_conditions}"
  barcode     text        not null,
  user_id     uuid        references auth.users(id) on delete set null,
  summary     text        not null,
  provider    text,
  latency_ms  integer,
  created_at  timestamptz not null default now()
);

-- Analytics: one row per scan attempt (non-blocking, user_id nullable for anonymous scans)
create table if not exists public.scan_events (
  id           bigserial primary key,
  user_id      uuid        references auth.users(id) on delete set null,
  barcode      text        not null,
  event_type   text        not null default 'scan',
  verdict      text,
  analysis_ran boolean     not null default false,
  source       text,                             -- OFF / ai_gemini / ai_gpt / etc.
  created_at   timestamptz not null default now()
);

-- RLS: users can insert their own events; can read their own history
alter table public.scan_events enable row level security;

drop policy if exists "Users insert own scan events" on public.scan_events;
create policy "Users insert own scan events"
  on public.scan_events for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read own scan events" on public.scan_events;
create policy "Users read own scan events"
  on public.scan_events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Anon insert scan events" on public.scan_events;
create policy "Anon insert scan events"
  on public.scan_events for insert
  to anon
  with check (user_id is null);

-- ─── Seed: additives ──────────────────────────────────────────────────────────

truncate public.additives restart identity;

insert into public.additives (names, severity, reason, source_url) values
-- Severe
(array['potassium bromate','potassium bromate (e924)','e924'], 'severe',
 'Probable human carcinogen (IARC Group 2B). Banned in EU, UK, Canada, Brazil, China.',
 'https://www.iarc.fr/'),
(array['brominated vegetable oil','bvo','brominated veg oil'], 'severe',
 'Bromine accumulates in body tissue. Banned in EU, UK, and removed from US food supply (FDA 2023).',
 'https://www.fda.gov/food/food-additives-petitions/ban-bvo'),

-- High
(array['bha','butylated hydroxyanisole','e320'], 'high',
 'Possible human carcinogen (IARC Group 2B). Endocrine-disrupting properties.',
 'https://www.iarc.fr/'),
(array['bht','butylated hydroxytoluene','e321'], 'high',
 'Linked to tumor promotion in animal studies. Endocrine disruption concern.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3299092/'),
(array['tbhq','tert-butylhydroquinone','e319'], 'high',
 'High doses show DNA damage in lab studies. Some jurisdictions restrict amounts.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3299092/'),
(array['red 40','red40','allura red','fd&c red 40','e129'], 'high',
 'Linked to hyperactivity in children. Requires warning label in EU.',
 'https://www.efsa.europa.eu/'),
(array['yellow 5','yellow5','tartrazine','fd&c yellow 5','e102'], 'high',
 'Linked to hyperactivity in children. Requires warning label in EU.',
 'https://www.efsa.europa.eu/'),
(array['yellow 6','yellow6','sunset yellow','fd&c yellow 6','e110'], 'high',
 'Linked to hyperactivity in children; possible adrenal tumors in animal studies.',
 'https://www.efsa.europa.eu/'),
(array['blue 1','blue1','brilliant blue','fd&c blue 1','e133'], 'high',
 'Possible tumor-promoting effects. Some countries restrict use.',
 null),
(array['blue 2','blue2','indigotine','fd&c blue 2','e132'], 'high',
 'Possible tumor risk at high doses in animal studies.',
 null),
(array['sodium nitrate','sodium nitrite','e250','e251'], 'high',
 'Forms carcinogenic nitrosamines when cooked at high heat. Classified as Group 2A by IARC.',
 'https://www.iarc.fr/'),
(array['carrageenan','e407'], 'high',
 'Degraded carrageenan causes intestinal inflammation in animal models. Controversy in human research.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4386871/'),
(array['propyl gallate','e310'], 'high',
 'Endocrine-disrupting properties; banned in infant foods in many countries.',
 null),
(array['azodicarbonamide','e927a'], 'high',
 'Banned in EU and Australia as food additive. WHO flagged respiratory concerns.',
 'https://www.who.int/'),

-- Medium
(array['aspartame','e951','nutrasweet','equal'], 'medium',
 'IARC classified as "possibly carcinogenic" (Group 2B) in 2023. Ongoing research.',
 'https://www.iarc.fr/wp-content/uploads/2023/07/Monographs_vol135_1.pdf'),
(array['sucralose','e955','splenda'], 'medium',
 'May alter gut microbiome at high doses. Some evidence of insulin response effect.',
 null),
(array['saccharin','e954','sweet n low'], 'medium',
 'Former carcinogen classification removed; ongoing research on gut effects.',
 null),
(array['acesulfame potassium','acesulfame-k','ace-k','e950'], 'medium',
 'Limited long-term safety data. May affect insulin response.',
 null),
(array['high fructose corn syrup','hfcs','high-fructose corn syrup','corn syrup high fructose'], 'medium',
 'Strongly linked to insulin resistance, obesity, and metabolic syndrome.',
 null),
(array['sodium benzoate','e211'], 'medium',
 'Converts to benzene (carcinogen) in presence of ascorbic acid. Hyperactivity link in children.',
 null),
(array['potassium benzoate','e212'], 'medium',
 'Same benzene-forming risk as sodium benzoate with vitamin C.',
 null),
(array['titanium dioxide','e171','ti02','tio2'], 'medium',
 'Banned as food additive in EU (2022). Genotoxic concern based on EFSA 2021 opinion.',
 'https://www.efsa.europa.eu/en/news/titanium-dioxide-no-longer-considered-safe-food-additive'),
(array['partially hydrogenated','trans fat','trans-fat','hydrogenated oil','hydrogenated vegetable oil'], 'medium',
 'Raises LDL, lowers HDL cholesterol. FDA eliminated GRAS status in 2018.',
 null),
(array['polysorbate 80','e433','tween 80'], 'medium',
 'Disrupts gut mucus layer in animal models; may promote inflammation.',
 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4910649/'),
(array['carboxymethylcellulose','cmc','cellulose gum','e466'], 'medium',
 'Dietary emulsifier linked to altered gut microbiome and low-grade inflammation in mouse studies.',
 null),
(array['caramel color','caramel colour','e150a','e150b','e150c','e150d'], 'medium',
 'Class III and IV caramel colors contain 4-methylimidazole (4-MEI), a possible carcinogen.',
 null),

-- Low
(array['maltodextrin'], 'low',
 'High glycemic index; may raise blood sugar faster than table sugar. Processed starch.',
 null),
(array['msg','monosodium glutamate','e621'], 'low',
 'Safe for most people at typical doses. Some individuals report sensitivity symptoms.',
 null),
(array['silicon dioxide','silica','e551'], 'low',
 'Used as anti-caking agent. Nanoparticle form raises absorption questions; generally recognized as safe.',
 null),
(array['natural flavors','natural flavour','natural flavor'], 'low',
 'Broad category; can include hundreds of chemicals. No disclosure requirement for individual components.',
 null),
(array['stevia','rebaudioside','steviol glycoside'], 'low',
 'Emerging research on gut microbiome effects. Generally considered safe in purified form.',
 null);

-- ─── Seed: banned_substances ──────────────────────────────────────────────────

truncate public.banned_substances restart identity;

insert into public.banned_substances (substance_names, jurisdictions, regulatory_body, reason, source_url) values
(array['titanium dioxide','e171'], array['EU'], 'EFSA / European Commission',
 'EFSA (2021) concluded titanium dioxide can no longer be considered safe as a food additive due to genotoxicity concern.',
 'https://www.efsa.europa.eu/en/news/titanium-dioxide-no-longer-considered-safe-food-additive'),

(array['brominated vegetable oil','bvo','brominated veg oil'], array['EU','UK','US'], 'FDA / EFSA',
 'Bioaccumulation of bromine. FDA revoked GRAS status in 2023; EU and UK banned earlier.',
 'https://www.fda.gov/food/food-additives-petitions/ban-bvo'),

(array['potassium bromate','e924'], array['EU','UK','Canada','Brazil','China','India','Nigeria'], 'EFSA / Health Canada',
 'Classified as possible human carcinogen (IARC 2B). Banned in most countries except the US.',
 'https://www.iarc.fr/'),

(array['azodicarbonamide','e927a'], array['EU','UK','Australia','Singapore'], 'EFSA',
 'Banned as food additive. WHO flagged occupational asthma risk; EU prohibits use in bread.',
 'https://www.efsa.europa.eu/'),

(array['propyl gallate','e310'], array['Japan','Australia (infant food)'], 'FSANZ',
 'Banned in infant and baby foods in multiple jurisdictions due to endocrine-disrupting properties.',
 null),

(array['red 2g','e128'], array['EU','UK','Australia'], 'EFSA',
 'Withdrawn from EU approval; associated with blood and spleen effects in animal studies.',
 null),

(array['violet 1'], array['US'], 'FDA',
 'FDA revoked approval in 1973 after carcinogenic findings in animal studies.',
 null);

-- ─── Seed: health_ingredient_flags ───────────────────────────────────────────

truncate public.health_ingredient_flags restart identity;

insert into public.health_ingredient_flags (condition, ingredient_patterns, flag_type, reason, source) values
-- Diabetes (T1 + T2)
('diabetes_t1', array['high fructose corn syrup','hfcs','corn syrup'], 'avoid',
 'HFCS drives rapid blood glucose spikes and insulin resistance.', 'ADA Guidelines'),
('diabetes_t1', array['maltodextrin'], 'avoid',
 'Glycemic index ~110 — higher than glucose. Rapid blood sugar impact.', 'Glycemic Index Foundation'),
('diabetes_t1', array['aspartame','sucralose','saccharin','acesulfame'], 'caution',
 'Artificial sweeteners may impair insulin sensitivity in some individuals.', 'NEJM 2023'),
('diabetes_t2', array['high fructose corn syrup','hfcs','corn syrup'], 'avoid',
 'HFCS drives rapid blood glucose spikes and insulin resistance.', 'ADA Guidelines'),
('diabetes_t2', array['maltodextrin'], 'avoid',
 'Glycemic index ~110 — higher than glucose. Rapid blood sugar impact.', 'Glycemic Index Foundation'),
('diabetes_t2', array['partially hydrogenated','trans fat'], 'avoid',
 'Trans fats worsen insulin sensitivity.', 'ADA Guidelines'),
('diabetes_t2', array['cinnamon'], 'beneficial',
 'May improve insulin sensitivity at regular consumption.', 'Cochrane Review'),

-- PCOS / PCOD
('pcos', array['high fructose corn syrup','hfcs'], 'avoid',
 'Fructose overload worsens insulin resistance, a core driver of PCOS.', 'Endocrine Society'),
('pcos', array['partially hydrogenated','trans fat'], 'avoid',
 'Trans fats associated with increased androgen levels and ovulatory infertility.', 'NEJM'),
('pcos', array['soy','soy protein','soy isolate','soy lecithin'], 'caution',
 'Phytoestrogens may affect hormonal balance; evidence is mixed.', 'Endocrine Society'),
('pcod', array['high fructose corn syrup','hfcs'], 'avoid',
 'Fructose overload worsens insulin resistance, a core driver of PCOS.', 'Endocrine Society'),
('pcod', array['partially hydrogenated','trans fat'], 'avoid',
 'Trans fats associated with increased androgen levels.', 'NEJM'),

-- Celiac
('celiac', array['wheat','gluten','barley','rye','malt','spelt','kamut','triticale','farro'], 'avoid',
 'Triggers autoimmune intestinal damage. Even trace amounts cause harm in celiac disease.', 'Celiac Disease Foundation'),
('celiac', array['modified starch','wheat starch','wheat flour'], 'avoid',
 'May contain gluten unless specifically labeled gluten-free.', 'Celiac Disease Foundation'),
('celiac', array['oat','oats'], 'caution',
 'Oats are often cross-contaminated with wheat. Only certified gluten-free oats are safe.', 'Celiac Disease Foundation'),

-- Hypertension
('hypertension', array['sodium nitrate','sodium nitrite'], 'avoid',
 'Nitrates can raise blood pressure and are linked to cardiovascular risk.', 'AHA Guidelines'),
('hypertension', array['msg','monosodium glutamate'], 'caution',
 'High MSG intake associated with blood pressure increases in some studies.', 'NHANES data'),
('hypertension', array['sodium benzoate','potassium benzoate'], 'caution',
 'Contributes to overall sodium load; monitor total intake.', 'AHA'),

-- High cholesterol
('high_cholesterol', array['partially hydrogenated','trans fat','hydrogenated oil'], 'avoid',
 'Trans fats raise LDL and lower HDL — worst dietary factor for cholesterol.', 'AHA/ACC Guidelines'),
('high_cholesterol', array['palm kernel oil','coconut oil'], 'caution',
 'High in saturated fat; may raise LDL in some individuals.', 'AHA'),
('high_cholesterol', array['psyllium','oat bran','beta-glucan'], 'beneficial',
 'Soluble fiber lowers LDL cholesterol.', 'FDA-approved health claim'),

-- Heart disease
('heart_disease', array['partially hydrogenated','trans fat'], 'avoid',
 'Strong causal link to cardiovascular disease. No safe level of consumption.', 'AHA/ACC'),
('heart_disease', array['sodium nitrate','sodium nitrite'], 'avoid',
 'Associated with increased cardiovascular mortality in large cohort studies.', 'IARC / AHA'),
('heart_disease', array['omega-3','fish oil','epa','dha'], 'beneficial',
 'Reduces triglycerides and cardiac event risk.', 'AHA Guidelines'),

-- Kidney disease
('kidney_disease', array['phosphoric acid','phosphate','sodium phosphate','potassium phosphate'], 'avoid',
 'Damaged kidneys cannot excrete excess phosphorus; hyperphosphatemia worsens progression.', 'KDIGO Guidelines'),
('kidney_disease', array['potassium chloride','potassium'], 'caution',
 'Impaired kidneys struggle to excrete excess potassium; hyperkalemia risk.', 'KDIGO Guidelines'),
('kidney_disease', array['msg','monosodium glutamate'], 'caution',
 'High sodium contributes to hypertension, accelerating kidney disease progression.', 'KDIGO'),

-- IBS
('ibs', array['fructose','high fructose corn syrup','hfcs'], 'avoid',
 'High-fructose foods are a primary FODMAP trigger for IBS symptoms.', 'Monash FODMAP'),
('ibs', array['sorbitol','mannitol','xylitol','erythritol'], 'avoid',
 'Polyol sweeteners are not well-absorbed, causing fermentation and IBS symptoms.', 'Monash FODMAP'),
('ibs', array['inulin','chicory root','fos','fructooligosaccharides'], 'avoid',
 'High-FODMAP prebiotics — known trigger for IBS bloating and pain.', 'Monash FODMAP'),
('ibs', array['lactose'], 'caution',
 'Lactose intolerance and IBS frequently co-occur. Monitor individual response.', 'ACG IBS Guidelines'),

-- Hypothyroidism
('hypothyroidism', array['soy','soy protein','soy isoflavone','soy lecithin'], 'caution',
 'Soy isoflavones may inhibit thyroid peroxidase; separate from thyroid meds by 4 hours.', 'ATA Guidelines'),
('hypothyroidism', array['kelp','seaweed','iodine'], 'caution',
 'Excess iodine can paradoxically worsen hypothyroidism (Wolff-Chaikoff effect).', 'ATA'),
('hypothyroidism', array['selenium'], 'beneficial',
 'Selenium is a cofactor for thyroid hormone conversion (T4 → T3).', 'ATA Guidelines'),

-- Pregnancy
('pregnancy', array['sodium nitrate','sodium nitrite'], 'avoid',
 'Nitrates linked to methemoglobinemia in infants; risk during pregnancy.', 'CDC Guidelines'),
('pregnancy', array['aspartame'], 'caution',
 'Phenylalanine byproduct; PKU carriers should avoid. General caution recommended.', 'FDA'),
('pregnancy', array['vitamin a','retinol','retinyl palmitate'], 'caution',
 'Excess preformed vitamin A is teratogenic. Limit to <10,000 IU/day.', 'CDC'),
('pregnancy', array['caffeine'], 'caution',
 'WHO recommends <300 mg/day during pregnancy.', 'WHO'),
('pregnancy', array['folate','folic acid'], 'beneficial',
 'Prevents neural tube defects. Essential during first trimester.', 'CDC'),
('pregnancy', array['omega-3','dha','fish oil'], 'beneficial',
 'Supports fetal brain and eye development.', 'ACOG'),

-- GERD / Acid reflux
('gerd', array['citric acid','ascorbic acid','lactic acid'], 'caution',
 'Acidic additives can trigger or worsen reflux symptoms.', 'ACG GERD Guidelines'),
('gerd', array['caffeine'], 'caution',
 'Relaxes lower esophageal sphincter, worsening reflux.', 'ACG'),
('acid_reflux', array['citric acid','ascorbic acid'], 'caution',
 'Acidic additives can trigger or worsen reflux symptoms.', 'ACG GERD Guidelines'),

-- Crohn's / IBD
('crohns', array['carrageenan','e407'], 'avoid',
 'Intestinal inflammation from degraded carrageenan is a documented mechanism in IBD models.', 'Inflamm Bowel Dis Journal'),
('crohns', array['polysorbate 80','e433','carboxymethylcellulose','e466'], 'avoid',
 'Dietary emulsifiers disrupt the intestinal mucus barrier; linked to IBD in animal studies.', 'Nature 2015'),
('ibd', array['carrageenan','e407'], 'avoid',
 'Intestinal inflammation from degraded carrageenan is a documented mechanism in IBD models.', 'Inflamm Bowel Dis Journal'),
('ibd', array['polysorbate 80','e433','carboxymethylcellulose','e466'], 'avoid',
 'Dietary emulsifiers disrupt the intestinal mucus barrier; linked to IBD in animal studies.', 'Nature 2015'),

-- Fatty liver (NAFLD)
('fatty_liver', array['high fructose corn syrup','hfcs','corn syrup','fructose'], 'avoid',
 'Fructose is exclusively metabolized in the liver; excess drives de novo lipogenesis and NAFLD.', 'Hepatology Guidelines'),
('fatty_liver', array['partially hydrogenated','trans fat'], 'avoid',
 'Trans fats worsen hepatic insulin resistance and liver fat accumulation.', 'AASLD'),

-- Migraines
('migraines', array['msg','monosodium glutamate','e621'], 'avoid',
 'MSG is a well-documented migraine trigger in susceptible individuals.', 'American Migraine Foundation'),
('migraines', array['sodium nitrate','sodium nitrite'], 'avoid',
 'Nitrates cause vasodilation and are common migraine triggers.', 'American Migraine Foundation'),
('migraines', array['caffeine'], 'caution',
 'Caffeine can trigger withdrawal migraines; consistent intake pattern matters.', 'AMF'),
('migraines', array['tyramine','aged cheese','fermented'], 'caution',
 'Tyramine from fermented foods is a known migraine trigger.', 'AMF'),

-- ADHD
('adhd', array['red 40','allura red','e129'], 'avoid',
 'EFSA landmark study linked Red 40 to increased hyperactivity in children.', 'EFSA 2007 / Lancet'),
('adhd', array['yellow 5','tartrazine','e102','yellow 6','sunset yellow','e110'], 'avoid',
 'Southampton study found increased hyperactivity with these dyes in children.', 'Lancet 2007'),
('adhd', array['sodium benzoate','e211'], 'avoid',
 'Combined with certain food dyes, sodium benzoate increased hyperactivity in the Southampton study.', 'Lancet 2007'),
('adhd', array['omega-3','fish oil','dha','epa'], 'beneficial',
 'Omega-3 fatty acids show modest improvements in attention and ADHD symptoms.', 'JAMA Pediatrics'),

-- Osteoporosis
('osteoporosis', array['phosphoric acid','phosphate'], 'caution',
 'High phosphorus intake accelerates calcium loss from bones.', 'NOF Guidelines'),
('osteoporosis', array['calcium','calcium carbonate','calcium phosphate'], 'beneficial',
 'Direct contribution to bone mineral density.', 'NOF'),
('osteoporosis', array['vitamin d','vitamin d3','cholecalciferol'], 'beneficial',
 'Required for calcium absorption; deficiency directly causes bone loss.', 'NOF');

-- ─── RPC: compute_health_fit_score ───────────────────────────────────────────
-- Returns JSON with allergen_conflicts, avoid_list, caution_list, beneficial_list.
-- Supabase JS handles the array-vs-scalar unwrap in scoring.ts.

drop function if exists public.compute_health_fit_score(text[], text[], text[]);

create or replace function public.compute_health_fit_score(
  p_ingredients       text[],
  p_user_conditions   text[],
  p_user_allergies    text[]
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_allergen_conflicts text[]   := '{}';
  v_avoid_list         json[]   := '{}';
  v_caution_list       json[]   := '{}';
  v_beneficial_list    json[]   := '{}';
  v_allergen           text;
  v_ingredient         text;
  v_flag               record;
  v_already_flagged    text[]   := '{}';
  v_flag_key           text;
begin
  -- Allergen conflicts: find any ingredient that contains the allergen keyword (or vice-versa)
  foreach v_allergen in array coalesce(p_user_allergies, '{}') loop
    foreach v_ingredient in array coalesce(p_ingredients, '{}') loop
      if lower(v_ingredient) ilike '%' || lower(v_allergen) || '%'
         or lower(v_allergen) ilike '%' || lower(v_ingredient) || '%'
      then
        if not (lower(v_allergen) = any(v_allergen_conflicts)) then
          v_allergen_conflicts := array_append(v_allergen_conflicts, lower(v_allergen));
        end if;
      end if;
    end loop;
  end loop;

  -- Health condition flags: match each ingredient against each active flag rule
  if array_length(p_user_conditions, 1) is not null and array_length(p_user_conditions, 1) > 0 then
    for v_flag in
      select
        hif.flag_type,
        hif.reason,
        hif.source,
        unnested.ing as matched_ingredient
      from
        public.health_ingredient_flags hif,
        unnest(p_ingredients) as unnested(ing)
      where
        hif.condition = any(p_user_conditions)
        and exists (
          select 1 from unnest(hif.ingredient_patterns) p(pattern)
          where lower(unnested.ing) ilike '%' || lower(p.pattern) || '%'
        )
      order by hif.flag_type, unnested.ing
    loop
      -- Deduplicate by ingredient+flag_type so one ingredient doesn't get listed twice
      v_flag_key := v_flag.flag_type || '::' || lower(v_flag.matched_ingredient);
      if v_flag_key = any(v_already_flagged) then
        continue;
      end if;
      v_already_flagged := array_append(v_already_flagged, v_flag_key);

      if v_flag.flag_type = 'avoid' then
        v_avoid_list := array_append(v_avoid_list, json_build_object(
          'ingredient', v_flag.matched_ingredient,
          'reason',     v_flag.reason,
          'source',     v_flag.source
        ));
      elsif v_flag.flag_type = 'caution' then
        v_caution_list := array_append(v_caution_list, json_build_object(
          'ingredient', v_flag.matched_ingredient,
          'reason',     v_flag.reason,
          'source',     v_flag.source
        ));
      elsif v_flag.flag_type = 'beneficial' then
        v_beneficial_list := array_append(v_beneficial_list, json_build_object(
          'ingredient', v_flag.matched_ingredient,
          'reason',     v_flag.reason,
          'source',     v_flag.source
        ));
      end if;
    end loop;
  end if;

  return json_build_object(
    'allergen_conflicts', v_allergen_conflicts,
    'avoid_list',         v_avoid_list,
    'caution_list',       v_caution_list,
    'beneficial_list',    v_beneficial_list
  );
end;
$$;

-- ─── RPC: get_additive_matches ────────────────────────────────────────────────
-- Returns a set of additive matches for the given ingredient list.

drop function if exists public.get_additive_matches(text[], text);

create or replace function public.get_additive_matches(
  ingredients       text[],
  product_category  text default 'food'
)
returns table(ingredient text, severity text, reason text, source_url text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select distinct on (lower(unnested.ing), a.severity)
    unnested.ing  as ingredient,
    a.severity,
    a.reason,
    a.source_url
  from
    unnest(ingredients) as unnested(ing),
    public.additives    a
  where
    -- ingredient text contains one of the additive's name variants
    exists (
      select 1 from unnest(a.names) n(name)
      where lower(unnested.ing) ilike '%' || n.name || '%'
    )
    -- and additive applies to this category (or all categories)
    and (
      array_length(a.categories, 1) is null
      or array_length(a.categories, 1) = 0
      or product_category = any(a.categories)
    )
  order by lower(unnested.ing), a.severity,
    case a.severity
      when 'severe' then 1
      when 'high'   then 2
      when 'medium' then 3
      when 'low'    then 4
      else 5
    end;
end;
$$;

-- ─── RPC: check_banned_substances ────────────────────────────────────────────
-- Returns banned substance matches with full regulatory context.

drop function if exists public.check_banned_substances(text[]);

create or replace function public.check_banned_substances(
  ingredients text[]
)
returns table(
  ingredient       text,
  substance_name   text,
  jurisdictions    text[],
  regulatory_body  text,
  reason           text,
  source_url       text
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select distinct on (lower(unnested.ing), bs.id)
    unnested.ing       as ingredient,
    bs.substance_names[1] as substance_name,
    bs.jurisdictions,
    bs.regulatory_body,
    bs.reason,
    bs.source_url
  from
    unnest(ingredients)         as unnested(ing),
    public.banned_substances    bs
  where
    exists (
      select 1 from unnest(bs.substance_names) n(name)
      where lower(unnested.ing) ilike '%' || n.name || '%'
    )
  order by lower(unnested.ing), bs.id;
end;
$$;

-- ─── Grant execute to authenticated + anon ────────────────────────────────────

grant execute on function public.compute_health_fit_score(text[], text[], text[]) to authenticated, anon;
grant execute on function public.get_additive_matches(text[], text) to authenticated, anon;
grant execute on function public.check_banned_substances(text[]) to authenticated, anon;
