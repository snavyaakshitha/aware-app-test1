# Phase 0 Foundations

This document locks the base contracts for backend implementation and future app integration.

## 1) Canonical identifiers

Use `shared/types.ts` as the source of truth for canonical IDs:

- `HealthCondition`
- `Allergen`
- `DietType`
- `IngredientToAvoid`

Do not introduce new IDs in mock/API layers without adding them to `shared/types.ts` first.

## 2) Scoring contract

Scoring contract is defined in `shared/foundations.ts`:

- Input: `ScoringInput`
- Output: `ScoringOutput`
- Score bands: `great`, `good`, `caution`, `avoid`
- Fixed scoring version constant: `SCORING_VERSION`

The same contract should be used by:

- Supabase Edge Function (`score-product`)
- Mobile app API client
- Cache layer

## 3) Cache key strategy

Use canonical key format:

`barcode:scoringVersion:profileHash`

Helper:

- `buildScoringCacheKey(...)` in `shared/foundations.ts`

This maps directly to DB uniqueness:

- `(barcode, scoring_version, profile_hash)`

## 4) Environment variable design

### Mobile (Expo public vars)

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_OPEN_FOOD_FACTS_BASE_URL` (optional; defaults to OFF v2 base)

### Server (Supabase secrets for Edge Functions)

- `SUPABASE_AI_PROVIDER`
- `SUPABASE_AI_API_KEY`
- `SUPABASE_AI_MODEL`

Never expose server secret keys in `EXPO_PUBLIC_*`.

## 5) Phase 0 completion criteria

Phase 0 is complete when:

1. Canonical IDs are agreed and referenced from one place.
2. Scoring input/output and versioning are fixed.
3. Cache key format is fixed and reusable.
4. Env variable naming is fixed for mobile + server.

All four are now implemented in-code and documented in this project.
