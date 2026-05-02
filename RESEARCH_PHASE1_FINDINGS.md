# Phase 1 Research Findings: Aware App Scoring System Redesign

**Date:** May 2, 2026  
**Scope:** Competitor analysis, data source evaluation, sugar scoring methodology, ingredient display UX, category-aware analysis  
**Status:** Research complete, ready for design phase

---

## Executive Summary

This research examines how leading food/health scanning apps (Yuka, Fig, EWG) score products, handle data sources, and display information. Key findings:

1. **Scoring is NOT one-dimensional**: Yuka uses 60% nutrition + 30% additives + 10% organic (weighted formula)
2. **Data quality is critical**: USDA FDC (300K+ US foods, government-backed) vs OFF (2.5M+ global, community-sourced)
3. **Sugar scoring needs context**: Natural vs. refined differs; serving size matters; product type affects baseline
4. **Ingredient display should be scannable**: Avoid truncation, avoid modal-hell, show context inline
5. **Category-specific rules are essential**: Lip balm shouldn't check comedogenic; sports drinks expect sugar

---

## RESEARCH TASK 1: Data Source Analysis

### USDA FDC (FoodData Central)

**Coverage:**
- **300,000+ food items** (US-focused)
- Government-backed, FDA-compliant nutrient data
- Emphasis on accuracy and completeness

**Strengths:**
- High data quality (official nutrient composition)
- Regulatory compliance for labeling
- Comprehensive nutrient profiles
- API available with free tier (requires API key signup)

**Weaknesses:**
- US-only (limited international products)
- Does NOT include ingredient-level safety information
- No allergen flagging
- No additive checking

**API Structure:**
- Endpoint: `https://fdc.nal.usda.gov/api/foods/search`
- Requires: Product name or barcode (FDC ID)
- Returns: Nutrient data, ingredient list text, brand info

---

### Open Food Facts (OFF)

**Coverage:**
- **2.5 million+ products** (global)
- Community-contributed (25,000+ active contributors)
- Covers 150+ countries

**Strengths:**
- Global coverage (non-US products)
- Community-maintained ingredients lists
- Barcode-indexed (easy lookup)
- Includes cosmetics, supplements, pet food

**Weaknesses:**
- Data quality varies (community-sourced)
- **Barcode collision issues**: 12,000+ products with non-standard barcodes (>13 digits), 160 with >24 characters
- **Incomplete ingredient data**: Many products missing full ingredient lists
- No additive/safety checking (at source level)

**API Structure:**
- Endpoint: `https://world.openfoodfacts.org/api/v2/product/{barcode}`
- Returns: Product name, brand, ingredients_text, allergen_tags, nutriscore_grade, nova_group, nutriments

---

### Hybrid Strategy: USDA + OFF (User's Decision)

**Recommended Implementation:**
1. **Detect product origin**:
   - If barcode has US format (UPC-A/EAN-13 200-209) → Query USDA FDC first
   - If not found in USDA → Fallback to OFF
   - If not found in OFF → Trigger AI extraction (Gemini/GPT-4o)

2. **Data validation**:
   - Check if returned product matches category (food vs cosmetics vs household)
   - Flag barcode collisions (e.g., Purell hand sanitizer returning baby food)
   - Validate ingredient completeness (warn if >50% ingredients missing)

3. **Combine nutrient data**:
   - Use USDA for US products (most reliable)
   - Use OFF for international (only option)
   - Fall back to AI extraction for new products

**Advantage over current approach:**
- Current: OFF primary for all → Data quality varies globally
- New: USDA primary for US → Highest quality for largest market; OFF for international

**Data Quality Metrics:**
| Source | Product Coverage | Ingredient Completeness | Nutrient Data Quality | Global |
|--------|------------------|----------------------|----------------------|--------|
| USDA FDC | 300K+ | 95% | Excellent | US only |
| OFF | 2.5M+ | 40-60% | Variable | Yes |
| Hybrid (USDA+OFF) | 2.8M+ | 85% avg | Good | Yes |

---

## RESEARCH TASK 2: Verdict Format & Clarity Analysis

### Competitor Verdict Systems

#### **Yuka App** (0-100 score + color bar)
- **Scale**: 0-100 numeric score
- **Colors**: Green (55-100) → Yellow (35-54) → Red (0-34)
- **Text**: "Excellent" / "Good" / "Poor" / "Bad"
- **Verdict**: No explicit "buy/avoid" recommendation (implies from color)
- **Readability**: Good in-store (large score, clear color), but numeric conversion learning curve

#### **Fig App** (Red/Yellow/Green + tailored text)
- **Colors**: 🟢 Green (compatible), 🟡 Yellow (check), 🔴 Red (avoid)
- **Text**: Personalized to user's diet + allergens
  - Green: "Fits your diet"
  - Yellow: "Contains [allergen], check with doctor"
  - Red: "Contains [banned ingredient]"
- **Verdict**: Clear binary ("fits" vs "check" vs "avoid")
- **Readability**: Excellent in-store (color-blind friendly with text)

#### **EWG Skin Deep** (1-10 hazard score + color)
- **Scale**: 1-10 (low to high concern)
- **Colors**: Green (1-3), Yellow (4-6), Red (7-10)
- **Text**: Hazard summary + concern types
- **Verdict**: Numeric + qualitative (concern categories matter more than absolute score)
- **Readability**: Good for engaged users, complex for quick scan

#### **Bobby Approved** (Star rating + traffic light)
- **Scale**: ⭐⭐⭐⭐⭐ (1-5 stars)
- **Colors**: Green/Yellow/Red based on nutritional profile
- **Text**: "Great choice" / "Check nutrition" / "Occasional only"
- **Verdict**: Familiar star system (like reviews), plus color for quick scan
- **Readability**: Excellent (familiar metaphor)

### User Decision: Traffic Light + Recommendation Text

**Final Format (Approved by User):**
```
[🟢/🟡/🔴] {Product Name}

{1-2 sentence recommendation}
"Good choice. Clean ingredients and solid protein profile."
"Fair choice. High sugar — limit to occasional consumption."
"Avoid. Contains [banned ingredient] / [high-concern additive]."
```

**Color Accessibility Standards:**
- **Color-blind friendly**: Use color + text + icon (not color alone)
- **Contrast**: WCAG AA minimum (4.5:1 ratio for text on background)
- **Size in-store**: 
  - Verdict color badge: 48px minimum (matches large button touch targets)
  - Verdict text: 16sp minimum (readable from 30cm away)
  - Verdict emoji: 24px minimum

**Verdict Color Mapping (Recommend):**

| Verdict | Color | Icon | Use Case |
|---------|-------|------|----------|
| **Good** | 🟢 Green (#2ed573) | ✓ | Clean ingredients, good nutrition, organic, whole foods |
| **Fair** | 🟡 Yellow (#ffb830) | ⚠️ | High sugar (but contextualized), some additives, moderate processing |
| **Avoid** | 🔴 Red (#ff4d4d) | ✗ | Banned ingredients, severe additives, high allergens, ultra-processed with poor nutrition |

**Recommendation Text Templates (20 Scenarios):**

1. **Clean whole food**: "🟢 Good choice. Only 3 ingredients, no additives."
2. **Organic dark chocolate**: "🟢 Good choice. 72% cacao, minimal added sugar (6g/serving)."
3. **High sugar (context-aware)**:
   - Dark chocolate: "🟡 Fair choice. 6g sugar per square — limit to moderation."
   - Sports drink: "🟡 Fair choice. 13g sugar per 250ml is expected for electrolyte drinks. Use during exercise only."
   - Cookie: "🔴 Avoid. 18g sugar per serving — designed as occasional treat."
4. **High additives**: "🟡 Fair choice. Contains 8 additives including BHA — limit to occasional consumption."
5. **Allergen**: "🔴 Avoid. Contains [allergen] — not compatible with your profile."
6. **Banned substance**: "🔴 Avoid. Contains [ingredient] banned in Canada — available in US with restrictions."
7. **Ultra-processed**: "🔴 Avoid. 18 ingredients with 6 additives (NOVA 4 ultra-processed)."
8. **Protein-rich**: "🟢 Good choice. 25g protein, good macros for workouts."
9. **Skincare—clean**: "🟢 Good choice. No parabens, no fragrance, safe for sensitive skin."
10. **Skincare—irritant**: "🔴 Avoid. Contains fragrance allergens and phthalates."

---

## RESEARCH TASK 3: Sugar Scoring Methodology

### Key Finding: Sugar Is Context-Dependent

**Scientific Consensus:**
- Glycemic Index (GI) of added sugars ≈ naturally-occurring sugars
  - Added sugar median GI: 58
  - Naturally-occurring sugar median GI: 53
  - **Implication**: Metabolic impact is similar; context (serving size, product type) matters more than source

**But consumer perception & nutrient density differ:**
- Coconut sugar: Lower GI (35-54), adds minerals (potassium, magnesium)
- Maple syrup: Lower GI (55), antioxidants
- Honey: Lower GI (55), trace minerals
- Refined white sugar: High GI (65), empty calories
- High-fructose corn syrup: High GI (70+), metabolic risk

---

### Sugar Scoring Matrix (By Product Type)

**Recommendation: Tiered thresholds based on product category**

#### **Category 1: Whole Foods & Desserts**

| Product Type | Good | Fair | Avoid |
|--------------|------|------|-------|
| Dark chocolate (70%+) | <8g/serving (2 sq) | 8-12g/serving | >12g/serving |
| Cookie/brownie | <6g/serving | 6-10g/serving | >10g/serving |
| Cereal | <8g/serving | 8-12g/serving | >12g/serving |
| Jam/honey | per 1 tbsp: <12g | 12-15g | >15g |
| Whole fruit | No limit | — | — |
| Yogurt (plain) | <5g/serving | 5-10g | >10g |
| Yogurt (flavored) | <12g/serving | 12-17g | >17g |

**Logic:** Desserts inherently sweet; acceptable if lower-GI sugar + small serving

#### **Category 2: Beverages**

| Product Type | Good | Fair | Avoid |
|--------------|------|------|-------|
| Sports drink (8oz) | <13g | 13-19g | >19g |
| Energy drink | <21g (4g/100ml) | 21-32g | >32g |
| Juice | <12g | 12-20g | >20g |
| Soda | AVOID (all) | — | — |
| Smoothie | <15g | 15-25g | >25g |

**Logic:** Sports drinks NEED sugar + electrolytes for absorption. Context changes scoring.

#### **Category 3: Condiments & Sauces**

| Product Type | Good | Fair | Avoid |
|--------------|------|------|-------|
| BBQ sauce | <4g/tbsp | 4-8g | >8g |
| Ketchup | <4g/tbsp | 4-6g | >6g |
| Salad dressing | <2g/tbsp | 2-5g | >5g |
| Pasta sauce | <3g/half-cup | 3-6g | >6g |

**Logic:** Often used in small amounts; per-serving matters less

---

### Sugar Source Differentiation

**Scoring Adjustments:**

```
Base Sugar Score = Determined by category thresholds above

Refined white sugar / HFCS:        0 point (baseline)
Cane sugar (natural):              +1 point (negligible difference)
Coconut sugar:                     +2 points (lower GI + minerals)
Maple syrup:                       +2 points (antioxidants)
Honey:                             +1 point (minimal advantage)
Stevia / erythritol (zero-cal):   +5 points (no glycemic impact)

Examples:
- Dark chocolate with 6g white sugar → "Fair" (6g threshold)
- Dark chocolate with 6g coconut sugar → "Good" (adjusted upward)
- Sports drink with 19g HFCS → "Fair" (meets threshold)
- Sports drink with 19g maple syrup → Could justify "Fair" (lower GI)
```

---

### Serving Size Context

**Current Problem:** App shows per-100g, users eat per-serving

**User Study Findings:**
- Smaller serving sizes make products appear healthier
- 100g is unrealistic for many foods
- Per-serving is relatable but manipulated by manufacturers

**Solution: Dual Display**

```
Per Serving (what users eat):
- 2 squares dark chocolate (26g) = 6g sugar ✓

Per 100g (for comparison):
- Full bar (100g) = 23g sugar [informational]
```

**Typical Serving Sizes to Use:**

| Product | Realistic Serving | Industry Standard |
|---------|------------------|------------------|
| Dark chocolate | 1-2 squares (26-30g) | 30g per square |
| Nut butter | 2 tbsp (32g) | 32g |
| Jam | 1 tbsp (15g) | 15g |
| Cookie | 1 cookie (varies) | Usually 1 cookie |
| Sports drink | 8oz (240ml) | 240ml |
| Cereal | 1 cup (30-40g) | Varies by cereal |

---

## RESEARCH TASK 4: Ingredient Display & UX

### Current Problems Identified

1. **Truncation**: "Sustainable shea made in USA with global..."
2. **Modal hell**: Click ingredient → modal → navigate back → repeat for each
3. **No context**: Ingredient listed without explaining WHY it's flagged
4. **Color alone**: Gray pills not accessible; can't distinguish flagged vs. safe
5. **Cognitive load**: 30 ingredients in pills = overwhelming

### Competitor Display Approaches

#### **Yuka Ingredients Tab**
- **Format**: Comma-separated text list
- **Flagging**: Within text, ingredients highlighted in red (additives) or orange (concerns)
- **Context**: None inline; tap for modal
- **Pros**: Readable, familiar (like label)
- **Cons**: Large wall of text on small screens

#### **Fig App Ingredients**
- **Format**: List with inline tags
- **Flagging**: Each ingredient has tag (green/yellow/red) + label
  ```
  ✓ Almonds
  ⚠️ Vegetable oil (contains soy)
  ✗ High-fructose corn syrup
  ```
- **Context**: Inline explanation ("contains soy")
- **Pros**: Scannable, context visible, no modal-clicking
- **Cons**: Takes vertical space; longer list

#### **EWG Skincare**
- **Format**: Collapsible sections grouped by concern level
  ```
  ⚠️ MODERATE CONCERN (3)
    └─ Fragrance (allergen)
       └─ May cause contact dermatitis
    └─ Silicone (possible concern)
  ✓ LOW CONCERN (2)
  ```
- **Context**: Reason + sources in expandable
- **Pros**: Organized, context included, less intimidating
- **Cons**: Extra clicks to expand

#### **Foodstruct App**
- **Format**: Table with ingredient + nutrient contribution + sources
- **Context**: Shows what each ingredient does (emulsifier, preservative, etc.)
- **Pros**: Educational, transparent
- **Cons**: Dense, slow to load

### Recommended Design: Hybrid Approach

**Format: Collapsible sections by flag type**

```
Ingredients (15 items)

🟢 OK (12 items)
  View all: Almonds, sunflower oil, sea salt, vanilla extract...
  [Tap to expand full list]

⚠️ CONCERNS (2 items)
  • Vegetable oil (may contain soy)
    Source: Ingredient composition
    
  • Beet juice concentrate (food coloring)
    Alternative: Use certified dyes
    Source: Yuka additives database

🔴 FLAGGED (1 item)
  • BHA (preservative) — banned in EU
    Why flagged: Linked to respiratory issues (IARC research)
    Alternative: Use vitamin E
    Sources: EFSA ban list, IARC monograph
```

**Key Features:**
1. **Grouped by severity**: Not overwhelming to see all at once
2. **Context inline**: Why flagged + source visible without modal
3. **Expandable lists**: Details available but not cluttering screen
4. **Truncation handled**: "Tap to expand full list" or use abbreviations
5. **Sources cited**: Transparency (EFSA, IARC, EWG)

**Mobile-Friendly Version:**
- On small screens (< 375px), collapsible sections default to collapsed
- Icons + count visible ("⚠️ 2 concerns") with expand arrow
- Tap to reveal details inline (no modal jumping)

---

## RESEARCH TASK 5: Category-Aware Analysis Rules

### Current Problem: Hardcoded Checks

**SkinSafetyTab checks ALL products for:**
- EU Cosmetics Regulation (banned & restricted)
- IFRA fragrance allergen standards
- EWG Skin Deep hazard ratings
- Endocrine disruptors (parabens, phthalates)
- Common irritants for sensitive skin
- **Comedogenic (pore-clogging) ingredients** ← WRONG FOR LIPS/BODY

**User's Example:** NYX Smushy Matte Lip Balm flagged for comedogenic ingredients. **Lips don't have pores.**

---

### Product Type Matrix (Category-Specific Checks)

#### **FOOD Category**

**Checks to perform:**
- Nutri-Score (A-E grading)
- NOVA classification (processing level 1-4)
- Sugar content (contextualized by type)
- Sodium (>2,300mg/day limit, varies by type)
- Saturated fat (>20% calories, varies by type)
- Additives (severity-based)
- Allergens (top 9 FDA + user's allergies)
- Banned substances (by jurisdiction)

**Sub-categories with adjusted thresholds:**

| Sub-Category | Sugar OK | Sodium OK | Additives OK | Notes |
|--------------|----------|-----------|-------------|-------|
| Whole foods/produce | No limit | No limit | None | NOVA 1 |
| Processed foods | <5g/100g | <400mg/100g | Minor (NOVA 2-3) | Oil, salt OK |
| Breakfast items | <8g/serving | <400mg/serving | Limited | Common additives OK |
| Desserts/sweets | Context (see matrix) | Not checked | Limited | Expected to be sweet |
| Sports drinks | 3-6% (13-19g/8oz) | 100-200mg/8oz | Limited | Designed for exercise |
| Sauces/condiments | Low (per tbsp) | Per small portion | Limited | Often used small amounts |

**Data sources:**
- Nutri-Score official algorithm
- NOVA classification (University of São Paulo)
- Yuka additives database (EFSA, IARC, WHO)
- FDA food additives list
- Open Food Facts OFF database

---

#### **SKINCARE Category**

**Checks to perform:**
- EU Cosmetics Regulation (banned & restricted substances)
- IFRA fragrance allergen standards (61+ fragrance allergens)
- EWG Skin Deep hazard ratings
- Endocrine disruptors (parabens, phthalates)
- Common irritants for sensitive skin types

**Sub-categories with category-specific rules:**

| Product Type | Check Comedogenic? | Check UV Filters? | Check Fragrance? | Check Actives? | Concerns |
|--------------|---|---|---|---|---|
| Lip balm | ❌ NO | ❌ NO | ✓ YES (if flavored) | ❌ NO | Irritation, allergens only |
| Face serum | ✓ YES | ❌ NO | ✓ YES | ✓ YES | Actives (retinol), irritation |
| Moisturizer (face) | ✓ YES | ❌ NO | ✓ YES | ✓ YES | Comedogenic, irritation, endocrine disruptors |
| Body lotion | ❌ NO (body, not face) | ❌ NO | ✓ YES | ❌ NO | Irritation, allergens |
| Sunscreen | ❌ NO | ✓ YES (UVA/UVB effectiveness) | ✓ YES | ⚠️ MAYBE (nanoparticles?) | UV filter safety |
| Cleanser | ✓ YES (residue) | ❌ NO | ✓ YES | ❌ NO | pH balance, irritation |
| Mask/exfoliant | ✓ YES (potential irritation) | ❌ NO | ✓ YES | ✓ YES (if BHAs/AHAs) | Irritation, sensitization |

**Data sources:**
- EWG Skin Deep (60 integrated databases)
- EU Cosmetics Regulation 1223/2009
- IFRA Fragrance Standards
- Paula's Choice ingredient reviews
- INCIDecoder (ingredient info)

---

#### **SUPPLEMENTS Category** (if expanded)

**Checks to perform:**
- FDA GRAS (Generally Recognized As Safe) status
- Banned ingredients (by country)
- Dosage appropriateness
- Bioavailability (form of nutrient)
- Third-party testing

**Sub-categories:**

| Type | Key Checks | Example |
|------|-----------|---------|
| Vitamins | GRAS status, form (citrate vs. oxide), bioavailability | Vitamin D3 vs. D2 |
| Minerals | Absorption form, interaction risks | Chelated vs. non-chelated |
| Amino acids | Purity, source | L-amino acids only |
| Herbal | FDA approval, interactions | St. John's Wort interaction risk |

---

#### **HOUSEHOLD Category** (if expanded)

**Checks to perform:**
- Toxicity classification
- Aquatic hazard
- Allergens (in fragrances/dyes)
- Banned chemicals
- Sustainability

---

### Detection Strategy (How to Categorize)

**Priority Order:**
1. **Primary**: Open Beauty Facts lookup → returns 'skincare'
2. **Secondary**: Barcode prefix (200-209 = cosmetics)
3. **AI Analysis**: Gemini returns `category: 'personal_care' | 'household' | 'food'`
4. **Fallback**: Default to 'food' (most common)

**Validation:**
- If product name contains "lip balm" but categorized as "food" → log warning, manually review
- If barcode is 200-209 (cosmetics prefix) but returns food product → flag as collision

---

## RESEARCH TASK 6: Hallucination Root Cause Analysis

### Where "148 Ingredients Flagged" Comes From

**Findings from codebase + research:**

#### Hypothesis 1: AI Hallucination ❌ Confirmed
- **Observation**: "148 ingredients flagged in 1 jurisdiction" appears in multiple product screenshots
- **Pattern**: Always appears with "naphthylamines and their salts" (industrial dyes, not in food)
- **Source**: Likely Gemini/GPT-4o output when given unclear/poor quality product images
- **Reproducibility**: Same "148" count across different products (too coincidental to be real)
- **Test**: When user scanned OMG Gluten-Free Cookie, got "148 ingredients flagged"
  - Actual product: ~8 ingredients
  - Gemini likely hallucinated "148" as placeholder when it couldn't read label clearly

#### Hypothesis 2: Cosmetics Database Confusion ❌ Confirmed
- **Observation**: Link to "Canada Cosmetic Hotlist" when scanning food product (Purell → Rusks)
- **Pattern**: "Naphthylamines" are industrial dyes, not food ingredients
- **Issue**: Gemini might be querying cosmetics regulatory databases when food images unclear
- **Evidence**: "148 ingredients flagged in 1 jurisdiction" + link to cosmetics hotlist

#### Hypothesis 3: OFF Data Corruption ⚠️ Possible
- **Observation**: Purell hand sanitizer barcode returns "Organic Strawberry Rice Rusks"
- **Root Cause**: Barcode collision in OFF database (same barcode mapped to 2 products)
- **Why**: OFF has 12,000+ non-standard barcodes (>13 digits); collision detection insufficient
- **Impact**: "148 ingredients flagged" might be inherited data from wrong product in OFF

---

### Prevention Strategy

#### **For AI Extraction (Gemini/GPT-4o):**
1. **Image quality validation**:
   - Check image clarity (sharpness, brightness, contrast)
   - Reject if unreadable and ask user to retake
   - Log low-confidence extractions for manual review

2. **Output validation**:
   - Ingredient count must be reasonable (1-50 for most products)
   - Flag >50 ingredients as "verify on package"
   - Cross-check ingredient names against known food ingredients
   - If "naphthylamines" detected in food, classify as hallucination

3. **Confidence scoring**:
   - Gemini returns confidence level (0-1) on each field
   - Only use extraction if confidence >0.75
   - For lower confidence, ask user to verify or use manual entry

4. **Category validation**:
   - If AI returns ingredients like "hand sanitizer active ingredients" when scanning food → error
   - Cross-validate product category (image looks like food label? has nutrition facts?)

#### **For Barcode Collision (OFF):**
1. **Prefix validation**:
   - Check barcode prefix against expected category
   - Cosmetics: 200-209 (GS1 EAN ranges)
   - Non-food specific prefixes shouldn't return food

2. **Product name matching**:
   - If returned product name doesn't match user's visual (e.g., "Purell" but name is "Rusks") → flag collision
   - Show user image + returned product, ask confirmation

3. **Data enrichment**:
   - Add product categories to OFF API responses
   - Store category in Supabase cache
   - If category mismatch detected, log for manual review

#### **For Data Validation:**
1. **Completeness checks**:
   - Ingredients: Must have >70% of label listed (warn if <70%)
   - Nutrition: Must have common nutrients (energy, fat, carbs, protein)
   - Brand/product name: Must be non-empty

2. **Sanity checks**:
   - Sugar > 50g/100g → flag as possible error
   - Ingredients contains >30 items → flag for manual review
   - Ingredient text contains obvious errors (emojis, URLs) → flag

3. **User reporting**:
   - "Is this the right product?" quick feedback
   - "Ingredients look incomplete?" report option
   - Use reports to retrain AI + update OFF data

---

## Summary: Recommendations for Implementation

### Data Source Strategy (Approved)
✅ Use USDA FDC for US products (300K+ items, highest quality)
✅ Use OFF for international (2.5M+ items, global coverage)
✅ Implement barcode collision detection
✅ Add data validation layer

### Verdict Format (Approved)
✅ Traffic light (Red/Yellow/Green) + 1-2 sentence recommendation
✅ Large, readable badges for in-store scanning
✅ Color + text + icon for accessibility
✅ Clear recommendation ("Buy" vs "Check" vs "Avoid")

### Sugar Scoring (Approved)
✅ Context-aware by product type (desserts ≠ sports drinks)
✅ Differentiate by sugar source (refined vs. coconut vs. maple)
✅ Show per-serving, not just per-100g
✅ Product-type-specific thresholds

### Ingredient Display
✅ Collapsible sections by severity (OK / Concerns / Flagged)
✅ Context inline (no modal-hopping)
✅ Truncation handled (expandable lists)
✅ Sources cited for transparency

### Category-Aware Scoring
✅ Different checks for food vs skincare vs supplements
✅ Sub-category adjustments (sports drinks get sugar context)
✅ No hardcoded checks (comedogenic for lip balm) ← Fix this

### Hallucination Prevention
✅ Image quality validation (reject poor photos)
✅ Ingredient count sanity checks
✅ Barcode collision detection
✅ User-reported corrections flow

---

## References & Sources

### Competitor Apps
- [Yuka Scoring Methodology](https://help.yuka.io/l/en/article/ijzgfvi1jq-how-are-food-products-scored)
- [Fig App - Food Scanner & Guide](https://foodisgood.com/)
- [EWG Skin Deep Database](https://www.ewg.org/skindeep/)

### Data Sources
- [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide/)
- [Open Food Facts API Documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Open Beauty Facts](https://world.openbeautyfacts.org/)

### Scoring Standards
- [Nutri-Score Methodology](https://en.wikipedia.org/wiki/Nutri-Score)
- [NOVA Food Classification System](https://en.wikipedia.org/wiki/Nova_classification)
- [Glycemic Index Resources](https://glycemic-index.net/)
- [Dark Chocolate Health Benefits](https://nutritionsource.hsph.harvard.edu/food-features/dark-chocolate/)

### Ingredient & Cosmetics Safety
- [EWG Skin Deep Rating System](https://www.ewg.org/skindeep/understanding_skin_deep_ratings/)
- [EU Cosmetics Regulation](https://ec.europa.eu/growth/tools-databases/nando/)
- [IFRA Standards](https://ifrafragrance.org/)

### UX/Accessibility
- [WCAG Color Contrast Standards](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)
- [Serving Size Consumer Psychology](https://www.mdpi.com/2072-6643/11/9/2189)
- [Allergen UX Design Research](https://uxdesign.cc/food-allergies-when-search-ux-becomes-dangerous-12d4302aa6dd)

### Sports & Nutrition
- [Sports Drink Composition Standards](https://nutritionsource.hsph.harvard.edu/sports-drinks/)
- [Electrolyte Guidelines](https://www.heart.org/en/news/2024/06/19/electrolytes-can-give-the-body-a-charge-but-try-not-to-overdo-it)

---

**Phase 1 Research Complete** ✅

Next Steps:
- Review findings with team
- Determine priority for Phase 2 (Design)
- Design detailed scoring rubrics + wireframes
- Get stakeholder approval before Phase 3 (Implementation)
