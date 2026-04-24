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

export interface ProductAnalysisResult {
  safety: SafetyAnalysis;
  additives: AdditiveAnalysis;
  bannedSubstances: BannedSubstanceMatch[];
}

// ─── Ingredient parser (depth-aware, handles nested parentheses) ──────────────

function parseIngredientsArray(text: string): string[] {
  if (!text?.trim()) return [];
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if ((ch === ',' || ch === ';') && depth === 0) {
      const t = cur.trim();
      if (t) parts.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts
    .map((i) => i.toLowerCase().trim())
    .filter((i) => i.length > 1 && i.length < 80);
}

// ─── Safety verdict derivation ────────────────────────────────────────────────

function deriveSafetyVerdict(healthData: Record<string, unknown>): SafetyAnalysis['verdict'] {
  if ((healthData?.allergen_conflicts as unknown[])?.length > 0) return 'avoid';
  if ((healthData?.avoid_list as unknown[])?.length > 0) return 'check';
  if ((healthData?.caution_list as unknown[])?.length > 0) return 'check';
  return 'safe';
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

  const ingredients = parseIngredientsArray(ingredientsText);
  if (ingredients.length === 0) return null;

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

  // 15s timeout wrapper — Supabase JS v2 doesn't support AbortSignal on rpc()
  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`RPC timed out after ${ms}ms`)), ms),
      ),
    ]);
  }

  // Run all three RPCs in parallel; allSettled shows partial results when any RPC fails
  const [healthSettled, additiveSettled, bannedSettled] = await Promise.allSettled([
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

  // banned is non-fatal — degraded result still shows health/additives
  const bannedData = bannedSettled.status === 'fulfilled' && !bannedSettled.value.error
    ? bannedSettled.value.data
    : null;
  if (bannedSettled.status === 'rejected') {
    console.warn('[analysis] check_banned_substances failed:', bannedSettled.reason);
  } else if (bannedSettled.status === 'fulfilled' && bannedSettled.value.error) {
    console.warn('[analysis] check_banned_substances error:', bannedSettled.value.error.message);
  }

  const healthData = (Array.isArray(healthResult.data)
    ? healthResult.data[0]
    : healthResult.data) as Record<string, unknown> ?? {};

  const additiveData = (additiveResult.data ?? []) as AdditiveMatch[];

  // Map snake_case RPC response to camelCase
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

  console.log(
    `[analysis] ✅ verdict=${safety.verdict} allergens=${safety.allergenConflicts.length}` +
    ` avoid=${safety.avoidList.length} additives=${additives.total}` +
    ` banned=${bannedSubstances.length}`,
  );

  // Record scan history (non-blocking, authenticated users only)
  if (userId) {
    void supabase
      .from('scanned_history')
      .insert({ user_id: userId, barcode, scanned_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.warn('[analysis] Scan log failed:', error.message); });
  }

  return { safety, additives, bannedSubstances };
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
