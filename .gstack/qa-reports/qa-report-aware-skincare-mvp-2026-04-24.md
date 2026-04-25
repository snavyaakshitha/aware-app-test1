# QA Report — Aware Skincare MVP
**Date:** 2026-04-24  
**Branch:** main (uncommitted changes)  
**Scope:** All files modified in the Skincare MVP session  
**Mode:** Code-level QA (React Native — no web preview available)  
**Files reviewed:** 10 modified + 1 new

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 2     |
| Medium   | 2     |
| Low      | 3     |
| Info     | 1     |
| **Total**| **8** |

**Health score: 68/100**  
Core data pipeline is solid. Two high-severity bugs will silently corrupt user data or show wrong UI — they need fixing before release.

---

## Top 3 Issues to Fix

1. **[HIGH-001] Pre-population uses label strings, not IDs** — health conditions auto-populate skin concerns with the wrong values, stored incorrectly in Supabase
2. **[HIGH-002] Recent scans don't carry category** — tapping a recent skincare scan shows food UI
3. **[MED-001] Skincare products show food verdict badge** — meaningless "Acceptable" / Nutri-Score verdict shown above tabs for moisturizers

---

## Issues

### ISSUE-001 · HIGH · Data corruption
**`applyHealthConditionPrepopulation` pushes label strings instead of IDs**

File: `features/onboarding/OnboardingFlow.tsx:52-67`

```ts
// BUG — these are labels, but skinConcerns stores IDs
addConcerns.push('Eczema / Dermatitis');   // should be 'eczema'
addIngredients.push('Fragrance / Parfum'); // should be 'fragrance'
addIngredients.push('SLS');               // should be 'sls'
addConcerns.push('Psoriasis');            // should be 'psoriasis'
addIngredients.push('Parabens');          // should be 'parabens'
addIngredients.push('Phthalates');        // should be 'phthalates'
```

`CheckGrid` checks `value.includes(opt.id)` — so a pre-populated value of `'Eczema / Dermatitis'` will never match `opt.id === 'eczema'`. The chips appear unselected. The user doesn't see any pre-population. Then if they skip without selecting, the label strings (or nothing) get saved to Supabase `skin_concerns`, which won't match `affected_skin_types` in `skincare_ingredient_rules`.

**Fix:** Replace label strings with ID strings.

```ts
// OnboardingFlow.tsx
if (conditions.includes('eczema')) {
  addConcerns.push('eczema');          // ← ID not label
  addIngredients.push('fragrance', 'sls');
}
if (conditions.includes('psoriasis')) {
  addConcerns.push('psoriasis');
}
if (conditions.includes('pcos')) {
  addIngredients.push('parabens', 'phthalates');
}
```

---

### ISSUE-002 · HIGH · Wrong UI for recent scans
**Recent scans navigate without `category` param**

File: `features/main/scanner/ScannerScreen.tsx:417`

```ts
// BUG — no category passed
onPress={() => navigation.navigate('ScanResult', { barcode: item.barcode })}
```

`ScanResultScreen` defaults to `routeCategory ?? 'food'`, so a skincare barcode tapped from "Recent" will run `fetchProductAnalysis` (food scoring), show "Our Take / Nutrition / Ingredients" tabs, and fetch an AI food summary — none of which is correct.

**Fix:** Store category in the `recent` state and pass it through.

```ts
// ScannerScreen.tsx — extend RecentItem
type RecentItem = { barcode: string; name: string; category?: ProductDetectionCategory };

// When setting recent:
setRecent((prev) => [
  { barcode: lookupCode, name: res.product.productName, category },
  ...prev.filter((x) => x.barcode !== lookupCode),
].slice(0, 5));

// When navigating:
onPress={() => navigation.navigate('ScanResult', { barcode: item.barcode, category: item.category })}
```

---

### ISSUE-003 · MEDIUM · Meaningless verdict for skincare
**Food-based verdict badge + headline renders for skincare products**

File: `features/main/scanner/ScanResultScreen.tsx:1243-1303`

For a skincare product: `analysis` is `null`, `effectiveNova` is inferred from ingredient text (likely `null` or `4`), and `nutriscoreGrade` is `null`. The verdict falls through to `'acceptable'` and the headline says something food-specific. This badge appears above the tab bar for ALL products including moisturizers.

A user scanning CeraVe will see "Acceptable" in green before they even tap the Skin Safety tab. That's confusing and undermines trust.

**Fix:** For skincare, either hide the verdict block entirely or replace it with a skincare-appropriate summary derived from `skincareAnalysis`.

```tsx
{/* ScanResultScreen.tsx — in verdictBlock */}
{detectedCategory !== 'skincare' && (
  <View style={styles.verdictBlock}>
    {/* ... existing food verdict pill + headline */}
  </View>
)}
{detectedCategory === 'skincare' && skincareAnalysis && (
  <View style={styles.verdictBlock}>
    <View style={[styles.pill, { ... }]}>
      <Text style={styles.pillText}>
        {skincareAnalysis.verdict === 'clean' ? 'Looks Clean' : `${skincareAnalysis.flagged_ingredients?.length ?? 0} Concerns`}
      </Text>
    </View>
  </View>
)}
```

---

### ISSUE-004 · MEDIUM · Skincare product fetch uses food chain
**`ScanResultScreen` always calls `fetchProductByBarcode` regardless of category**

File: `features/main/scanner/ScanResultScreen.tsx:1076`

```ts
const res = await fetchProductByBarcode(barcode);   // always food chain
```

`fetchProductWithCategory` was written for exactly this purpose (OBF first for skincare, OFF for food) but is never called from ScanResultScreen. A skincare product found in OBF but not OFF will return a `not_found` error on the result screen, even though it would succeed if OBF was tried first.

The risk is low because `fetchProductByBarcode` already tries OBF second in the chain — but ordering matters. OBF products appear earlier in OBF's own search results.

**Fix:** Use `fetchProductWithCategory` when category is known.

```ts
// ScanResultScreen.tsx
import { fetchProductWithCategory } from '../../../shared/productCatalog';

// in load():
const res = await (detectedCategory === 'skincare'
  ? fetchProductWithCategory(barcode)
  : fetchProductByBarcode(barcode));
```

---

### ISSUE-005 · LOW · OBF detect fetches full product JSON
**`detectProductCategory` fetches entire product record just to check `status`**

File: `shared/productCatalog.ts:366`

```ts
const obfUrl = `https://world.openbeautyfacts.org/api/v2/product/${code}`;
// fetches entire product — typically 10-30KB
```

Should add `?fields=code` to get a minimal response, cutting bandwidth 95%.

```ts
const obfUrl = `https://world.openbeautyfacts.org/api/v2/product/${code}?fields=code`;
```

---

### ISSUE-006 · LOW · Barcode prefix detection too narrow
**Only checks `200-209` for beauty, which covers very few real products**

File: `shared/productCatalog.ts:381-383`

L'Oreal (`3`...), Neutrogena (`0`...), CeraVe (`0`...), Dove (`0`...) — none of these match the `200-209` prefix check. The prefix heuristic will almost never trigger for real skincare products. This isn't a crash bug (OBF strategy 1 still catches them) but makes the fallback useless.

If barcode prefix heuristics are kept, consider removing them entirely — they add false confidence without meaningful coverage. Rely solely on the OBF API check.

---

### ISSUE-007 · LOW · `fetchProductWithCategory` exported but never used in ScanResultScreen
**Dead export path**

File: `shared/productCatalog.ts:394`

`fetchProductWithCategory` is exported and correct but ScanResultScreen imports only `fetchProductByBarcode`. Will be resolved by ISSUE-004's fix.

---

### ISSUE-008 · INFO · `not_sure` skin type stored to Supabase
**User can select "Not sure" for skin type, which stores `'not_sure'` in `skin_type`**

File: `shared/onboardingConstants.ts:129`

The `compute_skincare_score` RPC receives `p_skin_type = 'not_sure'`. The function matches rules where `affected_skin_types IS NULL OR affected_skin_types && ARRAY[p_skin_type]`. No rules have `'not_sure'` in `affected_skin_types`, so personalization silently falls back to universal rules only. This is acceptable behavior — but worth noting so the RPC isn't updated to add `not_sure` rules unnecessarily.

Consider storing `NULL` instead of `'not_sure'`:
```ts
skin_type: (finalData.skinType === 'not_sure' ? null : finalData.skinType) ?? null,
```

---

## What's Working Well

- **Scoring architecture** — parallel RPCs with `Promise.allSettled`, graceful fallback when banned substances fail, 15s timeout wrapper. Solid.
- **SkinSafetyTab** — expandable ingredient cards, severity-grouped, source links with HTTPS validation, correct theme tokens (after fix).
- **Category-exclusive tabs** — clean separation, no food tabs leaking into skincare UI.
- **Supabase persistence** — skin fields correctly mapped and upserted. Schema migration is clean.
- **`Screen6PersonalCare`** — stores IDs, displays labels. Correct pattern throughout (once pre-population is fixed).
- **TypeScript** — zero errors in all new/modified files (excluding pre-existing test file issue).

---

## Console Health
*Not testable — React Native app, no browser preview.*

---
*Generated by /qa-only — code review mode (React Native app, no web preview available)*
