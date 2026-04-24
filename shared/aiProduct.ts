/**
 * AI Product Utility
 *
 * - Converts raw AI JSON response → OffProductSnapshot
 * - Caches AI results to AsyncStorage (keyed by barcode)
 * - Checks Supabase products table for already-cached AI scans
 * - Logs scan attempts to scan_logs table
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OffFetchResult, OffProductSnapshot } from './openFoodFacts';
import { supabase } from './supabase';

// ─── Types (mirror of Edge Function output) ───────────────────────────────────

export interface AIProductResult {
  product_name: string | null;
  brand: string | null;
  ingredients: string[];
  nutrition_facts: {
    calories: string | null;
    fat: string | null;
    protein: string | null;
    carbohydrates: string | null;
    sodium: string | null;
    sugar: string | null;
    fiber: string | null;
    serving_size: string | null;
  };
  net_weight: string | null;
  category: 'food' | 'personal_care' | 'household' | null;
  allergens_present: string[];
  image_front_url: string | null;
  image_label_url: string | null;
  model_used: 'gemini-2.0-flash' | 'gpt-4o-mini';
  latency_ms: number;
}

// ─── AsyncStorage keys ────────────────────────────────────────────────────────

const aiKey = (barcode: string) => `@aware_ai_result_${barcode}`;

// ─── Convert AI result → OffProductSnapshot ───────────────────────────────────

export function aiResultToSnapshot(
  barcode: string,
  ai: AIProductResult,
): OffProductSnapshot {
  const source = ai.model_used === 'gpt-4o-mini' ? 'ai_gpt' : 'ai_gemini';
  const sourceLabel =
    ai.model_used === 'gpt-4o-mini'
      ? 'AI Analysis (GPT-4o mini)'
      : 'AI Analysis (Gemini 2.0 Flash)';

  // Build allergensTags from AI-detected allergens (format: "en:milk")
  const allergensTags = (ai.allergens_present ?? []).map(
    (a) => `en:${a.toLowerCase().replace(/\s+/g, '-')}`,
  );

  return {
    code: barcode,
    productName: ai.product_name ?? 'Unknown product',
    brand: ai.brand ?? 'Unknown brand',
    imageUrl: ai.image_front_url ?? null,
    ingredientsText: (ai.ingredients ?? []).join(', '),
    allergensTags,
    tracesTags: [],
    nutriscoreGrade: null,
    novaGroup: null,
    ingredientsAnalysisTags: [],
    nutriments: null,   // AI products use nutritionFacts (string values) instead
    catalogSource: source,
    catalogSourceLabel: sourceLabel,
    nutritionFacts: ai.nutrition_facts ?? null,
    netWeight: ai.net_weight ?? null,
    imageFrontUrl: ai.image_front_url ?? null,
    imageLabelUrl: ai.image_label_url ?? null,
  } as OffProductSnapshot;
}

// ─── Persist AI result locally ────────────────────────────────────────────────

export async function saveAIResult(barcode: string, result: AIProductResult): Promise<void> {
  try {
    await AsyncStorage.setItem(aiKey(barcode), JSON.stringify(result));
  } catch {
    // non-fatal
  }
}

// ─── Load cached AI result ────────────────────────────────────────────────────

export async function loadAIResult(barcode: string): Promise<OffProductSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(aiKey(barcode));
    if (!raw) return null;
    const ai = JSON.parse(raw) as AIProductResult;
    return aiResultToSnapshot(barcode, ai);
  } catch {
    return null;
  }
}

// ─── Check Supabase products cache ───────────────────────────────────────────

export async function fetchCachedProduct(barcode: string): Promise<OffFetchResult | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle<{
        barcode: string;
        product_name: string | null;
        brand: string | null;
        ingredients: string[] | null;
        nutrition_facts: Record<string, string | null> | null;
        source: string;
        image_front_url: string | null;
        image_label_url: string | null;
      }>();

    if (error || !data) return null;

    const isAI = data.source === 'gemini' || data.source === 'gpt-4o-mini';
    const catalogSource = isAI
      ? (data.source === 'gpt-4o-mini' ? 'ai_gpt' : 'ai_gemini')
      : 'supabase_cache';
    const catalogSourceLabel = isAI
      ? (data.source === 'gpt-4o-mini' ? 'AI Analysis (GPT-4o mini)' : 'AI Analysis (Gemini 2.0 Flash)')
      : 'Community Database';

    const snapshot: OffProductSnapshot = {
      code: barcode,
      productName: data.product_name ?? 'Unknown product',
      brand: data.brand ?? 'Unknown brand',
      imageUrl: data.image_front_url ?? null,
      ingredientsText: Array.isArray(data.ingredients)
        ? data.ingredients.join(', ')
        : '',
      allergensTags: [],
      tracesTags: [],
      nutriscoreGrade: null,
      novaGroup: null,
      ingredientsAnalysisTags: [],
      nutriments: null,   // Supabase cache doesn't store OFF nutriments format
      catalogSource,
      catalogSourceLabel,
      nutritionFacts: data.nutrition_facts
        ? {
            calories: data.nutrition_facts.calories ?? null,
            fat: data.nutrition_facts.fat ?? null,
            protein: data.nutrition_facts.protein ?? null,
            carbohydrates: data.nutrition_facts.carbohydrates ?? null,
            sodium: data.nutrition_facts.sodium ?? null,
            sugar: data.nutrition_facts.sugar ?? null,
            fiber: data.nutrition_facts.fiber ?? null,
            serving_size: data.nutrition_facts.serving_size ?? null,
          }
        : undefined,
      imageFrontUrl: data.image_front_url ?? null,
      imageLabelUrl: data.image_label_url ?? null,
    };

    return { ok: true, product: snapshot };
  } catch {
    return null;
  }
}

// ─── Log scan attempt ─────────────────────────────────────────────────────────

export async function logScan(
  barcode: string,
  status: 'completed' | 'failed',
  apiUsed: string,
  responseTimeMs: number,
  userId?: string | null,
  errorMessage?: string,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('scan_logs').insert({
      barcode,
      user_id: userId ?? null,
      status,
      api_used: apiUsed,
      response_time_ms: responseTimeMs,
      error_message: errorMessage ?? null,
    });
  } catch {
    // non-fatal
  }
}

// ─── Call Edge Function ───────────────────────────────────────────────────────

const EDGE_FUNCTION_URL =
  'https://mthfyruozrgrncmfyegq.supabase.co/functions/v1/analyze-product';

export async function callAnalyzeProduct(
  barcode: string,
  frontImageBase64: string,
  labelImageBase64: string,
  userId?: string | null,
): Promise<AIProductResult> {
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!anonKey) {
    throw new Error('Supabase configuration missing. Contact support.');
  }

  // Validate image data
  if (!frontImageBase64 || !labelImageBase64) {
    throw new Error('Image data is incomplete. Please retake the photos.');
  }

  if (!frontImageBase64.includes('data:') && frontImageBase64.length < 1000) {
    throw new Error('Front image is too small. Please take a clearer photo.');
  }

  if (!labelImageBase64.includes('data:') && labelImageBase64.length < 1000) {
    throw new Error('Label image is too small. Please take a clearer photo.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000); // 45 second timeout

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        barcode,
        frontImage: frontImageBase64,
        labelImage: labelImageBase64,
        userId: userId ?? undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Parse error details
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: string; detail?: string; message?: string };
      if (errBody.error) errorMsg = errBody.error;
      if (errBody.detail) errorMsg = `${errorMsg} (${errBody.detail})`;

      // Log for debugging
      console.warn(`[callAnalyzeProduct] ${res.status}: ${errorMsg}`);
    } catch {
      console.warn(`[callAnalyzeProduct] ${res.status}: Could not parse error`);
    }

    if (!res.ok) {
      // Distinguish between provider failures and infrastructure issues
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error(
          'AI analysis service is temporarily unavailable. Please try again in a moment, or use a regular scan.',
        );
      }
      if (res.status === 400) {
        throw new Error('Invalid image format. Please retake the photos with better quality.');
      }
      if (res.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      throw new Error(errorMsg);
    }

    const result = (await res.json()) as AIProductResult;

    // Validate result structure
    if (!result.product_name && !result.brand && (!result.ingredients || result.ingredients.length === 0)) {
      throw new Error('AI could not extract product information. Please try again with clearer photos.');
    }

    console.log(`[callAnalyzeProduct] Success: ${result.model_used} (${result.latency_ms}ms)`);
    return result;
  } catch (err) {
    clearTimeout(timeout);

    if (err instanceof Error) {
      // Abort error (timeout)
      if (err.name === 'AbortError') {
        throw new Error('Image analysis took too long. Please try again with clearer photos or better lighting.');
      }
      throw err;
    }

    throw new Error('Network error. Please check your connection and try again.');
  }
}
