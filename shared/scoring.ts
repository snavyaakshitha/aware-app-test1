/**
 * Aware — Product Analysis Service
 *
 * Replaces numeric clean/health scores with four independent components:
 *   Safety Verdict     — personalized allergen + condition check (compute_health_fit_score RPC)
 *   Additives          — universal ingredient safety (get_additive_matches RPC)
 *   Banned Substances  — cross-jurisdiction regulatory flags (check_banned_substances RPC)
 *   Nutrition          — Nutri-Score grade from Open Food Facts (displayed in UI, no RPC needed)
 *   Processing         — NOVA group from Open Food Facts (displayed in UI, no RPC needed)
 */

import { supabase } from './supabase';
import type {
  SkinCareAnalysisResult,
  BannedIngredientMatch,
  IngredientConflictMatch,
  AllergenMatch,
} from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisItem {
  ingredient: string;
  reason: string | null;
  source?: string | null;
}

export interface SafetyAnalysis {
  verdict: 'safe' | 'check' | 'avoid';
  allergenConflicts: string[];
  avoidList: AnalysisItem[];
  cautionList: AnalysisItem[];
  beneficialList: AnalysisItem[];
}

export interface AdditiveMatch {
  ingredient: string;
  severity: 'severe' | 'high' | 'medium' | 'low' | null;
  reason: string | null;
  source_url?: string | null;
}

export interface AdditiveAnalysis {
  severe: AdditiveMatch[];
  high: AdditiveMatch[];
  medium: AdditiveMatch[];
  low: AdditiveMatch[];
  total: number;
}

export interface BannedSubstanceMatch {
  ingredient: string;
  substanceName: string;
  jurisdictions: string[];
  regulatoryBody: string | null;
  reason: string | null;
  sourceUrl: string | null;
}

export interface GlobalBanResult {
  bannedIngredients: BannedIngredientMatch[];
  hasSevereBan: boolean;
}

export interface ConflictResult {
  conflicts: IngredientConflictMatch[];
  hasSevereConflict: boolean;
}

export interface ProductAnalysisResult {
  safety: SafetyAnalysis;
  additives: AdditiveAnalysis;
  bannedSubstances: BannedSubstanceMatch[];
  globalBans: GlobalBanResult;
  conflicts: ConflictResult;
  allergenMatches: AllergenMatch[];
  _hallucinationDetected?: boolean;
}

// ─── Ingredient parser (depth-aware, handles nested parentheses) ──────────────
// For compound sub-ingredients like "genoa salami (pork, salt, bha, bht, ...)",
// items longer than 80 chars are flattened: the base name is extracted and the
// parenthetical sub-ingredients are recursively parsed. This ensures additives
// embedded inside compound ingredient declarations (e.g. BHA inside a cured meat
// sub-list) are always detected by the RPC matching layer.

function parseIngredientsArray(text: string, _depth = 0): string[] {
  if (!text?.trim() || _depth > 4) return [];
  const topParts: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if ((ch === ',' || ch === ';') && depth === 0) {
      const t = cur.trim();
      if (t) topParts.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) topParts.push(cur.trim());

  const result: string[] = [];
  for (const raw of topParts) {
    const p = raw.toLowerCase().trim();
    if (p.length <= 1) continue;
    if (p.length < 80) {
      result.push(p);
    } else {
      // Compound sub-ingredient string — extract base name + flatten sub-ingredients
      // so nothing embedded (like "bha" inside "genoa salami (pork, ..., bha, ...)") is lost.
      const parenIdx = p.indexOf('(');
      if (parenIdx !== -1) {
        const base = p.slice(0, parenIdx).replace(/[:/]/g, '').trim();
        if (base.length > 1 && base.length < 80) result.push(base);
        const lastParen = p.lastIndexOf(')');
        const inner = p.slice(parenIdx + 1, lastParen !== -1 ? lastParen : undefined);
        if (inner) result.push(...parseIngredientsArray(inner, _depth + 1));
      }
      // No parentheses but still > 80 chars — skip (free-text / label garbage)
    }
  }
  return result;
}

// ─── E-number extractor ───────────────────────────────────────────────────────
// EU-format labels encode additives as E-numbers (e.g. "E129", "e 150d").
// The DB stores them by their canonical name (e.g. "allura red ac") AND by the
// E-number token. Extracting E-numbers separately ensures no additive is missed
// when the ingredient text is in French, German, Polish, etc.

function extractENumbers(text: string): string[] {
  // Matches: e129, E 102, e150d, E-211, etc.
  const ePattern = /\be\s*[-]?\s*(\d{3}[a-z]?(?:\([iiv]+\))?)\b/gi;
  const seen = new Set<string>();
  const results: string[] = [];
  for (const m of text.matchAll(ePattern)) {
    // Normalise: strip spaces/dashes, lowercase → "e129", "e150d"
    const token = `e${m[1].toLowerCase().replace(/\s/g, '')}`;
    if (!seen.has(token)) {
      seen.add(token);
      results.push(token);
    }
  }
  return results;
}

// ─── Safety verdict derivation ────────────────────────────────────────────────

function deriveSafetyVerdict(healthData: Record<string, unknown>): SafetyAnalysis['verdict'] {
  if ((healthData?.allergen_conflicts as unknown[])?.length > 0) return 'avoid';
  if ((healthData?.avoid_list as unknown[])?.length > 0) return 'check';
  if ((healthData?.caution_list as unknown[])?.length > 0) return 'check';
  return 'safe';
}

// ─── Additive deduplication ───────────────────────────────────────────────────
// The RPC uses substring-pattern matching (ILIKE '%pattern%'), which means a
// single ingredient like "high fructose corn syrup" can fire multiple rules:
// "high fructose corn syrup" (HIGH) + "corn syrup" (HIGH) + "fructose" (MEDIUM).
// This deduplicates by keeping only the longest (most specific) match when one
// matched ingredient name is a substring of another matched ingredient name.
function deduplicateAdditives(matches: AdditiveMatch[]): AdditiveMatch[] {
  if (matches.length <= 1) return matches;
  // Sort longest-ingredient-name first so we keep the most specific match
  const sorted = [...matches].sort(
    (a, b) => b.ingredient.length - a.ingredient.length
  );
  const kept: AdditiveMatch[] = [];
  for (const candidate of sorted) {
    const lc = candidate.ingredient.toLowerCase();
    // Discard if this ingredient name is a substring of an already-kept match
    const dominated = kept.some((k) =>
      k.ingredient.toLowerCase().includes(lc)
    );
    if (!dominated) kept.push(candidate);
  }
  return kept;
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function fetchProductAnalysis(
  barcode: string,
  userId: string | null,
  ingredientsText: string,
  productCategory: string = 'food',
): Promise<ProductAnalysisResult | null> {
  if (!supabase) {
    console.warn('[analysis] Supabase not configured');
    return null;
  }
  if (!ingredientsText?.trim()) return null;

  let ingredients = parseIngredientsArray(ingredientsText);
  if (ingredients.length === 0) return null;

  // Augment with E-numbers extracted directly from the raw text.
  // EU/international labels use "e129", "e 150d" etc. which the parser may not
  // split out as standalone tokens (e.g. "colour (e150d)" → "colour (e150d)").
  // De-duplicate against already-parsed tokens so RPC payloads stay lean.
  {
    const eNums = extractENumbers(ingredientsText);
    if (eNums.length > 0) {
      const existing = new Set(ingredients);
      for (const en of eNums) {
        if (!existing.has(en)) ingredients.push(en);
      }
    }
  }

  // Guard 1: suspiciously high ingredient count (AI hallucination signal)
  if (ingredients.length > 60) {
    console.warn(`[analysis] Suspicious ingredient count (${ingredients.length}) — capping at 60, flagging result.`);
    ingredients = ingredients.slice(0, 60);
  }

  // Guard 2: non-food chemical signals (AI queried wrong database)
  const HALLUCINATION_SIGNALS = [
    'naphthylamine', 'naphthylamines', 'isopropyl alcohol', 'benzalkonium chloride',
    'ethyl alcohol 70', 'hand sanitizer active', 'industrial dye',
  ];
  const hallucinationDetected = ingredients.some((ing) =>
    HALLUCINATION_SIGNALS.some((sig) => ing.toLowerCase().includes(sig)),
  );
  if (hallucinationDetected) {
    console.warn('[analysis] Hallucination signal detected — returning flagged empty result.');
    return {
      _hallucinationDetected: true,
      safety: { verdict: 'safe', allergenConflicts: [], avoidList: [], cautionList: [], beneficialList: [] },
      additives: { severe: [], high: [], medium: [], low: [], total: 0 },
      bannedSubstances: [],
      globalBans: { bannedIngredients: [], hasSevereBan: false },
      conflicts: { conflicts: [], hasSevereConflict: false },
      allergenMatches: [],
    };
  }

  console.log(`[analysis] Analysing barcode ${barcode}: ${ingredients.length} ingredients`);

  // Fetch user profile (authenticated users only)
  let userConditions: string[] = [];
  let userAllergens: string[] = [];
  if (userId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('health_conditions, allergens')
      .eq('id', userId)
      .maybeSingle();
    userConditions = (profile?.health_conditions as string[]) ?? [];
    userAllergens = (profile?.allergens as string[]) ?? [];
    console.log(`[analysis] Profile: ${userConditions.length} conditions, ${userAllergens.length} allergens`);
  }

  // Shape that every supabase.rpc() call resolves to.
  type RpcResponse = { data: unknown; error: { message: string } | null };

  // 15s timeout wrapper — Supabase JS v2 doesn't support AbortSignal on rpc()
  // Uses `any` so PostgrestFilterBuilder (a thenable, not a full Promise) is accepted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withTimeout(promise: PromiseLike<any>, ms: number): Promise<RpcResponse> {
    return Promise.race([
      Promise.resolve(promise) as Promise<RpcResponse>,
      new Promise<RpcResponse>((_, reject) =>
        setTimeout(() => reject(new Error(`RPC timed out after ${ms}ms`)), ms),
      ),
    ]);
  }

  // Run all six RPCs in parallel; allSettled shows partial results when any RPC fails
  const [healthSettled, additiveSettled, bannedSettled, globalBansSettled, conflictsSettled, allergensSettled] = await Promise.allSettled([
    withTimeout(
      supabase.rpc('compute_health_fit_score', {
        p_ingredients: ingredients,
        p_user_conditions: userConditions,
        p_user_allergies: userAllergens,
      }),
      15_000,
    ),
    withTimeout(
      supabase.rpc('get_additive_matches', {
        ingredients,
        product_category: productCategory,
      }),
      15_000,
    ),
    withTimeout(
      supabase.rpc('check_banned_substances', { ingredients }),
      15_000,
    ),
    withTimeout(
      supabase.rpc('check_banned_ingredients_worldwide', {
        p_ingredients: ingredients,
        p_country_code: null, // null = all jurisdictions (US, EU, CA, GB, etc.)
        p_product_category: productCategory, // filter out cosmetic-only bans from food products
      }),
      15_000,
    ),
    withTimeout(
      supabase.rpc('check_ingredient_conflicts', {
        p_ingredients: ingredients,
      }),
      15_000,
    ),
    withTimeout(
      supabase.rpc('get_allergens_for_ingredients', {
        p_ingredients: ingredients,
      }),
      15_000,
    ),
  ]);

  // health and additives are required — if either fails, return null
  if (healthSettled.status === 'rejected') {
    console.warn('[analysis] compute_health_fit_score failed:', healthSettled.reason);
    return null;
  }
  if (additiveSettled.status === 'rejected') {
    console.warn('[analysis] get_additive_matches failed:', additiveSettled.reason);
    return null;
  }

  const healthResult = healthSettled.value;
  const additiveResult = additiveSettled.value;

  if (healthResult.error) {
    console.warn('[analysis] compute_health_fit_score error:', healthResult.error.message);
    return null;
  }
  if (additiveResult.error) {
    console.warn('[analysis] get_additive_matches error:', additiveResult.error.message);
    return null;
  }

  // Non-fatal RPCs — degraded result still shows health/additives
  const bannedData = bannedSettled.status === 'fulfilled' && !bannedSettled.value.error
    ? bannedSettled.value.data : null;
  const globalBansData = globalBansSettled.status === 'fulfilled' && !globalBansSettled.value.error
    ? globalBansSettled.value.data : null;
  const conflictsData = conflictsSettled.status === 'fulfilled' && !conflictsSettled.value.error
    ? conflictsSettled.value.data : null;
  const allergensData = allergensSettled.status === 'fulfilled' && !allergensSettled.value.error
    ? allergensSettled.value.data : null;

  if (bannedSettled.status === 'rejected') console.warn('[analysis] check_banned_substances:', bannedSettled.reason);
  if (globalBansSettled.status === 'rejected') console.warn('[analysis] check_banned_ingredients_worldwide:', globalBansSettled.reason);
  if (conflictsSettled.status === 'rejected') console.warn('[analysis] check_ingredient_conflicts:', conflictsSettled.reason);

  const healthData = (Array.isArray(healthResult.data)
    ? healthResult.data[0]
    : healthResult.data) as Record<string, unknown> ?? {};

  const additiveData = deduplicateAdditives(
    (additiveResult.data ?? []) as AdditiveMatch[]
  );

  const bannedRaw = (bannedData ?? []) as Array<{
    ingredient: string;
    substance_name: string;
    jurisdictions: string[];
    regulatory_body: string | null;
    reason: string | null;
    source_url: string | null;
  }>;

  const bannedSubstances: BannedSubstanceMatch[] = bannedRaw.map((b) => ({
    ingredient: b.ingredient,
    substanceName: b.substance_name,
    jurisdictions: b.jurisdictions ?? [],
    regulatoryBody: b.regulatory_body ?? null,
    reason: b.reason ?? null,
    sourceUrl: b.source_url ?? null,
  }));

  const globalBanRows = (globalBansData ?? []) as BannedIngredientMatch[];
  const conflictRows = (conflictsData ?? []) as IngredientConflictMatch[];
  const allergenRows = (allergensData ?? []) as AllergenMatch[];

  const safety: SafetyAnalysis = {
    verdict: deriveSafetyVerdict(healthData),
    allergenConflicts: (healthData?.allergen_conflicts as string[]) ?? [],
    avoidList: (healthData?.avoid_list as AnalysisItem[]) ?? [],
    cautionList: (healthData?.caution_list as AnalysisItem[]) ?? [],
    beneficialList: (healthData?.beneficial_list as AnalysisItem[]) ?? [],
  };

  const additives: AdditiveAnalysis = {
    severe: additiveData.filter((a) => a.severity === 'severe'),
    high:   additiveData.filter((a) => a.severity === 'high'),
    medium: additiveData.filter((a) => a.severity === 'medium'),
    low:    additiveData.filter((a) => a.severity === 'low'),
    total:  additiveData.length,
  };

  const globalBans: GlobalBanResult = {
    bannedIngredients: globalBanRows,
    hasSevereBan: globalBanRows.some((b) => b.ban_status === 'banned'),
  };

  const conflicts: ConflictResult = {
    conflicts: conflictRows,
    hasSevereConflict: conflictRows.some((c) => c.severity === 'severe'),
  };

  console.log(
    `[analysis] ✅ verdict=${safety.verdict} allergens=${safety.allergenConflicts.length}` +
    ` avoid=${safety.avoidList.length} additives=${additives.total}` +
    ` banned=${bannedSubstances.length} globalBans=${globalBanRows.length}` +
    ` conflicts=${conflictRows.length} allergenMatches=${allergenRows.length}`,
  );

  // Record scan history (non-blocking, authenticated users only)
  if (userId) {
    void supabase
      .from('scanned_history')
      .insert({ user_id: userId, barcode, scanned_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.warn('[analysis] Scan log failed:', error.message); });
  }

  return { safety, additives, bannedSubstances, globalBans, conflicts, allergenMatches: allergenRows };
}

// ─── Skincare Analysis ────────────────────────────────────────────────────────

export async function fetchSkinCareAnalysis(
  ingredientsText: string,
  userId: string | null,
): Promise<SkinCareAnalysisResult | null> {
  if (!supabase) return null;

  const ingredients = parseIngredientsArray(ingredientsText);
  if (!ingredients.length) return null;

  let skinType: string | null = null;
  let skinConcerns: string[] = [];
  let knownSensitivities: string[] = [];

  if (userId) {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('skin_type, skin_concerns, known_skin_sensitivities')
        .eq('id', userId)
        .single();
      if (data) {
        skinType = data.skin_type ?? null;
        skinConcerns = data.skin_concerns ?? [];
        knownSensitivities = data.known_skin_sensitivities ?? [];
      }
    } catch {
      // Proceed without personalization
    }
  }

  try {
    const { data, error } = await supabase.rpc('compute_skincare_score', {
      p_ingredients: ingredients,
      p_skin_type: skinType,
      p_skin_concerns: skinConcerns,
      p_user_sensitivities: knownSensitivities,
    });

    if (error) {
      console.warn('[skincare] RPC error:', error.message);
      return null;
    }

    return data as SkinCareAnalysisResult;
  } catch (err) {
    console.warn('[skincare] fetchSkinCareAnalysis failed:', err);
    return null;
  }
}

// ─── AI Summary ───────────────────────────────────────────────────────────────

export async function fetchAISummary(
  barcode: string,
  userId: string | null | undefined,
  productName: string,
  ingredientsText: string,
  healthConditions: string[],
): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('ai-summary', {
      body: {
        barcode,
        userId: userId ?? null,
        productName,
        ingredientsText: ingredientsText.slice(0, 600),
        healthConditions,
      },
    });
    if (error) return null;
    const result = data as { summary?: string; error?: string };
    const text = result?.summary?.trim();
    if (!text || text.startsWith('Unable to generate')) return null;
    return text;
  } catch {
    return null;
  }
}
