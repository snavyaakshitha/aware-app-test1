/**
 * Aware — Root App
 *
 * Screen flow: Splash → Sign In → Onboarding (first time) → Main (tabs)
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { Feather, AntDesign, Ionicons, FontAwesome5 } from '@expo/vector-icons';

import SplashScreen from './features/splash-screen/SplashScreen';
import SignInScreen from './features/sign-in/SignInScreen';
import MainNavigator from './features/main/MainNavigator';
import OnboardingFlow from './features/onboarding/OnboardingFlow';

import { Colors } from './shared/theme';
import {
  fetchUserPreferences,
  getCurrentSession,
  getCurrentUser,
  handleAuthCallbackUrl,
  isSupabaseConfigured,
  onAuthStateChange,
  signInWithOAuth,
  type OAuthProvider,
} from './shared/supabase';

type AppScreen = 'splash' | 'signin' | 'onboarding' | 'main';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [fontsLoaded, fontError] = Font.useFonts({
    ...Feather.font,
    ...AntDesign.font,
    ...Ionicons.font,
    ...FontAwesome5.font,
  });
  const [splashDone, setSplashDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
    setScreen('signin');
  }, []);

  /** After auth, check if onboarding is done, then route accordingly. */
  const goAfterAuth = useCallback(async (resolvedUserId: string | null) => {
    if (resolvedUserId) {
      await fetchUserPreferences(resolvedUserId).catch(() => undefined);
    }
    setUserId(resolvedUserId);
    try {
      const done = await AsyncStorage.getItem('@aware_onboarding_complete');
      if (done === 'true') {
        setScreen('main');
      } else {
        setScreen('onboarding');
      }
    } catch {
      setScreen('onboarding');
    }
  }, []);

  // Keep legacy name for Supabase callbacks
  const goToMainAfterAuth = useCallback(async (resolvedUserId: string) => {
    await goAfterAuth(resolvedUserId);
  }, [goAfterAuth]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    const bootstrap = async () => {
      const session = await getCurrentSession();
      if (!isMounted || !session?.user) return;
      await goToMainAfterAuth(session.user.id);
    };

    bootstrap().catch(() => undefined);

    const sub = onAuthStateChange((event, session) => {
      if (!isMounted || !session?.user) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        goToMainAfterAuth(session.user.id).catch(() => undefined);
      }
    });

    return () => {
      isMounted = false;
      sub.unsubscribe();
    };
  }, [goToMainAfterAuth]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const processUrl = async (url: string | null) => {
      if (!url) return;
      const looksLikeAuth =
        url.includes('access_token') ||
        url.includes('refresh_token') ||
        url.includes('code=') ||
        url.includes('auth/callback');
      if (!looksLikeAuth) return;
      await handleAuthCallbackUrl(url);
    };

    const sub = Linking.addEventListener('url', async ({ url }) => {
      await processUrl(url);
    });

    Linking.getInitialURL()
      .then((url) => processUrl(url))
      .catch(() => undefined);

    return () => sub.remove();
  }, []);

  const handleOAuthSignIn = useCallback(async (provider: OAuthProvider) => {
    if (!isSupabaseConfigured) {
      // Demo mode: no Supabase, still show onboarding if not done
      await goAfterAuth(null);
      return;
    }

    await signInWithOAuth(provider);
    const user = await getCurrentUser();
    if (user) {
      await goToMainAfterAuth(user.id);
    }
  }, [goAfterAuth, goToMainAfterAuth]);

  // Block render only while fonts are actively loading.
  // If they error (404 on web) we still show the app — icons may degrade but nothing freezes.
  if (!fontsLoaded && !fontError) {
    return <View style={styles.root} />;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {screen === 'main' && (
          <NavigationContainer>
            <MainNavigator />
          </NavigationContainer>
        )}

        {screen === 'onboarding' && (
          <OnboardingFlow
            userId={userId}
            onComplete={() => setScreen('main')}
          />
        )}

        {(screen === 'signin' || screen === 'splash') && (
          <View style={StyleSheet.absoluteFill}>
            <SignInScreen
              onOAuthSignIn={handleOAuthSignIn}
              shouldAnimate={splashDone && screen === 'signin'}
            />

            {screen === 'splash' && <SplashScreen onComplete={handleSplashComplete} />}
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
