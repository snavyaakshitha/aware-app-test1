/**
 * Aware — Sign In Screen
 *
 * OAuth + email OTP / magic link (Supabase). Email flow uses `signInWithOtp` +
 * `verifyOtp`; magic links complete via deep link in `App.tsx`.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AntDesign, FontAwesome5, Feather } from '@expo/vector-icons';
import {
  getCurrentSession,
  isSupabaseConfigured,
  signInWithEmailOtp,
  verifyEmailOtp,
  type OAuthProvider,
} from '../../shared/supabase';

// ─── Scale helpers (Figma canvas: 393×852) ────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const scale = Math.min(SCREEN_W / 393, SCREEN_H / 852);
function s(px: number): number {
  return Math.round(px * scale);
}

const FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});
const FONT_BOLD = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

// ─── Auth Button ──────────────────────────────────────────────────────────────
interface AuthButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  /** Animated.Value driven by SignInScreen's stagger sequence */
  anim: Animated.Value;
}

function AuthButton({ icon, label, onPress, anim }: AuthButtonProps) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(pressScale, {
      toValue: 0.965,
      useNativeDriver: true,
      tension: 400,
      friction: 20,
    }).start();

  const onPressOut = () =>
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 400,
      friction: 20,
    }).start();

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(28), 0],
  });

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY }, { scale: pressScale }],
        marginBottom: s(12),
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', radius: s(171) }}
        style={styles.button}
      >
        {/* Provider logo box — 24×24 white square, Figma spec */}
        <View style={styles.buttonIconBox}>{icon}</View>
        <Text style={styles.buttonLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ─── Screen ───────────────────────────────────────────────────────────────────
interface Props {
  onOAuthSignIn: (provider: OAuthProvider) => void | Promise<void>;
  shouldAnimate: boolean;
}

export default function SignInScreen({ onOAuthSignIn, shouldAnimate }: Props) {
  const [emailMode, setEmailMode] = useState(false);
  /** `waiting` = magic link + optional OTP (Supabase often sends link-only emails). */
  const [emailStep, setEmailStep] = useState<'email' | 'waiting' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const btn1 = useRef(new Animated.Value(0)).current;
  const btn2 = useRef(new Animated.Value(0)).current;
  const btn3 = useRef(new Animated.Value(0)).current;
  const btn4 = useRef(new Animated.Value(0)).current;
  const termsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  useEffect(() => {
    if (!shouldAnimate) return;

    const make = (v: Animated.Value) =>
      Animated.timing(v, { toValue: 1, duration: 480, useNativeDriver: true });

    // Header first, then buttons staggered every 90 ms, terms last
    Animated.sequence([
      make(headerAnim),
      Animated.stagger(90, [make(btn1), make(btn2), make(btn3), make(btn4)]),
      make(termsAnim),
    ]).start();
  }, [shouldAnimate]);

  const headerSlide = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(18), 0],
  });

  // ── Provider icons — raw icons only; AuthButton wraps them in the white box
  const icons = {
    google:   <AntDesign   name="google"     size={s(15)} color="#4285F4" />,
    apple:    <AntDesign   name="apple"     size={s(15)} color="#111111" />,
    facebook: <FontAwesome5 name="facebook-f" size={s(14)} color="#1877F2" />,
    email:    <Feather     name="mail"       size={s(14)} color="#2D2D2D" />,
  };

  const resetEmailFlow = useCallback(() => {
    setEmailMode(false);
    setEmailStep('email');
    setOtp('');
    setError(null);
    setBusy(false);
    setResendSeconds(0);
  }, []);

  const handleSendCode = useCallback(async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_* to .env');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailOtp(email);
      setEmailStep('waiting');
      setResendSeconds(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send email.');
    } finally {
      setBusy(false);
    }
  }, [email]);

  const handleVerifyOtp = useCallback(async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured.');
      return;
    }
    const code = otp.replace(/\s/g, '');
    if (code.length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    try {
      await verifyEmailOtp(email, code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code. Try again.');
    } finally {
      setBusy(false);
    }
  }, [email, otp]);

  useEffect(() => {
    if (emailStep !== 'waiting' || !isSupabaseConfigured) return;

    const tickSession = async () => {
      try {
        const session = await getCurrentSession();
        if (session?.user) {
          /* Root App onAuthStateChange also routes; this helps same-screen edge cases. */
        }
      } catch {
        /* ignore */
      }
    };

    const id = setInterval(tickSession, 2000);
    tickSession();

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') tickSession();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [emailStep]);

  const emailHeaderTitle =
    emailStep === 'email'
      ? 'Continue with email'
      : emailStep === 'waiting'
        ? 'Check your email'
        : 'Enter code';
  const emailHeaderSub =
    emailStep === 'email'
      ? 'We’ll email you a secure link. If your project sends a one-time code, you can enter it in the next step.'
      : emailStep === 'waiting'
        ? `We sent a message to ${email.trim() || 'your inbox'}. Tap the sign-in link in that email (magic link). Keep this screen open — we detect login automatically when you return.`
        : `If your email included a one-time code, enter it below.`;

  if (emailMode) {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="light" />
        <View style={styles.ellipse1} />
        <View style={styles.ellipse5} />

        <ScrollView
          contentContainerStyle={styles.emailScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={resetEmailFlow}
            hitSlop={s(12)}
            style={styles.emailBackRow}
          >
            <Feather name="arrow-left" size={s(22)} color="#FFFFFF" />
            <Text style={styles.emailBackText}>Back</Text>
          </Pressable>

          <Text style={styles.loginTitle}>{emailHeaderTitle}</Text>
          <Text style={styles.emailSub}>{emailHeaderSub}</Text>

          {emailStep === 'email' && (
            <>
              <TextInput
                style={styles.emailInput}
                placeholder="you@email.com"
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />
              <Pressable
                onPress={() => void handleSendCode()}
                disabled={busy}
                style={[styles.emailPrimaryBtn, busy && styles.emailPrimaryBtnDisabled]}
              >
                {busy ? (
                  <ActivityIndicator color="#012F13" />
                ) : (
                  <Text style={styles.emailPrimaryBtnText}>Send sign-in link</Text>
                )}
              </Pressable>
            </>
          )}

          {emailStep === 'waiting' && (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginBottom: s(16), alignSelf: 'center' }} />
              <Text style={styles.emailWaitingBody}>
                Waiting for you to tap the link in your email. After you confirm, switch back to this app.
              </Text>
              <Pressable
                onPress={() => setEmailStep('otp')}
                style={styles.secondaryLink}
              >
                <Text style={styles.secondaryLinkText}>I have a one-time code instead</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSendCode()}
                disabled={busy || resendSeconds > 0}
                style={styles.resendBtn}
              >
                <Text style={styles.resendText}>
                  {resendSeconds > 0 ? `Resend email in ${resendSeconds}s` : 'Resend email'}
                </Text>
              </Pressable>
            </>
          )}

          {emailStep === 'otp' && (
            <>
              <TextInput
                style={styles.emailInput}
                placeholder="One-time code"
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardType="number-pad"
                maxLength={8}
                value={otp}
                onChangeText={setOtp}
                editable={!busy}
              />
              <Pressable
                onPress={() => void handleVerifyOtp()}
                disabled={busy}
                style={[styles.emailPrimaryBtn, busy && styles.emailPrimaryBtnDisabled]}
              >
                {busy ? (
                  <ActivityIndicator color="#012F13" />
                ) : (
                  <Text style={styles.emailPrimaryBtnText}>Verify & continue</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => void handleSendCode()}
                disabled={busy || resendSeconds > 0}
                style={styles.resendBtn}
              >
                <Text style={styles.resendText}>
                  {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend email'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setEmailStep('waiting')} style={styles.secondaryLink}>
                <Text style={styles.secondaryLinkText}>Back to magic link instructions</Text>
              </Pressable>
            </>
          )}

          {error ? <Text style={styles.emailError}>{error}</Text> : null}

          <Text style={styles.emailHint}>
            OAuth and magic links use the same secure redirect (aware://auth/callback). If the link opens in a browser, return to the app after it confirms.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Background: identical to SplashScreen for seamless transition ── */}
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      {/* ── Watermark (Figma: Frame 10 at 14% opacity) ───────────────────── */}
      <View style={styles.watermarkFrame} pointerEvents="none">
        {Array.from({ length: 5 }).map((_, i) => (
          <Text key={i} style={styles.watermarkText}>
            Aware
          </Text>
        ))}
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* App icon card — same as splash, visually anchors the brand */}
        <View style={styles.iconCard}>
          <Text style={styles.awText}>
            <Text style={{ color: '#FFFFFF' }}>A</Text>
            <Text style={{ color: '#8BC53D' }}>w</Text>
          </Text>
        </View>
        <Text style={styles.wordmark}>Aware</Text>

        {/* Spacer between brand mark and login copy */}
        <View style={{ height: s(32) }} />

        {/* Header — animated entrance */}
        <Animated.View
          style={{
            opacity: headerAnim,
            transform: [{ translateY: headerSlide }],
            width: s(342),
          }}
        >
          {/* Figma: Login 32px Inter Bold #FFFFFF lh 40px */}
          <Text style={styles.loginTitle}>Login</Text>
          {/* Figma: Subtitle 18px Inter Regular #F0F0F0 lh 26px */}
          <Text style={styles.loginSubtitle}>Welcome back to the app</Text>
        </Animated.View>

        <View style={{ height: s(24) }} />

        {/* Auth buttons — 342×48, staggered entrance */}
        <View style={{ width: s(342) }}>
          <AuthButton
            icon={icons.google}
            label="Continue with Google"
            onPress={() => {
              void onOAuthSignIn('google');
            }}
            anim={btn1}
          />
          <AuthButton
            icon={icons.apple}
            label="Continue with Apple"
            onPress={() => {
              void onOAuthSignIn('apple');
            }}
            anim={btn2}
          />
          <AuthButton
            icon={icons.facebook}
            label="Continue with Facebook"
            onPress={() => {
              void onOAuthSignIn('facebook');
            }}
            anim={btn3}
          />
          <AuthButton
            icon={icons.email}
            label="Continue with Email"
            onPress={() => setEmailMode(true)}
            anim={btn4}
          />
        </View>

        {/* Terms — required for App Store / Play Store */}
        <Animated.View style={{ opacity: termsAnim, marginTop: s(8) }}>
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E2F0CC',
    overflow: 'hidden',
  },

  // Background layers (match SplashScreen exactly)
  ellipse1: {
    position: 'absolute',
    width: s(583),
    height: s(770),
    borderRadius: s(400),
    backgroundColor: '#79FFA8',
    top: s(80),
    left: s(-50),
    ...Platform.select({
      ios: {
        shadowColor: '#79FFA8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: s(400),
      },
      android: { opacity: 0.7 },
      web: { filter: `blur(${s(400)}px)` } as any,
    }),
  },

  ellipse5: {
    position: 'absolute',
    width: s(1034),
    height: s(1055),
    borderRadius: s(530),
    backgroundColor: '#012F13',
    top: s(-450),
    left: s(-400),
    ...Platform.select({
      ios: {
        shadowColor: '#012F13',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: s(60),
      },
      android: { opacity: 0.85 },
      web: { filter: `blur(${s(60)}px)` } as any,
    }),
  },

  // Watermark: 5× "Aware" at 14% opacity, same as Figma Frame 10
  watermarkFrame: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.14,
    paddingHorizontal: s(10),
  },
  watermarkText: {
    fontFamily: FONT_BOLD,
    fontWeight: '500',
    fontSize: s(160),
    lineHeight: s(160),
    letterSpacing: s(160) * -0.035,
    textAlign: 'center',
    color: 'transparent',
    marginBottom: s(-92),
    includeFontPadding: false,
    ...Platform.select({
      web: { WebkitTextStroke: `${s(2)}px #FFFFFF` } as any,
      ios: {
        textShadowColor: '#FFFFFF',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 1.5,
      },
      android: {
        textShadowColor: '#FFFFFF',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 1.5,
      },
    }),
  },

  // Content container: pinned to bottom, centered horizontally — no bg so it
  // floats transparently over the gradient (no visible panel break)
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: s(48),
    paddingTop: s(32),
  },

  // App icon card — Figma: 78×78, #012F13, r=15
  iconCard: {
    width: s(78),
    height: s(78),
    borderRadius: s(15),
    backgroundColor: '#012F13',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(4) },
    shadowOpacity: 0.3,
    shadowRadius: s(10),
    elevation: 8,
  },
  awText: {
    fontFamily: FONT_BOLD,
    fontWeight: '500',
    fontSize: s(36),
    lineHeight: s(36),
    letterSpacing: s(36) * -0.035,
    textAlign: 'center',
  },

  wordmark: {
    fontFamily: FONT_BOLD,
    fontWeight: '500',
    fontSize: s(22),
    lineHeight: s(22),
    letterSpacing: s(22) * -0.035,
    color: '#E2F0CC',
    marginTop: s(10),
  },

  // Header — Figma: Login 32px Bold + Subtitle 18px Regular
  loginTitle: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(32),
    lineHeight: s(40),
    color: '#FFFFFF',
  },
  loginSubtitle: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(18),
    lineHeight: s(26),
    color: '#F0F0F0',
    marginTop: s(2),
  },

  // Button — Figma: 342×48, #F3FFE0, r=13, stroke rgba(255,255,255,0.52)
  button: {
    width: s(342),
    height: s(48),
    borderRadius: s(13),
    backgroundColor: '#F3FFE0',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.52)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(10),
    // Frosted depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.08,
    shadowRadius: s(6),
    elevation: 2,
  },

  // 24×24 white icon box (Figma: Google frame fill #FFFFFF)
  buttonIconBox: {
    width: s(24),
    height: s(24),
    borderRadius: s(4),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonLabel: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(16),
    lineHeight: s(24),
    color: '#000000',
    textAlign: 'center',
  },

  // Terms footer
  termsText: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(12),
    lineHeight: s(18),
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    paddingHorizontal: s(24),
  },
  termsLink: {
    color: 'rgba(255, 255, 255, 0.85)',
    textDecorationLine: 'underline',
  },

  emailScroll: {
    flexGrow: 1,
    paddingHorizontal: s(24),
    paddingTop: Platform.OS === 'ios' ? s(56) : s(40),
    paddingBottom: s(32),
  },
  emailBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(24),
    alignSelf: 'flex-start',
  },
  emailBackText: {
    fontFamily: FONT,
    fontSize: s(16),
    color: '#FFFFFF',
  },
  emailSub: {
    fontFamily: FONT,
    fontSize: s(15),
    lineHeight: s(22),
    color: 'rgba(255, 255, 255, 0.82)',
    marginBottom: s(20),
    width: s(342),
    alignSelf: 'center',
  },
  emailInput: {
    width: s(342),
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: s(13),
    paddingVertical: s(14),
    paddingHorizontal: s(16),
    fontFamily: FONT,
    fontSize: s(16),
    color: '#FFFFFF',
    marginBottom: s(14),
  },
  emailPrimaryBtn: {
    width: s(342),
    alignSelf: 'center',
    height: s(48),
    borderRadius: s(13),
    backgroundColor: '#F3FFE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(12),
  },
  emailPrimaryBtnDisabled: {
    opacity: 0.65,
  },
  emailPrimaryBtnText: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(16),
    color: '#012F13',
  },
  resendBtn: {
    alignSelf: 'center',
    paddingVertical: s(8),
  },
  resendText: {
    fontFamily: FONT,
    fontSize: s(14),
    color: 'rgba(255, 255, 255, 0.75)',
    textDecorationLine: 'underline',
  },
  emailError: {
    fontFamily: FONT,
    fontSize: s(13),
    color: '#FFB4B4',
    textAlign: 'center',
    marginTop: s(8),
    marginBottom: s(8),
    paddingHorizontal: s(12),
  },
  emailHint: {
    fontFamily: FONT,
    fontSize: s(12),
    lineHeight: s(18),
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: s(16),
    paddingHorizontal: s(8),
  },
  emailWaitingBody: {
    fontFamily: FONT,
    fontSize: s(15),
    lineHeight: s(22),
    color: 'rgba(255, 255, 255, 0.88)',
    marginBottom: s(16),
    width: s(342),
    alignSelf: 'center',
  },
  secondaryLink: {
    alignSelf: 'center',
    paddingVertical: s(10),
    marginBottom: s(4),
  },
  secondaryLinkText: {
    fontFamily: FONT,
    fontSize: s(14),
    color: 'rgba(255, 255, 255, 0.9)',
    textDecorationLine: 'underline',
  },
});
