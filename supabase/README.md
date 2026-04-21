# Supabase setup (Aware)

## 1) Environment variables (Expo)

Create `.env` in the project root (see repo `.env.example`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

## 2) Migrations

This project uses the Supabase CLI (`supabase db push`) against your linked remote.

Initial Phase 1 migration (`migrations/0001_phase1_auth_profile.sql`) is **aligned to an existing schema** where:

- `public.profiles` is created on signup (`handle_new_user`) with columns like `id`, `display_name`, …
- `public.user_profiles` holds extended onboarding fields (`health_conditions`, `allergens`, `diet_preferences`, etc.) and is what the app reads/writes.

That migration:

- Adds an **INSERT** RLS policy on `user_profiles` (required for upsert when the row does not exist yet).
- Updates `handle_new_user()` so new `auth.users` rows also get a matching `user_profiles` row.

## 3) Auth providers

Enable providers in Supabase **Authentication → Providers** as you need (email first is fine).

### Email OTP + magic link

- Under **Email**, ensure sign-in is enabled.
- **Authentication → URL configuration** → **Redirect URLs** must include:
  - `aware://auth/callback`
  - For Expo dev: `exp://127.0.0.1:8081/--/auth/callback` (or the exact URL from `npx uri-scheme list` / Expo Go) if you test magic links there.

The app calls `signInWithOtp` with `emailRedirectTo` = `Linking.createURL('auth/callback')` (see `shared/supabase.ts`). Magic link opens the app and `App.tsx` completes the session via `handleAuthCallbackUrl`.

For OAuth, add the same redirect URLs as above.

## 4) App behavior

- If Supabase env vars are present, the client uses `@supabase/supabase-js` with secure storage.
- Profile/preferences sync uses **`public.user_profiles`** (`id` = `auth.users.id`).
