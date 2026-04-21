# V1: QR / barcode scanner + health score — API & architecture research

This document supports the first release: **scan → identify product → fetch ingredients → score suitability** using the user’s onboarding profile (conditions, allergens, diets, avoids).

## 1) QR codes vs barcodes on packaged food

| Source | What you usually get | How to use it |
|--------|----------------------|---------------|
| **UPC/EAN barcode (1D)** | 8–14 digit **GTIN** (product id) | Canonical for grocery; easiest path for v1. |
| **QR on pack** | Often **marketing URL**, **GS1 Digital Link**, or **app deep link** — sometimes still encodes a **GTIN** in the URL | Parse URL; if path/query contains a numeric GTIN, use it; else fall back to “open URL” or “not a product code”. |

**Practical v1 rule:** treat the scanner output as a **string** → try **numeric GTIN extraction** (digits only, length 8/12/13/14) → call product API → if not found, show “unknown product” and optional manual barcode entry.

**GS1 Digital Link** (increasingly common on packs): URLs like `https://id.gs1.org/01/00012345678905` where `01` identifies GTIN — worth a **small URL parser** in the app or Edge Function so QR scans still resolve to the same pipeline as barcodes.

References: [Open Food Facts API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/), [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link).

## 2) Primary product + ingredients API: Open Food Facts (OFF)

**Why it fits v1**

- Large global database; strong coverage in many regions (varies by country).
- Returns **ingredients text**, parsed ingredients where available, **allergens**, **nutrition**, **labels**, **Nova** / processing signals, images.
- **No API key** for read usage; **must** send a descriptive **User-Agent** (project name + contact) per [OFF etiquette](https://openfoodfacts.github.io/openfoodfacts-server/api/).

**Typical read flow (v2)**

- Get product by code (barcode / GTIN): documented under Product Opener API v2 (world server: `https://world.openfoodfacts.org` — use the official host you standardize in env).
- Use **`fields=`** to limit payload (ingredients, allergens, nutrition, images, countries).

**Operational limits (plan for them)**

- Published guidance includes **per-IP rate limits** on product GETs (order of **~100/min** for product reads — verify current docs before launch).
- **Mitigation:** cache by `barcode` in **Supabase** (`cached_products` / your existing tables), serve cache on repeat scans, and route burst traffic through your **Edge Function** so one IP + server-side throttle is under your control.

**Data quality**

- Missing or outdated products exist; UI should handle **partial** `ingredients_text`, missing allergens, conflicting community edits — show confidence and “report” later, not hard failures.

## 3) Secondary / regional APIs (optional, not required for MVP)

| API | Role | Notes |
|-----|------|--------|
| **Open Food Facts (country mirrors)** | Same schema, better local coverage in some regions | Point `OPEN_FOOD_FACTS_BASE_URL` at regional host if needed (e.g. India subdomain when you standardize it). |
| **USDA FoodData Central** | Strong **nutrient** reference for generic foods | Weak for **packaged retail barcode → branded product** vs OFF; use as **supplement** for nutrition logic, not primary barcode resolution. |
| **Commercial (Nutritionix, Edamam, Spoonacular)** | Paid, stable SLAs, sometimes US-centric | Consider post-MVP if you need guarantees OFF cannot provide. |

For **v1**, **OFF + your own cache + Edge Function** is the standard “best bang for buck” stack.

## 4) Personalized “suitability” and health score (recommended shape)

**Do scoring server-side** (Supabase Edge Function), not only in the app:

- Same rules for all users; you can **version** the model (`SCORING_VERSION` in `shared/foundations.ts`).
- Cache: `(barcode, scoring_version, profile_hash)` → score + explanations.

**Inputs**

- **Product:** `ingredients_text`, `allergens_tags` / traces, `ingredients_analysis_tags`, optional **Nova**, key nutriments (sugar, sodium, saturated fat), labels (organic, etc.).
- **Profile:** normalized onboarding: `HealthCondition[]`, `Allergen[]`, `DietType[]`, `IngredientToAvoid[]`, `custom_avoids[]`.

**Outputs**

- **Score** (0–100), **band** (great / good / caution / avoid), **reasons[]** (allergen conflict, diet mismatch, avoid-list hit, nutrient concern for a condition), **warnings** (missing ingredients, low data quality).

**Optional later:** short natural-language summary via Gemini/OpenRouter **after** deterministic score (never replace rules with LLM for safety-critical allergens).

## 5) Mobile scanning stack (Expo)

- **Camera:** `expo-camera` (supported in Expo) with barcode scanning APIs, or **`expo-barcode-scanner`** if you standardize on that module for v1.
- **Permissions:** camera permission copy for App Store / Play.
- **QR + barcode:** most product codes are **1D**; QR support is still needed when packs use QR (GS1 or URLs).

Prefer **one** scanning implementation in v1 to reduce QA surface.

## 6) End-to-end v1 pipeline (concise)

1. User completes onboarding → persisted in **`user_profiles`** (already aligned).
2. Scanner returns **string** → normalize to **GTIN** when possible.
3. **Edge Function** `GET` product from OFF (or read cache) → normalize product DTO.
4. **Edge Function** runs **scoring** using profile + product → returns score + ingredient-level flags.
5. App shows **result screen**: score, suitability, ingredient highlights, “why” bullets.

## 7) Compliance & trust

- **Allergens:** never promise 100% detection from OCR/text; OFF data can be incomplete — show **disclaimer** and encourage verifying packaging.
- **OFF attribution:** follow their API / data use guidelines and User-Agent policy.
- **Privacy:** scan history and profile are sensitive — RLS + minimal retention policies as you already do with Supabase.

## 8) Summary recommendation

- **v1 product data:** **Open Food Facts** (v2 product-by-code + `fields`), with **Supabase-cached** responses and **Edge Function** aggregation/throttle.
- **v1 personalization:** **deterministic scoring** in Edge Functions using onboarding profile + ingredient/nutrition signals; optional AI text later.
- **v1 scanner:** single Expo camera/barcode solution; **normalize** QR URLs to GTIN when possible so QR and barcode share one backend path.

This matches your existing stack (Expo, Supabase, Edge Functions, Phase 0 scoring contract) and is the usual “best possible” MVP for a global packaged-food scanner without a paid dataset contract.
