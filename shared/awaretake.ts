/**
 * Aware — deterministic scoring helpers extracted for testability.
 *
 * All functions are pure: same inputs always produce the same output.
 * No React, no side effects, no network calls.
 */

import type { OffProductSnapshot, OffNutriments } from './openFoodFacts';
import type {
  ProductAnalysisResult,
  SafetyAnalysis,
  AdditiveAnalysis,
  BannedSubstanceMatch,
} from './scoring';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OverallVerdict = 'green' | 'yellow' | 'red';

// ─── Product sub-category (for context-aware sugar scoring) ──────────────────

export type ProductSubCategory =
  | 'whole_food'
  | 'dark_chocolate'
  | 'chocolate'
  | 'sports_drink'
  | 'energy_drink'
  | 'juice'
  | 'dairy'
  | 'condiment'
  | 'breakfast'
  | 'baked_good'
  | 'snack'
  | 'beverage_other'
  | 'general_food';

export interface SugarThresholds {
  servingG: number;
  green: number;
  yellow: number;
  per100gContext: boolean;
  contextNote?: string;
}

export function inferProductSubCategory(
  off: OffProductSnapshot,
  nova: number | null,
): ProductSubCategory {
  if (nova === 1) return 'whole_food';
  const name = (off.productName ?? '').toLowerCase();
  const brand = (off.brand ?? '').toLowerCase();
  const ingredients = (off.ingredientsText ?? '').toLowerCase();

  if (
    (name.includes('dark chocolate') || name.includes('cacao') || name.includes('cocoa')) &&
    (name.match(/\d{2,3}%/) ||
      ingredients.startsWith('cacao') ||
      ingredients.startsWith('cocoa'))
  ) return 'dark_chocolate';
  if (name.includes('chocolate')) return 'chocolate';

  if (
    name.includes('electrolyte') || name.includes('hydration') ||
    brand.includes('liquid i.v') || brand.includes('liquid iv') ||
    brand.includes('gatorade') || brand.includes('powerade') ||
    name.includes('sports drink')
  ) return 'sports_drink';

  if (
    name.includes('energy drink') || brand.includes('monster') ||
    brand.includes('red bull') || name.includes('bang ')
  ) return 'energy_drink';

  if (name.includes('juice') || name.includes('smoothie')) return 'juice';

  if (
    name.includes('milk') || name.includes('yogurt') || name.includes('yoghurt') ||
    name.includes('kefir') || ingredients.startsWith('milk')
  ) return 'dairy';

  if (
    name.includes('sauce') || name.includes('dressing') || name.includes('ketchup') ||
    name.includes('bbq') || name.includes('jam') || name.includes('honey') ||
    name.includes('mustard') || name.includes('mayo')
  ) return 'condiment';

  if (
    name.includes('cereal') || name.includes('oat') || name.includes('granola') ||
    name.includes('muesli') || name.includes('porridge')
  ) return 'breakfast';

  if (
    name.includes('cookie') || name.includes('biscuit') || name.includes('cake') ||
    name.includes('brownie') || name.includes('muffin') || name.includes('wafer') ||
    name.includes('cracker') || name.includes('bread')
  ) return 'baked_good';

  if (
    name.includes('chip') || name.includes('crisp') || name.includes('pretzel') ||
    name.includes('bar') || name.includes('jerky') || name.includes('popcorn')
  ) return 'snack';

  if (
    name.includes('tea') || name.includes('coffee') || name.includes('latte') ||
    name.includes('drink') || name.includes('beverage')
  ) return 'beverage_other';

  return 'general_food';
}

export function getSugarThresholds(subCat: ProductSubCategory): SugarThresholds {
  switch (subCat) {
    case 'whole_food':
      return { servingG: 100, green: 999, yellow: 999, per100gContext: false,
        contextNote: 'Naturally occurring sugar — not added sugar.' };
    case 'dark_chocolate':
      return { servingG: 28, green: 8, yellow: 12, per100gContext: true,
        contextNote: 'Per 2 squares (28g). Higher cacao % = more antioxidants, less sugar.' };
    case 'chocolate':
      return { servingG: 40, green: 10, yellow: 15, per100gContext: true };
    case 'sports_drink':
      return { servingG: 240, green: 0, yellow: 19, per100gContext: false,
        contextNote: 'Designed for exercise >60 min. Not suitable as a daily beverage.' };
    case 'energy_drink':
      return { servingG: 240, green: 8, yellow: 21, per100gContext: false,
        contextNote: 'High caffeine + sugar. Limit to 1 per day maximum.' };
    case 'juice':
      return { servingG: 240, green: 12, yellow: 20, per100gContext: false,
        contextNote: 'Lacks fibre of whole fruit. Counts toward daily sugar limit.' };
    case 'dairy':
      return { servingG: 200, green: 12, yellow: 20, per100gContext: false,
        contextNote: 'Includes naturally occurring lactose — not added sugar.' };
    case 'condiment':
      return { servingG: 15, green: 3, yellow: 6, per100gContext: false };
    case 'breakfast':
      return { servingG: 45, green: 6, yellow: 12, per100gContext: true };
    case 'baked_good':
      return { servingG: 40, green: 6, yellow: 12, per100gContext: true,
        contextNote: 'Best enjoyed occasionally, not daily.' };
    case 'snack':
      return { servingG: 28, green: 4, yellow: 8, per100gContext: true };
    case 'beverage_other':
      return { servingG: 240, green: 8, yellow: 15, per100gContext: false };
    default:
      return { servingG: 100, green: 5, yellow: 22.5, per100gContext: true };
  }
}

export type NutrientRow = {
  label: string;
  value: number | null;
  unit: string;
  what: string;
  alert: 'red' | 'amber' | 'green' | 'none';
};

// ─── fmtNum ───────────────────────────────────────────────────────────────────
// Prevents float display bugs like "51.9480519kcal".

export function fmtNum(v: number): string {
  if (v === 0) return '0';
  if (Number.isInteger(v)) return String(v);
  const r = Math.round(v * 10) / 10;
  return String(r);
}

// ─── inferNovaGroup ───────────────────────────────────────────────────────────
// Heuristic: products with no ingredient text are likely whole foods (NOVA 1).

export function inferNovaGroup(off: OffProductSnapshot): number | null {
  if (off.novaGroup !== null) return off.novaGroup;
  const text = (off.ingredientsText ?? '').trim();
  if (!text) return 1;
  const parts = text.split(/[,;]/).filter((p) => p.trim().length > 0);
  if (parts.length === 1 && text.split(' ').length <= 4) return 1;
  return null;
}

// ─── deriveOverallVerdict ─────────────────────────────────────────────────────

export function deriveOverallVerdict(
  safety: SafetyAnalysis,
  additives: AdditiveAnalysis,
  banned: BannedSubstanceMatch[],
  nova: number | null,
  ns: string | null,
): OverallVerdict {
  // RED: hard stops
  if (safety.allergenConflicts.length > 0) return 'red';
  if (banned.length > 0) return 'red';
  if (safety.avoidList.length > 0) return 'red';
  if (additives.severe.length > 0) return 'red';

  // YELLOW: concerns present
  if (safety.cautionList.length > 0) return 'yellow';
  if (additives.high.length > 0) return 'yellow';
  if (nova === 4 && ns !== null && ['d', 'e'].includes(ns.toLowerCase())) return 'yellow';

  // GREEN: positive signals with no medium+ additives
  const isClean =
    safety.beneficialList.length > 0 ||
    nova === 1 ||
    (ns !== null && ['a', 'b'].includes(ns.toLowerCase()));
  if (isClean && additives.medium.length === 0) return 'green';

  // YELLOW: no hard concerns but medium additives present
  if (additives.medium.length > 0 || additives.total > 2) return 'yellow';

  return 'green';
}

export function generateVerdictSentence(
  verdict: OverallVerdict,
  off: OffProductSnapshot,
  analysis: ProductAnalysisResult | null,
  effectiveNova: number | null,
): string {
  const nm = off.nutriments;
  const safety = analysis?.safety;
  const additives = analysis?.additives;
  const banned = analysis?.bannedSubstances ?? [];

  if (verdict === 'red') {
    if (safety?.allergenConflicts.length)
      return `Contains ${safety.allergenConflicts[0]} — not compatible with your profile.`;
    if (banned.length > 0)
      return `Contains ${banned[0].substanceName} — banned in ${banned[0].jurisdictions[0]}.`;
    if (safety?.avoidList.length)
      return `Contains ${safety.avoidList[0].ingredient} — flagged for your health conditions.`;
    if (additives?.severe.length)
      return `Contains ${additives.severe[0].ingredient} — severe concern. Best avoided.`;
    return 'Serious concerns detected. See full analysis below.';
  }

  if (verdict === 'yellow') {
    if (additives?.high.length)
      return `${additives.high.length} high-concern additive${additives.high.length > 1 ? 's' : ''} — limit to occasional use.`;
    if (nm?.sugars_100g !== null && nm?.sugars_100g !== undefined && nm.sugars_100g >= 22.5)
      return `High sugar (${fmtNum(nm.sugars_100g)}g/100g) — limit how often you have this.`;
    if (effectiveNova === 4)
      return 'Ultra-processed — check the ingredients list for additives.';
    if (safety?.cautionList.length)
      return `Contains ${safety.cautionList[0].ingredient} — worth checking given your health profile.`;
    return 'Some concerns present — see details before buying regularly.';
  }

  // GREEN
  if (effectiveNova === 1) {
    const parts = off.ingredientsText?.split(',').filter((x) => x.trim()) ?? [];
    if (parts.length > 0 && parts.length <= 5)
      return `Only ${parts.length} ingredient${parts.length !== 1 ? 's' : ''}. Clean and minimally processed.`;
    return 'Whole food. No additives. Minimal processing.';
  }
  if (safety?.beneficialList.length)
    return `Contains ${safety.beneficialList[0].ingredient} — beneficial for your profile.`;
  const ns = off.nutriscoreGrade?.toLowerCase();
  if (ns === 'a' || ns === 'b') return 'Good nutritional balance. A solid everyday choice.';
  return 'No major concerns. Check the full breakdown for details.';
}

// ─── buildNutrientRows ────────────────────────────────────────────────────────

export function buildNutrientRows(
  nm: OffNutriments,
  novaGroup: number | null,
  subCat: ProductSubCategory = 'general_food',
): NutrientRow[] {
  const isWholeFood = novaGroup === 1 || subCat === 'whole_food';
  const thresh = getSugarThresholds(subCat);
  // Computed once to avoid duplicate expressions (salt may be derived from sodium)
  const saltValue = nm.salt_100g ?? (nm.sodium_100g !== null ? nm.sodium_100g * 2.5 : null);

  return [
    {
      label: 'Energy', value: nm.energy_kcal_100g, unit: 'kcal',
      what: nm.energy_kcal_100g !== null
        ? nm.energy_kcal_100g > 450 ? 'Very energy-dense — eat small portions'
        : nm.energy_kcal_100g > 250 ? 'Moderate energy density'
        : nm.energy_kcal_100g === 0 ? 'No calories'
        : 'Low energy density'
        : 'Not available',
      alert: nm.energy_kcal_100g !== null && nm.energy_kcal_100g > 450 ? 'amber' : 'none',
    },
    {
      label: 'Sugar', value: nm.sugars_100g, unit: 'g',
      what: nm.sugars_100g !== null
        ? isWholeFood
          ? nm.sugars_100g > 10
            ? `${fmtNum(nm.sugars_100g)}g/100g — naturally occurring. Not added sugar.`
            : 'Naturally occurring sugar. Not added.'
          : (() => {
              const perServing = (nm.sugars_100g / 100) * thresh.servingG;
              const note = thresh.contextNote ? ` ${thresh.contextNote}` : '';
              if (nm.sugars_100g >= 40)
                return `${fmtNum(nm.sugars_100g)}g/100g (${fmtNum(perServing)}g per serving) — very high.${note}`;
              if (perServing > thresh.yellow)
                return `${fmtNum(nm.sugars_100g)}g/100g (${fmtNum(perServing)}g per serving) — high per WHO guidelines.${note}`;
              if (perServing <= thresh.green)
                return `${fmtNum(nm.sugars_100g)}g/100g (${fmtNum(perServing)}g per serving) — low. Good choice.${note}`;
              return `${fmtNum(nm.sugars_100g)}g/100g (${fmtNum(perServing)}g per serving) — moderate.${note}`;
            })()
        : 'Not available',
      alert: nm.sugars_100g !== null
        ? isWholeFood
          ? 'none'
          : (() => {
              const perServing = (nm.sugars_100g / 100) * thresh.servingG;
              if (perServing > thresh.yellow) return 'red';
              if (perServing > thresh.green) return 'amber';
              return 'green';
            })()
        : 'none',
    },
    {
      label: 'Total Fat', value: nm.fat_100g, unit: 'g',
      what: nm.fat_100g !== null
        ? nm.fat_100g > 17.5 ? 'High fat — check source quality'
        : nm.fat_100g > 3 ? 'Moderate fat'
        : 'Low fat'
        : 'Not available',
      alert: nm.fat_100g !== null && nm.fat_100g > 17.5 ? 'amber' : 'none',
    },
    {
      label: 'Saturated Fat', value: nm.saturated_fat_100g, unit: 'g',
      what: nm.saturated_fat_100g !== null
        ? nm.saturated_fat_100g > 10 ? 'High sat-fat — linked to cardiovascular risk'
        : nm.saturated_fat_100g > 5 ? 'Moderate — watch frequency'
        : 'Low — acceptable level'
        : 'Not available',
      alert: nm.saturated_fat_100g !== null
        ? nm.saturated_fat_100g > 10 ? 'red' : nm.saturated_fat_100g > 5 ? 'amber' : 'green'
        : 'none',
    },
    {
      label: 'Carbohydrates', value: nm.carbohydrates_100g, unit: 'g',
      what: nm.carbohydrates_100g !== null
        ? nm.carbohydrates_100g > 60 ? 'High carb — mostly check sugar fraction'
        : 'Moderate to low carbohydrate'
        : 'Not available',
      alert: 'none',
    },
    {
      label: 'Protein', value: nm.proteins_100g, unit: 'g',
      what: nm.proteins_100g !== null
        ? nm.proteins_100g >= 15 ? 'High protein — good for satiety'
        : nm.proteins_100g >= 5 ? 'Moderate protein'
        : 'Low protein'
        : 'Not available',
      alert: nm.proteins_100g !== null && nm.proteins_100g >= 15 ? 'green' : 'none',
    },
    {
      label: 'Fibre', value: nm.fiber_100g, unit: 'g',
      what: nm.fiber_100g !== null
        ? nm.fiber_100g >= 6 ? 'High fibre — excellent for gut health'
        : nm.fiber_100g >= 3 ? 'Good fibre content'
        : nm.fiber_100g > 0 ? 'Low fibre — look for higher-fibre options'
        : 'No fibre detected'
        : 'Not available',
      alert: nm.fiber_100g !== null && nm.fiber_100g >= 3 ? 'green' : 'none',
    },
    {
      label: 'Salt', value: saltValue, unit: 'g',
      what: saltValue === null ? 'Not available'
        : saltValue > 1.5 ? 'High salt — WHO limit is 5g/day total'
        : saltValue > 0.6 ? 'Medium salt — moderate'
        : 'Low salt — good choice',
      alert: saltValue === null ? 'none'
        : saltValue > 1.5 ? 'red' : saltValue > 0.6 ? 'amber' : 'green',
    },
  ];
}

// ─── generateHeadline ─────────────────────────────────────────────────────────
// Deterministic, data-driven one-liner shown in the header card.

export function generateHeadline(
  off: OffProductSnapshot,
  analysis: ProductAnalysisResult | null,
  effectiveNova: number | null,
): string {
  const nm = off.nutriments;
  const safety = analysis?.safety;
  const additives = analysis?.additives;
  const banned = analysis?.bannedSubstances ?? [];
  const globalBanIngredients = analysis?.globalBans?.bannedIngredients ?? [];

  if (safety?.allergenConflicts.length) {
    const listed = safety.allergenConflicts.slice(0, 2).join(' and ');
    return `Contains ${listed} — conflicts with your profile.`;
  }

  if (banned.length > 0) {
    const first = banned[0];
    const countries = first.jurisdictions.slice(0, 3).join(', ');
    const more = first.jurisdictions.length > 3 ? ` +${first.jurisdictions.length - 3}` : '';
    return `Contains ${first.substanceName} — banned in ${countries}${more}.`;
  }

  // Global ban hits — deduplicate names already captured by the legacy ban check above
  const _legacyBanNames = new Set(banned.map(b => b.substanceName.toLowerCase()));
  const _dedupedGlobal = globalBanIngredients.filter(
    b => !_legacyBanNames.has(b.ingredient_name.toLowerCase()),
  );
  if (_dedupedGlobal.length > 0) {
    const uniqueNames = [...new Set(_dedupedGlobal.map((b) => b.ingredient_name))];
    const uniqueCountries = [...new Set(_dedupedGlobal.map((b) => b.country_code))];
    if (uniqueNames.length === 1) {
      return `Contains ${uniqueNames[0]} — banned in ${uniqueCountries.length} jurisdiction${uniqueCountries.length !== 1 ? 's' : ''}.`;
    }
    return `${uniqueNames.length} ingredients flagged against global ban lists (${uniqueCountries.length} jurisdictions).`;
  }

  if (additives?.severe.length) {
    return `Contains ${additives.severe[0].ingredient} — a severe-concern additive.`;
  }

  if (nm && effectiveNova !== 1) {
    const sugar = nm.sugars_100g;
    const protein = nm.proteins_100g;
    const satFat = nm.saturated_fat_100g;

    if (sugar !== null && sugar >= 40) {
      const spoons = Math.round(sugar / 4);
      const pct = Math.round((sugar / 50) * 100);
      return `${fmtNum(sugar)}g sugar per 100g — ${spoons} teaspoons (${pct}% of WHO daily limit).`;
    }
    if (sugar !== null && sugar >= 22.5) {
      const pct = Math.round((sugar / 50) * 100);
      return `${fmtNum(sugar)}g sugar per 100g (${pct}% of WHO daily limit). Read the full label.`;
    }
    if (protein !== null && protein > 10 && (sugar === null || sugar < 8)) {
      return `${fmtNum(protein)}g protein per 100g — solid macronutrient profile.`;
    }
    if (satFat !== null && satFat > 10) {
      return `${fmtNum(satFat)}g saturated fat per 100g — high. Check the label.`;
    }
  }

  const ns = off.nutriscoreGrade?.toLowerCase();

  if (effectiveNova === 1 && (!additives || additives.total === 0)) {
    const parts = off.ingredientsText
      ? off.ingredientsText.split(',').filter((x) => x.trim().length > 0)
      : [];
    if (parts.length > 0 && parts.length <= 5) {
      return `Only ${parts.length} ingredient${parts.length !== 1 ? 's' : ''}. No additives. No processing.`;
    }
    return 'Whole food. No additives detected.';
  }

  if (effectiveNova === 4 && (ns === 'd' || ns === 'e')) {
    return 'Ultra-processed with very poor nutrition. Engineered to override fullness signals.';
  }
  if (effectiveNova === 4 && additives && additives.total > 0) {
    return `Ultra-processed with ${additives.total} flagged ingredient${additives.total > 1 ? 's' : ''}.`;
  }
  if (effectiveNova === 4) return 'Ultra-processed food. Read the ingredient list carefully.';

  if (additives?.high.length) {
    return `${additives.high.length} high-concern additive${additives.high.length > 1 ? 's' : ''} flagged — tap each one below for the science.`;
  }

  if (safety?.cautionList.length) {
    const item = safety.cautionList[0];
    return `Contains ${item.ingredient} — may interact with your health profile. See Our Take tab.`;
  }

  if (safety?.beneficialList.length) {
    return `Contains ${safety.beneficialList[0].ingredient} — a beneficial ingredient.`;
  }

  if (ns === 'e') return 'Very poor nutritional quality per Nutri-Score.';
  if (ns === 'd') return 'Poor nutritional quality — high in calories, sugar, fat, or salt.';
  if (ns === 'a') return 'Excellent nutritional quality per Nutri-Score.';
  if (ns === 'b') return 'Good nutritional quality per Nutri-Score.';

  return 'Check the full analysis below.';
}

// ─── generateAwareTake ────────────────────────────────────────────────────────
// Deterministic editorial paragraph (not AI) shown in the Our Take tab.

export function generateAwareTake(
  off: OffProductSnapshot,
  analysis: ProductAnalysisResult | null,
  conditions: string[],
  effectiveNova: number | null,
): string {
  const nm = off.nutriments;
  const safety = analysis?.safety;
  const additives = analysis?.additives;
  const banned = analysis?.bannedSubstances ?? [];
  const globalBanIngredients = analysis?.globalBans?.bannedIngredients ?? [];
  const sentences: string[] = [];

  if (banned.length > 0) {
    sentences.push(
      `This product contains ${banned[0].substanceName}, which is banned in ${banned[0].jurisdictions.join(', ')} due to ${(banned[0].reason ?? 'safety concerns').toLowerCase().split('.')[0]}.`,
    );
  } else if (globalBanIngredients.length > 0) {
    const uniqueNames = [...new Set(globalBanIngredients.map((b) => b.ingredient_name))];
    const uniqueCountries = [...new Set(globalBanIngredients.map((b) => b.country_code))];
    const firstName = uniqueNames[0];
    const reason = globalBanIngredients.find((b) => b.reason)?.reason ?? null;
    sentences.push(
      uniqueNames.length === 1
        ? `This product contains ${firstName}, which is banned or restricted in ${uniqueCountries.length} jurisdiction${uniqueCountries.length !== 1 ? 's' : ''}${reason ? ` — ${reason.toLowerCase().split('.')[0]}` : ''}.`
        : `This product contains ${uniqueNames.length} ingredients (including ${firstName}) that appear on global ban lists across ${uniqueCountries.length} jurisdiction${uniqueCountries.length !== 1 ? 's' : ''}.`,
    );
  } else if (safety?.allergenConflicts.length) {
    sentences.push(`This product contains ${safety.allergenConflicts.join(' and ')}, which conflicts with your allergen profile.`);
  } else if (additives?.severe.length) {
    sentences.push(`This product contains ${additives.severe[0].ingredient}, a severe-concern additive linked to documented health risks.`);
  } else if (effectiveNova !== 1 && nm?.sugars_100g !== null && nm?.sugars_100g !== undefined && nm.sugars_100g >= 40) {
    sentences.push(`This is a very high-sugar product — ${fmtNum(nm.sugars_100g)}g per 100g (${Math.round(nm.sugars_100g / 4)} teaspoons of added sugar).`);
  } else if (effectiveNova !== 1 && nm?.sugars_100g !== null && nm?.sugars_100g !== undefined && nm.sugars_100g >= 22.5) {
    sentences.push(`This product contains ${fmtNum(nm.sugars_100g)}g sugar per 100g — worth checking whether that's added sugar or naturally occurring.`);
  }

  if (effectiveNova === 4) {
    const addCount = additives?.total ?? 0;
    sentences.push(
      addCount > 0
        ? `It's ultra-processed (NOVA 4) with ${addCount} flagged ingredient${addCount !== 1 ? 's' : ''} in the formulation.`
        : `It's ultra-processed (NOVA 4), though no high-concern additives were detected in this scan.`,
    );
  } else if (additives?.high.length) {
    sentences.push(`It contains ${additives.high.length} high-concern additive${additives.high.length !== 1 ? 's' : ''} — worth limiting in your regular diet.`);
  } else if (effectiveNova === 1) {
    sentences.push(`It's a whole food with no industrial processing — about as clean as food gets.`);
  } else if (safety?.beneficialList.length) {
    sentences.push(`It contains ${safety.beneficialList[0].ingredient}, which has documented nutritional benefits.`);
  }

  if (conditions.length > 0 && nm && effectiveNova !== 1) {
    const sugar = nm.sugars_100g;
    const satFat = nm.saturated_fat_100g;
    if ((conditions.includes('diabetes_t2') || conditions.includes('diabetes_t1')) && sugar !== null && sugar > 20) {
      sentences.push(`For your diabetes, the sugar level here warrants attention — talk to your doctor before making this a regular choice.`);
    } else if (conditions.includes('pcos') && sugar !== null && sugar > 15) {
      sentences.push(`For your PCOS, high-sugar foods can worsen insulin resistance. Keep this occasional.`);
    } else if (conditions.includes('high_cholesterol') && satFat !== null && satFat > 5) {
      sentences.push(`For your cholesterol, the saturated fat here adds up quickly — watch your portion size.`);
    }
  }

  if (sentences.length === 0) {
    if (effectiveNova === 1) {
      sentences.push('This is a whole, unprocessed food. No industrial ingredients, no additives — exactly what food should be.');
    } else {
      const ns = off.nutriscoreGrade?.toLowerCase();
      sentences.push(
        (ns === 'a' || ns === 'b')
          ? 'No major concerns. Good nutritional profile — a solid everyday choice.'
          : 'No major concerns detected. Check the full breakdown below for details.',
      );
    }
  }

  return sentences.slice(0, 3).join(' ');
}

// ─── getDecisionSummary ───────────────────────────────────────────────────────
// 5-8 word bold sentence shown directly under the verdict pill.
// Designed for grab-and-go users who need an instant reason for the verdict.

export function getDecisionSummary(
  analysis: ProductAnalysisResult | null,
  effectiveNova: number | null,
  nutriscoreGrade: string | null,
): string {
  const safety = analysis?.safety;
  const additives = analysis?.additives;
  const banned = analysis?.bannedSubstances ?? [];
  const globalBanIngredients = analysis?.globalBans?.bannedIngredients ?? [];

  // Allergen conflict — most personal, highest priority
  if (safety?.allergenConflicts.length) {
    const allergen = safety.allergenConflicts[0];
    return `Contains ${allergen} — not safe for you.`;
  }

  // Legacy banned substance
  if (banned.length > 0) {
    const jCount = banned[0].jurisdictions.length;
    return `Substance banned in ${jCount > 1 ? `${jCount} regions` : banned[0].jurisdictions[0]}.`;
  }

  // Global ban hits — deduplicate names already captured by the legacy ban check above
  const legacyBanNames = new Set(banned.map(b => b.substanceName.toLowerCase()));
  const dedupedGlobal = globalBanIngredients.filter(
    b => !legacyBanNames.has(b.ingredient_name.toLowerCase()),
  );
  if (dedupedGlobal.length > 0) {
    const uniqueNames = [...new Set(dedupedGlobal.map((b) => b.ingredient_name))];
    const uniqueCountries = [...new Set(dedupedGlobal.map((b) => b.country_code))];
    const hasUsaBan = uniqueCountries.some((c) => c === 'US');
    const hasEuBan  = uniqueCountries.some((c) => ['EU', 'DE', 'FR', 'GB', 'ES', 'IT'].includes(c));
    const regionLabel = hasUsaBan ? 'the US and other regions'
      : hasEuBan && uniqueCountries.length === 1 ? 'the EU'
      : hasEuBan ? `the EU and ${uniqueCountries.length - 1} other region${uniqueCountries.length > 2 ? 's' : ''}`
      : `${uniqueCountries.length} jurisdiction${uniqueCountries.length !== 1 ? 's' : ''}`;
    if (uniqueNames.length === 1) {
      return `${uniqueNames[0]} is banned in ${regionLabel}.`;
    }
    return `${uniqueNames.length} ingredients flagged in ${regionLabel}.`;
  }

  // Severe additives
  if (additives?.severe.length) {
    return `Contains a severe-concern additive.`;
  }

  // Avoid list (personalized)
  if (safety?.avoidList.length) {
    return `${safety.avoidList.length} ingredient${safety.avoidList.length > 1 ? 's' : ''} flagged for your profile.`;
  }

  // High-concern additives
  if (additives?.high.length) {
    return `${additives.high.length} high-concern additive${additives.high.length > 1 ? 's' : ''} detected.`;
  }

  // Caution list (personalized)
  if (safety?.cautionList.length) {
    return 'Mild concerns — review the details below.';
  }

  // Medium additives
  if (additives?.medium.length) {
    return `${additives.medium.length} moderate-concern ingredient${additives.medium.length > 1 ? 's' : ''}.`;
  }

  // No analysis available — fall back to nutrition
  if (!analysis) {
    if (effectiveNova === 1) return 'Whole food — no additives detected.';
    const ns = nutriscoreGrade?.toLowerCase();
    if (ns === 'a' || ns === 'b') return 'Good nutritional quality.';
    if (ns === 'd' || ns === 'e') return 'Poor nutritional quality.';
    return 'Scan result ready — see details below.';
  }

  // All clear
  if (effectiveNova === 1) return 'Whole food. Minimal processing, no additives.';
  if (additives?.total === 0) return 'No flagged ingredients found.';
  const ns = nutriscoreGrade?.toLowerCase();
  if (ns === 'a') return 'Excellent nutrition. No major concerns.';
  if (ns === 'b') return 'Good nutrition. No major concerns.';
  return 'No major concerns detected.';
}
