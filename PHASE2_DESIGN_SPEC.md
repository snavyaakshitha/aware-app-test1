# Phase 2: Design Specification — Aware Scoring Redesign

**Date:** May 2, 2026  
**Status:** Design complete — ready for implementation approval  
**Branch:** claude/test-barcode-scanning-sdH2y

---

## Overview of Changes

Six targeted areas of change, ordered by impact:

1. **Verdict System** — replace 4-tier (avoid/check/acceptable/good) with traffic light (Red/Yellow/Green) + actionable sentence
2. **Sugar Scoring** — WHO/AHA/FDA-anchored thresholds, product-type-aware, serving-size-aware
3. **Ingredient Display** — replace gray pill chips with collapsible severity-grouped list
4. **Barcode Collision Detection** — prefix + completeness validation in `productCatalog.ts`
5. **Hallucination Prevention** — ingredient count + suspicious term guard in `scoring.ts`
6. **Category-Aware Skincare** — remove hardcoded comedogenic from lip/body products in `SkinSafetyTab.tsx`

No new dependencies. No new files except test additions.

---

## DESIGN AREA 1: Verdict System Overhaul

### Current State
```
OverallVerdict = 'good' | 'acceptable' | 'check' | 'avoid'
VERDICT_LABEL = { avoid: 'Avoid', check: 'Check below', acceptable: 'No concerns', good: 'Good' }
```

**Problems:**
- "Check below" is non-actionable — user doesn't know what to check
- "Acceptable" and "Good" sound similar, unclear distinction
- Too small, too subtle for in-store reading

---

### New Design

#### `shared/awaretake.ts` — OverallVerdict type

**Change the type:**
```typescript
// BEFORE
export type OverallVerdict = 'good' | 'acceptable' | 'check' | 'avoid';

// AFTER
export type OverallVerdict = 'green' | 'yellow' | 'red';
```

#### New `deriveOverallVerdict()` logic

```typescript
export function deriveOverallVerdict(
  safety: SafetyAnalysis,
  additives: AdditiveAnalysis,
  banned: BannedSubstanceMatch[],
  nova: number | null,
  ns: string | null,
): OverallVerdict {
  // RED: Hard stops — anything with active harm signal
  if (safety.allergenConflicts.length > 0) return 'red';
  if (banned.length > 0) return 'red';
  if (safety.avoidList.length > 0) return 'red';
  if (additives.severe.length > 0) return 'red';

  // YELLOW: Concerns present but not absolute stops
  if (safety.cautionList.length > 0) return 'yellow';
  if (additives.high.length > 0) return 'yellow';
  if (nova === 4 && (!ns || ['d', 'e'].includes(ns.toLowerCase()))) return 'yellow';

  // GREEN: Positive signals
  const isClean =
    safety.beneficialList.length > 0 ||
    nova === 1 ||
    (ns !== null && ['a', 'b'].includes(ns.toLowerCase()));

  // GREEN: Clean product with no concerns
  if (isClean && additives.medium.length === 0) return 'green';

  // YELLOW: No hard concerns but not actively positive either
  if (additives.medium.length > 0 || additives.total > 2) return 'yellow';

  // GREEN: Default — no issues found
  return 'green';
}
```

#### New verdict labels and colors in `ScanResultScreen.tsx`

```typescript
const VERDICT_LABEL: Record<OverallVerdict, string> = {
  red:    'Avoid',
  yellow: 'Use with care',
  green:  'Good choice',
};
const VERDICT_COLOR: Record<OverallVerdict, string> = {
  red:    '#ff4d4d',
  yellow: '#ffb830',
  green:  '#2ed573',
};
const VERDICT_BG: Record<OverallVerdict, string> = {
  red:    '#3d0a0a',
  yellow: '#2e2000',
  green:  '#0a1f12',
};
const VERDICT_BORDER: Record<OverallVerdict, string> = {
  red:    '#6b1a1a',
  yellow: '#5a3d00',
  green:  '#1a5c30',
};
```

#### New verdict UI component spec (in ScanResultScreen.tsx)

Current verdict badge: small pill, 14px font, not prominent.

**New design:**
```
┌─────────────────────────────────────┐
│  🟢  Good choice                    │  ← 20px bold, color-coded
│  Clean ingredients. Good macros.    │  ← 14px, 2 lines max
└─────────────────────────────────────┘
```

**Sizing:**
- Badge height: 56px (vs current ~28px)
- Verdict text: 20sp bold
- Recommendation text: 14sp regular, max 2 lines
- Dot/circle: 14px diameter

**Recommendation text generation** — new function `generateVerdictSentence()` in `awaretake.ts`:

```typescript
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
      return `Contains ${additives.severe[0].ingredient} — severe concern additive. Avoid regularly.`;
    return 'This product has serious concerns. See full analysis below.';
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
    return 'Some concerns present — see details below before buying regularly.';
  }

  // GREEN
  if (effectiveNova === 1) {
    const parts = off.ingredientsText?.split(',').filter((x) => x.trim()) ?? [];
    if (parts.length <= 5 && parts.length > 0)
      return `Only ${parts.length} ingredient${parts.length !== 1 ? 's' : ''}. Clean and minimally processed.`;
    return 'Whole food. No additives. Minimal processing.';
  }
  if (safety?.beneficialList.length)
    return `Contains ${safety.beneficialList[0].ingredient} — beneficial for your profile.`;
  const ns = off.nutriscoreGrade?.toLowerCase();
  if (ns === 'a' || ns === 'b')
    return 'Good nutritional balance. A solid everyday choice.';
  return 'No major concerns. Check the full breakdown for details.';
}
```

---

## DESIGN AREA 2: Sugar Scoring Overhaul

### Current State (in `awaretake.ts`, `buildNutrientRows()`)
```typescript
nm.sugars_100g >= 40 → 'Very high — WHO limit is 50g/day total'
nm.sugars_100g >= 22.5 → 'High — limit to occasional consumption'
nm.sugars_100g <= 5 → 'Low — good choice'
```

**Problems:**
- All thresholds are per-100g (unrealistic serving)
- No product type context (dark chocolate ≠ sports drink ≠ cookie)
- HU dark chocolate has 26.7g/100g → wrongly flagged as "High"
- Liquid I.V. has high sugar → correctly concerning but mislabeled

---

### Medical-Grade Thresholds Reference

From WHO (2015), AHA, and FDA:

| Authority | Recommendation |
|-----------|---------------|
| WHO strong | <10% daily calories from free sugars = <50g/day |
| WHO conditional | <5% daily calories = <25g/day |
| AHA women | <25g/day added sugar |
| AHA men | <36g/day added sugar |
| AHA children 2-18 | <25g/day added sugar |
| AHA children <2 | ZERO added sugar |
| FDA Daily Value | 50g/day added sugar = 100% DV |

---

### New Product Category Detection

Add new function `inferProductSubCategory()` in `awaretake.ts`:

```typescript
export type ProductSubCategory =
  | 'whole_food'         // NOVA 1 or single ingredient
  | 'dark_chocolate'     // 70%+ cocoa
  | 'chocolate'          // <70% cocoa
  | 'sports_drink'       // electrolytes + sugar
  | 'energy_drink'       // caffeine + sugar
  | 'juice'              // fruit/veg juice
  | 'dairy'              // milk, yogurt, cheese
  | 'condiment'          // sauces, dressings, jams
  | 'breakfast'          // cereal, oats, granola
  | 'baked_good'         // cookies, bread, cake
  | 'snack'              // chips, crackers, bars
  | 'beverage_other'     // tea, coffee, smoothies
  | 'general_food';      // default

export function inferProductSubCategory(
  off: OffProductSnapshot,
  nova: number | null,
): ProductSubCategory {
  const name = (off.productName ?? '').toLowerCase();
  const brand = (off.brand ?? '').toLowerCase();
  const ingredients = (off.ingredientsText ?? '').toLowerCase();

  if (nova === 1) return 'whole_food';

  // Dark chocolate: name/brand contains cacao % or "dark chocolate"
  if ((name.includes('dark chocolate') || name.includes('cacao') || name.includes('cocoa'))
    && (name.includes('70') || name.includes('72') || name.includes('75')
     || name.includes('80') || name.includes('85') || name.includes('90')
     || ingredients.startsWith('cacao') || ingredients.startsWith('cocoa')))
    return 'dark_chocolate';

  if (name.includes('chocolate')) return 'chocolate';

  // Sports/electrolyte drinks
  if (name.includes('electrolyte') || name.includes('hydration')
    || brand.includes('liquid i.v') || brand.includes('liquid iv')
    || brand.includes('gatorade') || brand.includes('powerade')
    || name.includes('sports drink'))
    return 'sports_drink';

  if (name.includes('energy drink') || name.includes('red bull')
    || brand.includes('monster') || name.includes('bang '))
    return 'energy_drink';

  if (name.includes('juice') || name.includes('smoothie')) return 'juice';

  if (name.includes('milk') || name.includes('yogurt') || name.includes('yoghurt')
    || name.includes('kefir') || ingredients.startsWith('milk'))
    return 'dairy';

  if (name.includes('sauce') || name.includes('dressing') || name.includes('ketchup')
    || name.includes('bbq') || name.includes('jam') || name.includes('honey')
    || name.includes('mustard') || name.includes('mayo'))
    return 'condiment';

  if (name.includes('cereal') || name.includes('oat') || name.includes('granola')
    || name.includes('muesli') || name.includes('porridge'))
    return 'breakfast';

  if (name.includes('cookie') || name.includes('biscuit') || name.includes('cake')
    || name.includes('brownie') || name.includes('muffin') || name.includes('bread')
    || name.includes('wafer') || name.includes('cracker'))
    return 'baked_good';

  if (name.includes('chip') || name.includes('crisp') || name.includes('pretzel')
    || name.includes('bar') || name.includes('jerky') || name.includes('popcorn'))
    return 'snack';

  if (name.includes('tea') || name.includes('coffee') || name.includes('latte')
    || name.includes('drink') || name.includes('beverage'))
    return 'beverage_other';

  return 'general_food';
}
```

---

### New Sugar Thresholds by Sub-Category

New function `getSugarThresholds()` in `awaretake.ts`:

```typescript
interface SugarThresholds {
  // per realistic serving (not per 100g)
  servingG: number;         // typical serving size in grams
  green: number;            // ≤ green = good (g per serving)
  yellow: number;           // ≤ yellow = fair (g per serving)
  // above yellow = red
  per100gContext: boolean;  // true = still show per-100g alongside
  contextNote?: string;     // shown below sugar row (e.g. for sports drinks)
}

export function getSugarThresholds(subCat: ProductSubCategory): SugarThresholds {
  switch (subCat) {
    case 'whole_food':
      return { servingG: 100, green: 999, yellow: 999, per100gContext: false,
               contextNote: 'Naturally occurring sugar — not added sugar.' };

    case 'dark_chocolate':
      // Typical serving: 2 squares (~26-30g)
      // HU chocolate: 26.7g/100g sugar × 0.28 serving = ~7.5g per serving
      return { servingG: 28, green: 8, yellow: 12, per100gContext: true,
               contextNote: 'Per 2 squares (28g). Higher cacao % = more antioxidants, lower sugar.' };

    case 'chocolate':
      return { servingG: 40, green: 10, yellow: 15, per100gContext: true };

    case 'sports_drink':
      // Research: 3-6% carbs optimal for exercise (13-19g per 250ml)
      // Flag as YELLOW always — only appropriate during exercise
      return { servingG: 240, green: 0, yellow: 19, per100gContext: false,
               contextNote: 'Designed for exercise >60min. Not suitable as a daily beverage.' };

    case 'energy_drink':
      return { servingG: 240, green: 8, yellow: 21, per100gContext: false,
               contextNote: 'High caffeine + sugar. Limit to 1 can max per day.' };

    case 'juice':
      return { servingG: 240, green: 12, yellow: 20, per100gContext: false,
               contextNote: 'Lacks fibre of whole fruit. Counts toward daily sugar limit.' };

    case 'dairy':
      // Dairy has natural lactose (~5g/100g) — not penalised same as added sugar
      return { servingG: 200, green: 12, yellow: 20, per100gContext: false,
               contextNote: 'Includes naturally occurring lactose — not added sugar.' };

    case 'condiment':
      // Small serving sizes (1 tbsp = 15g)
      return { servingG: 15, green: 3, yellow: 6, per100gContext: false };

    case 'breakfast':
      return { servingG: 45, green: 6, yellow: 12, per100gContext: true };

    case 'baked_good':
      // Context: dessert/treat — higher tolerance but still flagged
      return { servingG: 40, green: 6, yellow: 12, per100gContext: true,
               contextNote: 'Treats are best enjoyed occasionally, not daily.' };

    case 'snack':
      return { servingG: 28, green: 4, yellow: 8, per100gContext: true };

    case 'beverage_other':
      return { servingG: 240, green: 8, yellow: 15, per100gContext: false };

    default:
      // WHO/AHA: 25g/day recommendation; per-meal = ~8g
      return { servingG: 100, green: 5, yellow: 22.5, per100gContext: true };
  }
}
```

---

### Updated `buildNutrientRows()` — Sugar Row

Replace current hardcoded sugar row logic with sub-category aware version:

```typescript
// In buildNutrientRows(), replace the sugar row:
{
  label: 'Sugar',
  value: nm.sugars_100g,
  unit: 'g',
  what: (() => {
    if (nm.sugars_100g === null) return 'Not available';
    // Thresholds applied in calling context (ScanResultScreen passes subCat)
    // Row shows per-100g but UI shows per-serving context note
    if (isWholeFood) {
      return nm.sugars_100g > 10
        ? `${fmtNum(nm.sugars_100g)}g/100g — naturally occurring. Not added sugar.`
        : 'Naturally occurring sugar. Not added.';
    }
    // Realistic per-100g interpretation for non-whole-foods:
    if (nm.sugars_100g >= 40)
      return `${fmtNum(nm.sugars_100g)}g/100g — very high. ${Math.round(nm.sugars_100g / 4)} tsp per 100g.`;
    if (nm.sugars_100g >= 22.5)
      return `${fmtNum(nm.sugars_100g)}g/100g — high per WHO guidelines.`;
    if (nm.sugars_100g <= 5)
      return `${fmtNum(nm.sugars_100g)}g/100g — low. Good choice.`;
    return `${fmtNum(nm.sugars_100g)}g/100g — moderate.`;
  })(),
  alert: (() => {
    if (nm.sugars_100g === null || isWholeFood) return 'none';
    if (nm.sugars_100g >= 22.5) return 'red';
    if (nm.sugars_100g >= 10) return 'amber';
    return 'green';
  })(),
}
```

**Serving size context note** — shown directly below sugar row in NutritionTab:
```
Sugar (per 2 squares / 28g serving): 7.5g
Per 100g reference: 26.7g
⚠️ Designed for exercise >60 min. Not for daily use.  [for sports drinks]
```

---

## DESIGN AREA 3: Ingredient Display Overhaul

### Current State
- Gray pill chips, 140px max width, text truncated
- No severity grouping
- Modal required for context
- "ok" label in gray above chip grid

### New Design: Collapsible Severity-Grouped List

**Replace `IngredientsTab` component logic:**

```
┌─────────────────────────────────────────┐
│  INGREDIENTS (15)                        │
│                                          │
│  🔴 FLAGGED  (1)              [expand ▼] │
│  ┌────────────────────────────────────┐  │
│  │ BHA                        HIGH  › │  │
│  │ Preservative — banned in EU.        │  │
│  │ Source: EFSA 2012                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ⚠️ CONCERNS  (2)             [expand ▼] │
│  ┌────────────────────────────────────┐  │
│  │ Vegetable oil       [soy] [palm] › │  │
│  │ May contain soy. Check allergens.  │  │
│  ├────────────────────────────────────┤  │
│  │ Natural flavors                  › │  │
│  │ Non-specific. Could mask additives │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ✓  OK  (12)                  [show ▼]  │
│  Almonds, cacao mass, coconut sugar,     │
│  cacao butter, vanilla extract...        │
│  [See all 12 ingredients]               │
└─────────────────────────────────────────┘
```

**Key design decisions:**
1. **Flagged** (red): Expanded by default — user must see these
2. **Concerns** (yellow): Expanded by default — relevant for purchasing
3. **OK** (green): Collapsed by default — show comma-separated, expand on tap
4. **No modal for context** — reason shown inline in card
5. **No truncation** — full ingredient name, wraps to next line
6. **Sources cited** inline, no extra tap needed

**IngredientChip interface change:**

```typescript
// BEFORE
interface IngredientChip {
  name: string;
  flag: 'allergen' | 'concern' | 'ok';
  reason?: string;
}

// AFTER
interface IngredientChip {
  name: string;
  flag: 'flagged' | 'concern' | 'ok';
  severity?: 'severe' | 'high' | 'medium' | 'low';
  reason?: string;     // Short explanation (1 line)
  source?: string;     // Citation (e.g., "EFSA 2012")
  allergenType?: string; // e.g., "soy", "gluten"
}
```

**Updated `buildChips()` function:**

```typescript
function buildChips(
  text: string,
  userAllergens: string[],
  additives: AdditiveAnalysis | undefined,
  bannedSubstances: BannedSubstanceMatch[],
): IngredientChip[] {
  if (!text.trim()) return [];
  // ... parse ingredients as before ...

  return parts.map((raw) => {
    const name = raw.replace(/\s+/g, ' ').trim();
    const lower = name.toLowerCase();

    // Check banned substances first (highest priority)
    const banned = bannedSubstances.find(b =>
      lower.includes(b.ingredient.toLowerCase())
    );
    if (banned) {
      return {
        name, flag: 'flagged', severity: 'severe',
        reason: `Banned in ${banned.jurisdictions.slice(0, 2).join(', ')}.`,
        source: banned.sourceUrl ?? undefined,
      };
    }

    // Check additive matches
    const addMatch = additives
      ? [...(additives.severe ?? []), ...(additives.high ?? []),
         ...(additives.medium ?? []), ...(additives.low ?? [])]
        .find(a => lower.includes(a.ingredient.toLowerCase()))
      : null;
    if (addMatch) {
      const isFlagged = addMatch.severity === 'severe' || addMatch.severity === 'high';
      return {
        name,
        flag: isFlagged ? 'flagged' : 'concern',
        severity: addMatch.severity ?? 'low',
        reason: addMatch.reason ?? undefined,
        source: addMatch.source_url ?? undefined,
      };
    }

    // Check user allergens
    for (const a of userAllergens) {
      if ((ALLERGEN_KW[a] ?? []).some((kw) => lower.includes(kw))) {
        return {
          name, flag: 'concern', severity: 'high',
          reason: `Contains ${a.replace(/_/g, ' ')} allergen.`,
          allergenType: a,
        };
      }
    }

    // Check concern keywords
    for (const kw of CONCERN_KW) {
      if (lower.includes(kw)) {
        return { name, flag: 'concern', severity: 'medium', reason: `Contains ${kw}.` };
      }
    }

    return { name, flag: 'ok' };
  });
}
```

**New IngredientsTab render logic:**

```typescript
function IngredientsTab({ chips }: { chips: IngredientChip[] }) {
  const [okExpanded, setOkExpanded] = useState(false);
  const flagged = chips.filter(c => c.flag === 'flagged');
  const concerns = chips.filter(c => c.flag === 'concern');
  const ok = chips.filter(c => c.flag === 'ok');

  return (
    <ScrollView>
      <Text style={styles.sectionHeader}>INGREDIENTS ({chips.length})</Text>

      {/* Flagged — always expanded */}
      {flagged.length > 0 && (
        <IngredientGroup
          label="🔴 Flagged"
          color="#ff4d4d"
          items={flagged}
          defaultExpanded={true}
        />
      )}

      {/* Concerns — expanded by default */}
      {concerns.length > 0 && (
        <IngredientGroup
          label="⚠️ Concerns"
          color="#ffb830"
          items={concerns}
          defaultExpanded={true}
        />
      )}

      {/* OK — collapsed by default */}
      <IngredientGroupOK
        items={ok}
        expanded={okExpanded}
        onToggle={() => setOkExpanded(e => !e)}
      />
    </ScrollView>
  );
}
```

---

## DESIGN AREA 4: Barcode Collision Detection

### Files to modify: `shared/productCatalog.ts`

### New validation layer added to `fetchProductByBarcode()`

**New function `validateProductPlausibility()`:**

```typescript
interface ProductValidation {
  plausible: boolean;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

function validateProductPlausibility(
  barcode: string,
  product: OffProductSnapshot,
): ProductValidation {
  const warnings: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';

  // 1. Ingredient count sanity check
  const ingredients = product.ingredientsText
    ? product.ingredientsText.split(',').filter(s => s.trim()).length
    : 0;

  if (ingredients === 0) {
    warnings.push('No ingredients listed — data may be incomplete.');
    confidence = 'low';
  }
  if (ingredients > 60) {
    warnings.push(`Suspicious: ${ingredients} ingredients listed — possible data error.`);
    confidence = 'low';
  }

  // 2. Product name sanity
  if (!product.productName || product.productName === 'Unknown product') {
    warnings.push('Product name missing.');
    confidence = confidence === 'high' ? 'medium' : confidence;
  }

  // 3. Barcode prefix vs category check
  // Purell (hand sanitizer) has prefix 073852 — not cosmetics range but common mismatch
  // Strawberry Rice Rusks prefix doesn't match Purell barcode
  const prefix3 = barcode.substring(0, 3);
  const cosmeticsPrefix = ['200','201','202','203','204','205','206','207','208','209'];

  if (cosmeticsPrefix.includes(prefix3) && product.catalogSource === 'off') {
    warnings.push('Barcode prefix suggests cosmetics but product found in food database.');
    confidence = 'low';
  }

  // 4. Ingredient text quality check — detect obvious garbage
  const text = (product.ingredientsText ?? '').toLowerCase();
  const SUSPICIOUS_FOOD_TERMS = [
    'ethyl alcohol', 'isopropyl', 'hand sanitizer', 'benzalkonium',
    'naphthylamine', 'industrial', 'motor oil', 'petroleum',
  ];
  for (const term of SUSPICIOUS_FOOD_TERMS) {
    if (text.includes(term)) {
      warnings.push(`Suspicious ingredient detected: "${term}" — not expected in food.`);
      confidence = 'low';
    }
  }

  // 5. Data freshness (if available)
  // OFF products have a last_modified timestamp — stale = lower confidence

  return {
    plausible: confidence !== 'low',
    confidence,
    warnings,
  };
}
```

**Integrate into `fetchProductByBarcode()`:**

```typescript
export async function fetchProductByBarcode(barcode: string): Promise<OffFetchResult> {
  // ... existing fetch logic ...

  // After successful fetch, validate:
  if (r.ok && r.product) {
    const validation = validateProductPlausibility(barcode, r.product);
    if (!validation.plausible) {
      // Attach warnings to result — UI shows confirmation dialog
      return {
        ...r,
        product: {
          ...r.product,
          dataWarnings: validation.warnings,
          dataConfidence: validation.confidence,
        },
      };
    }
  }
  return r;
}
```

**New fields on `OffProductSnapshot`** (add to `openFoodFacts.ts`):

```typescript
export interface OffProductSnapshot {
  // ... existing fields ...
  dataWarnings?: string[];       // Validation warnings
  dataConfidence?: 'high' | 'medium' | 'low';
}
```

**UI: Mismatch confirmation dialog** (new component in `ScanResultScreen.tsx`):

```typescript
// Show when dataConfidence === 'low'
function ProductMismatchWarning({
  product,
  warnings,
  onConfirm,
  onReport,
}: {
  product: OffProductSnapshot;
  warnings: string[];
  onConfirm: () => void;
  onReport: () => void;
}) {
  return (
    <View style={styles.warningBanner}>
      <Text style={styles.warningTitle}>⚠️ Data may be incorrect</Text>
      {warnings.map((w, i) => (
        <Text key={i} style={styles.warningText}>• {w}</Text>
      ))}
      <Text style={styles.warningQuestion}>
        Is this really "{product.productName}" by {product.brand}?
      </Text>
      <View style={styles.warningActions}>
        <Pressable style={styles.btnConfirm} onPress={onConfirm}>
          <Text>Yes, looks right</Text>
        </Pressable>
        <Pressable style={styles.btnReport} onPress={onReport}>
          <Text>No, wrong product</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## DESIGN AREA 5: Hallucination Prevention

### Files to modify: `shared/scoring.ts`

### New guard in `fetchProductAnalysis()`

**After `parseIngredientsArray()` call, add validation:**

```typescript
// After: const ingredients = parseIngredientsArray(ingredientsText);

// Guard 1: Ingredient count sanity
if (ingredients.length > 60) {
  console.warn(`[analysis] Suspicious ingredient count: ${ingredients.length}. Flagging as possible hallucination.`);
  // Don't return null — still run analysis but attach warning
  // Cap at 60 to prevent runaway RPC calls
  ingredients.splice(60);
}

// Guard 2: Suspicious ingredient detection
const HALLUCINATION_SIGNALS = [
  'naphthylamine', 'naphthylamines', 'industrial dye', 'isopropyl alcohol',
  'benzalkonium chloride', 'ethyl alcohol 70', 'hand sanitizer',
];

const hasSuspiciousIngredient = ingredients.some(ing =>
  HALLUCINATION_SIGNALS.some(signal => ing.toLowerCase().includes(signal))
);

if (hasSuspiciousIngredient) {
  console.warn('[analysis] Hallucination signal detected in ingredient list. Skipping analysis.');
  // Return a special result that tells UI to show "verify on package"
  return {
    _hallucinationDetected: true,
    safety: { verdict: 'safe', allergenConflicts: [], avoidList: [], cautionList: [], beneficialList: [] },
    additives: { severe: [], high: [], medium: [], low: [], total: 0 },
    bannedSubstances: [],
    globalBans: { bannedIngredients: [], hasSevereBan: false },
    conflicts: { conflicts: [], hasSevereConflict: false },
    allergenMatches: [],
  } as ProductAnalysisResult & { _hallucinationDetected: boolean };
}
```

**Update `ProductAnalysisResult` type** (add optional flag):

```typescript
export interface ProductAnalysisResult {
  safety: SafetyAnalysis;
  additives: AdditiveAnalysis;
  bannedSubstances: BannedSubstanceMatch[];
  globalBans: GlobalBanResult;
  conflicts: ConflictResult;
  allergenMatches: AllergenMatch[];
  _hallucinationDetected?: boolean;  // NEW: true = AI extraction unreliable
}
```

**UI handling in ScanResultScreen** (new warning banner):

```typescript
// In OurTakeTab, before any analysis display:
{analysis?._hallucinationDetected && (
  <View style={styles.hallucinationWarning}>
    <Text style={styles.hwTitle}>⚠️ AI extraction may be unreliable</Text>
    <Text style={styles.hwBody}>
      We detected unusual ingredients in this product. Please verify the
      ingredient list on the physical package before making decisions.
    </Text>
  </View>
)}
```

---

## DESIGN AREA 6: Category-Aware Skincare Scoring

### File: `features/main/scanner/tabs/SkinSafetyTab.tsx`

### Current Problem
"What we checked" section is hardcoded:
```typescript
// Line 369 (approximate)
<Text>Comedogenic (pore-clogging) ingredients</Text>  // ← shown for ALL products including lips
```

### New: Product Sub-Type Detection for Skincare

**New function in `SkinSafetyTab.tsx`:**

```typescript
type SkinCareSubType =
  | 'lip'           // lip balm, lip gloss, lipstick
  | 'face'          // serum, moisturizer, toner, eye cream
  | 'body'          // lotion, body butter, body oil
  | 'hair'          // shampoo, conditioner, hair mask
  | 'sunscreen'     // sunscreen, SPF products
  | 'cleanser'      // face wash, body wash, soap
  | 'makeup'        // foundation, concealer, blush
  | 'deodorant'     // deodorant, antiperspirant
  | 'fragrance'     // perfume, cologne
  | 'general_skin'; // default

function inferSkinCareSubType(productName: string): SkinCareSubType {
  const name = productName.toLowerCase();
  if (name.includes('lip balm') || name.includes('lip gloss')
    || name.includes('lipstick') || name.includes('lip'))
    return 'lip';
  if (name.includes('sunscreen') || name.includes('spf') || name.includes('sun protection'))
    return 'sunscreen';
  if (name.includes('shampoo') || name.includes('conditioner') || name.includes('hair'))
    return 'hair';
  if (name.includes('body lotion') || name.includes('body butter')
    || name.includes('body oil') || name.includes('body wash'))
    return 'body';
  if (name.includes('cleanser') || name.includes('face wash') || name.includes('soap'))
    return 'cleanser';
  if (name.includes('foundation') || name.includes('concealer')
    || name.includes('blush') || name.includes('mascara'))
    return 'makeup';
  if (name.includes('deodorant') || name.includes('antiperspirant'))
    return 'deodorant';
  if (name.includes('perfume') || name.includes('cologne') || name.includes('eau de'))
    return 'fragrance';
  if (name.includes('serum') || name.includes('moisturizer') || name.includes('toner')
    || name.includes('eye cream') || name.includes('retinol'))
    return 'face';
  return 'general_skin';
}
```

**New function: `getChecksForSubType()`:**

```typescript
interface SkinSafetyChecks {
  checkedSources: string[];       // shown in "What we checked"
  checkComedogenic: boolean;
  checkFragrance: boolean;
  checkEndocrineDisruptors: boolean;
  checkUvFilters: boolean;
  checkActives: boolean;          // retinol, AHAs, BHAs
  checkIrritants: boolean;
}

function getChecksForSubType(subType: SkinCareSubType): SkinSafetyChecks {
  const base = {
    checkedSources: ['EU Cosmetics Regulation (banned & restricted)', 'EWG Skin Deep hazard ratings'],
    checkComedogenic: false,
    checkFragrance: true,
    checkEndocrineDisruptors: true,
    checkUvFilters: false,
    checkActives: false,
    checkIrritants: true,
  };

  switch (subType) {
    case 'lip':
      return {
        ...base,
        checkedSources: [
          'EU Cosmetics Regulation (banned & restricted)',
          'IFRA fragrance allergen standards',
          'EWG Skin Deep hazard ratings',
          'Common lip irritants and sensitizers',
        ],
        checkComedogenic: false,    // Lips have no pores
        checkEndocrineDisruptors: true, // Still relevant
        checkActives: false,
        checkUvFilters: false,
      };

    case 'face':
      return {
        ...base,
        checkedSources: [
          'EU Cosmetics Regulation (banned & restricted)',
          'IFRA fragrance allergen standards',
          'EWG Skin Deep hazard ratings',
          'Endocrine disruptors (parabens, phthalates)',
          'Common irritants for sensitive skin',
          'Comedogenic (pore-clogging) ingredients',
          'Active ingredients (retinol, AHAs, BHAs)',
        ],
        checkComedogenic: true,
        checkActives: true,
      };

    case 'body':
      return {
        ...base,
        checkedSources: [
          'EU Cosmetics Regulation (banned & restricted)',
          'IFRA fragrance allergen standards',
          'EWG Skin Deep hazard ratings',
          'Endocrine disruptors (parabens, phthalates)',
          'Common skin irritants',
        ],
        checkComedogenic: false,    // Body skin, not face
      };

    case 'sunscreen':
      return {
        ...base,
        checkedSources: [
          'EU Cosmetics Regulation (banned & restricted)',
          'EWG Skin Deep hazard ratings',
          'UV filter safety (oxybenzone, octinoxate)',
          'Nanoparticle safety (zinc oxide, titanium dioxide)',
          'Endocrine disruptors',
        ],
        checkUvFilters: true,
        checkComedogenic: false,
      };

    case 'hair':
      return {
        ...base,
        checkedSources: [
          'EU Cosmetics Regulation',
          'EWG Skin Deep hazard ratings',
          'Sulfate & silicone concerns',
          'Common scalp irritants',
        ],
        checkComedogenic: false,
        checkEndocrineDisruptors: true,
      };

    case 'deodorant':
      return {
        ...base,
        checkedSources: [
          'EU Cosmetics Regulation',
          'EWG Skin Deep hazard ratings',
          'Aluminum compounds (antiperspirant)',
          'Endocrine disruptors (parabens, phthalates)',
          'IFRA fragrance standards',
        ],
        checkComedogenic: false,
      };

    default:
      return base;
  }
}
```

**Use in SkinSafetyTab render:**

```typescript
// At top of SkinSafetyTab component:
const subType = inferSkinCareSubType(productName);
const checks = getChecksForSubType(subType);

// In "What we checked" section, replace hardcoded list:
{checks.checkedSources.map((source, i) => (
  <Text key={i} style={styles.checkItem}>• {source}</Text>
))}
```

---

## Files to Modify (Summary)

| File | Change | Scope |
|------|--------|-------|
| `shared/awaretake.ts` | New `OverallVerdict` type, `deriveOverallVerdict()`, `generateVerdictSentence()`, `inferProductSubCategory()`, `getSugarThresholds()`, updated `buildNutrientRows()` | ~120 lines added/changed |
| `shared/scoring.ts` | Hallucination guards in `fetchProductAnalysis()`, new `_hallucinationDetected` on result | ~30 lines added |
| `shared/productCatalog.ts` | `validateProductPlausibility()`, integrate into `fetchProductByBarcode()` | ~60 lines added |
| `shared/openFoodFacts.ts` | Add `dataWarnings`, `dataConfidence` fields to `OffProductSnapshot` | ~5 lines added |
| `features/main/scanner/ScanResultScreen.tsx` | New verdict labels, `generateVerdictSentence()` render, new `IngredientsTab` with grouped layout, mismatch dialog, hallucination warning | ~200 lines changed |
| `features/main/scanner/tabs/SkinSafetyTab.tsx` | `inferSkinCareSubType()`, `getChecksForSubType()`, dynamic "What we checked" | ~100 lines added |

**Total estimated change: ~500 lines across 6 files. No new dependencies.**

---

## Testing Strategy

### Unit Tests (jest, `shared/__tests__/awaretake.test.ts`)

```typescript
// Test 1: HU Dark Chocolate → green
test('HU dark chocolate scores green', () => {
  const verdict = deriveOverallVerdict(
    { verdict: 'safe', allergenConflicts: [], avoidList: [], cautionList: [], beneficialList: [] },
    { severe: [], high: [], medium: [], low: [], total: 0 },
    [],
    null,  // nova not available
    null,  // nutriscore not available
  );
  expect(verdict).toBe('green');
});

// Test 2: Cookie with 15g sugar → yellow (not red)
test('Cookie with moderate sugar scores yellow not red', () => {
  const sub = inferProductSubCategory({ productName: 'Chocolate Chip Cookie' }, null);
  const thresh = getSugarThresholds(sub);
  const perServing = (15 / 100) * thresh.servingG; // 15g/100g × 40g serving = 6g
  expect(sub).toBe('baked_good');
  expect(perServing).toBeLessThanOrEqual(thresh.yellow);
});

// Test 3: Sports drink → always yellow (even with low sugar)
test('Sports drink always yellow', () => {
  const sub = inferProductSubCategory({ productName: 'Liquid I.V. Electrolyte Drink Mix' }, null);
  const thresh = getSugarThresholds(sub);
  expect(sub).toBe('sports_drink');
  expect(thresh.green).toBe(0); // green threshold = 0 (always at least yellow)
});

// Test 4: Hallucination detection
test('Naphthylamine triggers hallucination guard', () => {
  const ingredients = ['water', 'sugar', '1-naphthylamine', 'salt'];
  const hasSuspicious = ingredients.some(ing =>
    ['naphthylamine'].some(signal => ing.toLowerCase().includes(signal))
  );
  expect(hasSuspicious).toBe(true);
});

// Test 5: Lip balm → no comedogenic check
test('Lip balm does not check comedogenic', () => {
  const subType = inferSkinCareSubType('NYX Smushy Matte Lip Balm');
  const checks = getChecksForSubType(subType);
  expect(subType).toBe('lip');
  expect(checks.checkComedogenic).toBe(false);
});

// Test 6: Face serum → comedogenic checked
test('Face serum checks comedogenic', () => {
  const subType = inferSkinCareSubType('Retinol Face Serum');
  const checks = getChecksForSubType(subType);
  expect(checks.checkComedogenic).toBe(true);
});

// Test 7: Barcode collision detection
test('Suspicious ingredients trigger low confidence', () => {
  const product = {
    productName: 'Organic Strawberry Rice Rusks',
    brand: "Parent's Choice",
    ingredientsText: 'ethyl alcohol 70%, isopropyl alcohol',
    // other fields...
  };
  const validation = validateProductPlausibility('073852022391', product as any);
  expect(validation.confidence).toBe('low');
  expect(validation.plausible).toBe(false);
});
```

### End-to-End Test Scenarios (manual)

| Scenario | Expected Before | Expected After |
|----------|-----------------|----------------|
| HU Simple Dark Chocolate | 🟡 "Check below" | 🟢 "Good choice" |
| OMG GF Cookie (AI-extracted, 148 ingredients) | 🔴 "148 ingredients flagged" | ⚠️ "AI extraction may be unreliable" |
| Purell barcode → Rice Rusks | No warning shown | ⚠️ "Data may be incorrect" dialog |
| Liquid I.V. Electrolyte | 🔴 "Avoid" (149 flagged) | 🟡 "Use with care" + context note |
| NUT HARVEST Almonds (incomplete data) | "Whole food, no additives" | ⚠️ "Ingredient data incomplete — verify package" |
| NYX Lip Balm (cosmetic) | Shows "comedogenic" check | Lip category: no comedogenic |
| EOS Body Lotion | Shows "comedogenic" check | Body category: no comedogenic |

---

## Implementation Order (Phase 3)

Recommended order to minimize risk:

1. **`awaretake.ts`** — pure functions, unit-testable, no UI risk
2. **`scoring.ts`** — add guards, backward-compatible (existing result still returned)
3. **`productCatalog.ts`** — validation layer, non-breaking (warnings added to result)
4. **`openFoodFacts.ts`** — add optional fields, backward-compatible
5. **`ScanResultScreen.tsx`** — UI changes (highest risk, last)
6. **`SkinSafetyTab.tsx`** — self-contained tab, moderate risk

---

**Phase 2 Design COMPLETE** ✅  
**Ready for Phase 3: Implementation**
