import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

import type {
  Allergen,
  DietType,
  HealthCondition,
  IngredientToAvoid,
  UserPreferences,
} from './types';

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Deep link used in magic-link emails + OAuth redirects (see `app.json` scheme). */
export function getAuthRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

/**
 * Completes Supabase auth from a redirect URL (magic link, PKCE, or OAuth).
 * Call this from `Linking` initial URL + URL events.
 */
export async function handleAuthCallbackUrl(url: string): Promise<{ error: Error | null }> {
  if (!supabase) {
    return { error: new Error('Supabase is not configured') };
  }

  const readTokenPair = (raw: string) => {
    const trimmed = raw.replace(/^[#?]/, '');
    const params = new URLSearchParams(trimmed);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      return { access_token, refresh_token };
    }
    return null;
  };

  if (url.includes('code=')) {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (!error) return { error: null };
  }

  const hashPart = url.includes('#') ? url.split('#')[1] : '';
  if (hashPart) {
    const tokens = readTokenPair(hashPart);
    if (tokens) {
      const { error } = await supabase.auth.setSession(tokens);
      return { error: error ? new Error(error.message) : null };
    }
  }

  const queryPart = url.includes('?') ? url.split('?')[1] : '';
  if (queryPart && !queryPart.includes('code=')) {
    const tokens = readTokenPair(queryPart);
    if (tokens) {
      const { error } = await supabase.auth.setSession(tokens);
      return { error: error ? new Error(error.message) : null };
    }
  }

  return { error: null };
}

/** Sends email OTP and/or magic link (depends on Supabase email templates). */
export async function signInWithEmailOtp(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const redirectTo = getAuthRedirectUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const clean = token.replace(/\s/g, '');
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: clean,
    type: 'email',
  });
  if (error) throw error;
}

export type OAuthProvider = 'google' | 'apple' | 'facebook';

/** Matches `public.user_profiles` (id = auth.users.id). */
type UserProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  health_conditions: string[];
  allergens: string[];
  diet_preferences: string[];
  ingredients_to_avoid: string[];
  custom_avoids: string[];
  goals: string[];
  onboarding_complete: boolean;
  membership_tier: string | null;
  location: string | null;
  // Skincare profile
  skin_type: string | null;
  skin_concerns: string[];
  known_skin_sensitivities: string[];
};

const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        storage: secureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { unsubscribe: () => void } {
  if (!supabase) {
    return { unsubscribe: () => undefined };
  }
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return {
    unsubscribe: () => data.subscription.unsubscribe(),
  };
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');

  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) return;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = data.url;
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success' && result.url) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (exchangeError) throw exchangeError;
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchUserPreferences(userId: string): Promise<Partial<UserPreferences> | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle<UserProfileRow>();

  if (error) throw error;
  if (!data) return null;

  return {
    name: data.display_name ?? '',
    avatar: data.avatar_url ?? undefined,
    healthConditions: data.health_conditions as HealthCondition[],
    allergens: data.allergens as Allergen[],
    diets: data.diet_preferences as DietType[],
    ingredientsToAvoid: data.ingredients_to_avoid as IngredientToAvoid[],
    customAvoids: data.custom_avoids ?? [],
    location: data.location ?? '',
    membershipTier: (data.membership_tier as UserPreferences['membershipTier']) ?? 'free',
    onboardingComplete: data.onboarding_complete ?? false,
    skin_type: (data.skin_type as UserPreferences['skin_type']) ?? null,
    skin_concerns: (data.skin_concerns ?? []) as UserPreferences['skin_concerns'],
    known_skin_sensitivities: data.known_skin_sensitivities ?? [],
  };
}

export async function upsertUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<void> {
  if (!supabase) return;

  const payload: Record<string, unknown> = { id: userId };

  if (prefs.name !== undefined) payload.display_name = prefs.name;
  if (prefs.avatar !== undefined) payload.avatar_url = prefs.avatar;
  if (prefs.healthConditions !== undefined) {
    payload.health_conditions = prefs.healthConditions as string[];
  }
  if (prefs.allergens !== undefined) payload.allergens = prefs.allergens as string[];
  if (prefs.diets !== undefined) payload.diet_preferences = prefs.diets as string[];
  if (prefs.ingredientsToAvoid !== undefined) {
    payload.ingredients_to_avoid = prefs.ingredientsToAvoid as string[];
  }
  if (prefs.customAvoids !== undefined) payload.custom_avoids = prefs.customAvoids;
  if (prefs.onboardingComplete !== undefined) {
    payload.onboarding_complete = prefs.onboardingComplete;
  }
  if (prefs.membershipTier !== undefined) payload.membership_tier = prefs.membershipTier;
  if (prefs.location !== undefined) payload.location = prefs.location;
  if (prefs.skin_type !== undefined) payload.skin_type = prefs.skin_type ?? null;
  if (prefs.skin_concerns !== undefined) payload.skin_concerns = prefs.skin_concerns as string[];
  if (prefs.known_skin_sensitivities !== undefined) {
    payload.known_skin_sensitivities = prefs.known_skin_sensitivities;
  }

  const { error } = await supabase.from('user_profiles').upsert(payload, {
    onConflict: 'id',
  });
  if (error) throw error;
}
