/**
 * Aware — Sign In Screen
 *
 * OAuth + email OTP / magic link (Supabase). Email flow uses `signInWithOtp` +
 * `verifyOtp`; magic links complete via deep link in `App.tsx`.
 *
 * v4 design: light cream #FAFAF7 bg, teal #1B5E52 hero top, white outline buttons.
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
  Alert,
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
  /** primary = dark fill (Apple); secondary = white outline (default) */
  variant?: 'primary' | 'secondary';
}

function AuthButton({ icon, label, onPress, anim, variant = 'secondary' }: AuthButtonProps) {
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

  const isPrimary = variant === 'primary';

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY }, { scale: pressScale }],
        marginBottom: s(10),
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: isPrimary ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', radius: s(171) }}
        style={[styles.button, isPrimary && styles.buttonPrimary]}
      >
        <View style={[styles.buttonIconBox, isPrimary && styles.buttonIconBoxPrimary]}>
          {icon}
        </View>
        <Text style={[styles.buttonLabel, isPrimary && styles.buttonLabelPrimary]}>
          {label}
        </Text>
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

  const icons = {
    google:   <AntDesign   name="google"     size={s(15)} color="#4285F4" />,
    apple:    <AntDesign   name="apple"      size={s(15)} color="#FFFFFF" />,
    facebook: <FontAwesome5 name="facebook-f" size={s(14)} color="#1877F2" />,
    email:    <Feather     name="mail"       size={s(14)} color="#101418" />,
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
      ? "We'll email you a secure link. If your project sends a one-time code, you can enter it in the next step."
      : emailStep === 'waiting'
        ? `We sent a message to ${email.trim() || 'your inbox'}. Tap the sign-in link in that email (magic link). Keep this screen open — we detect login automatically when you return.`
        : `If your email included a one-time code, enter it below.`;

  if (emailMode) {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="dark" />

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
            <Feather name="arrow-left" size={s(22)} color="#1B5E52" />
            <Text style={styles.emailBackText}>Back</Text>
          </Pressable>

          <Text style={styles.emailTitle}>{emailHeaderTitle}</Text>
          <Text style={styles.emailSub}>{emailHeaderSub}</Text>

          {emailStep === 'email' && (
            <>
              <TextInput
                style={styles.emailInput}
                placeholder="you@email.com"
                placeholderTextColor="#8C9299"
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
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.emailPrimaryBtnText}>Send sign-in link</Text>
                )}
              </Pressable>
            </>
          )}

          {emailStep === 'waiting' && (
            <>
              <ActivityIndicator size="small" color="#1B5E52" style={{ marginBottom: s(16), alignSelf: 'center' }} />
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
                placeholderTextColor="#8C9299"
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
                  <ActivityIndicator color="#FFFFFF" />
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

      {/* ── Teal hero panel — top section ── */}
      <View style={styles.heroPanel}>
        {/* Decorative corner circle */}
        <View style={styles.heroDecorCircle} />

        {/* App icon centered in hero */}
        <View style={styles.heroContent}>
          <View style={styles.iconCard}>
            <Text style={styles.awText}>
              <Text style={{ color: '#FFFFFF' }}>A</Text>
              <Text style={{ color: '#7ECFC0' }}>w</Text>
            </Text>
          </View>
          <Text style={styles.wordmark}>Aware</Text>
          <Text style={styles.heroTagline}>Know what's in your products.</Text>
        </View>
      </View>

      {/* ── Bottom content panel ── */}
      <View style={styles.content}>

        {/* Brand badge */}
        <View style={styles.brandRow}>
          <Feather name="sun" size={s(11)} color="#1B5E52" />
          <Text style={styles.brandLabel}>AWARE</Text>
        </View>

        {/* Header */}
        <Animated.View
          style={{
            opacity: headerAnim,
            transform: [{ translateY: headerSlide }],
            width: s(342),
          }}
        >
          <Text style={styles.loginTitle}>Login</Text>
          <Text style={styles.loginSubtitle}>Welcome back to the app</Text>
        </Animated.View>

        <View style={{ height: s(20) }} />

        {/* Auth buttons */}
        <View style={{ width: s(342) }}>
          <AuthButton
            icon={icons.apple}
            label="Continue with Apple"
            onPress={() =>
              Alert.alert('Coming Soon', 'Apple Sign In will be available in the next update.')
            }
            anim={btn2}
            variant="primary"
          />
          <AuthButton
            icon={icons.google}
            label="Continue with Google"
            onPress={() => void onOAuthSignIn('google')}
            anim={btn1}
          />
          <AuthButton
            icon={icons.facebook}
            label="Continue with Facebook"
            onPress={() => void onOAuthSignIn('facebook')}
            anim={btn3}
          />
          {/* Divider */}
          <Animated.View style={{ opacity: btn3, flexDirection: 'row', alignItems: 'center', marginVertical: s(4) }}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </Animated.View>
          <AuthButton
            icon={icons.email}
            label="Continue with email"
            onPress={() => setEmailMode(true)}
            anim={btn4}
          />
        </View>

        {/* Terms */}
        <Animated.View style={{ opacity: termsAnim, marginTop: s(4) }}>
          <Text style={styles.termsText}>
            Your data is private and never sold.{'\n'}By continuing, you agree to our{' '}
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
    backgroundColor: '#FAFAF7',
    overflow: 'hidden',
  },

  // ── Hero panel (top ~46%) ──────────────────────────────────────────────────
  heroPanel: {
    flex: 0.46,
    backgroundColor: '#1B5E52',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: s(32),
    overflow: 'hidden',
  },
  heroDecorCircle: {
    position: 'absolute',
    width: s(320),
    height: s(320),
    borderRadius: s(160),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    top: s(-100),
    right: s(-80),
  },
  heroContent: {
    alignItems: 'center',
  },

  // App icon card — 78×78, dark teal bg
  iconCard: {
    width: s(78),
    height: s(78),
    borderRadius: s(18),
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(12),
  },
  awText: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(36),
    lineHeight: s(40),
    letterSpacing: s(36) * -0.035,
    textAlign: 'center',
  },
  wordmark: {
    fontFamily: FONT_BOLD,
    fontWeight: '600',
    fontSize: s(20),
    lineHeight: s(24),
    letterSpacing: s(20) * -0.02,
    color: 'rgba(255, 255, 255, 0.92)',
    marginBottom: s(6),
  },
  heroTagline: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(13),
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
  },

  // ── Bottom content panel ───────────────────────────────────────────────────
  content: {
    flex: 0.54,
    alignItems: 'center',
    paddingTop: s(20),
    paddingBottom: s(24),
    paddingHorizontal: s(24),
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    marginBottom: s(8),
  },
  brandLabel: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(11),
    letterSpacing: s(11) * 0.1,
    color: '#1B5E52',
    textTransform: 'uppercase',
  },

  loginTitle: {
    fontFamily: FONT_BOLD,
    fontWeight: '800',
    fontSize: s(26),
    lineHeight: s(32),
    color: '#101418',
  },
  loginSubtitle: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(14),
    lineHeight: s(20),
    color: '#6F747C',
    marginTop: s(2),
  },

  // ── Auth buttons ───────────────────────────────────────────────────────────
  button: {
    width: s(342),
    height: s(48),
    borderRadius: s(100),
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0DC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(10),
  },
  buttonPrimary: {
    backgroundColor: '#101418',
    borderColor: '#101418',
  },
  buttonIconBox: {
    width: s(24),
    height: s(24),
    borderRadius: s(4),
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIconBoxPrimary: {
    backgroundColor: 'transparent',
  },
  buttonLabel: {
    fontFamily: FONT,
    fontWeight: '500',
    fontSize: s(15),
    lineHeight: s(22),
    color: '#101418',
  },
  buttonLabelPrimary: {
    color: '#FFFFFF',
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0DC',
  },
  dividerLabel: {
    fontFamily: FONT,
    fontSize: s(12),
    color: '#8C9299',
    marginHorizontal: s(10),
  },

  // ── Terms ──────────────────────────────────────────────────────────────────
  termsText: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(11),
    lineHeight: s(17),
    color: '#8C9299',
    textAlign: 'center',
    paddingHorizontal: s(12),
  },
  termsLink: {
    color: '#1B5E52',
    textDecorationLine: 'underline',
  },

  // ── Email flow ─────────────────────────────────────────────────────────────
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
    color: '#1B5E52',
  },
  emailTitle: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(24),
    lineHeight: s(30),
    color: '#101418',
    marginBottom: s(6),
  },
  emailSub: {
    fontFamily: FONT,
    fontSize: s(14),
    lineHeight: s(21),
    color: '#6F747C',
    marginBottom: s(20),
  },
  emailInput: {
    width: s(342),
    alignSelf: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0DC',
    borderRadius: s(13),
    paddingVertical: s(14),
    paddingHorizontal: s(16),
    fontFamily: FONT,
    fontSize: s(16),
    color: '#101418',
    marginBottom: s(14),
  },
  emailPrimaryBtn: {
    width: s(342),
    alignSelf: 'center',
    height: s(48),
    borderRadius: s(13),
    backgroundColor: '#1B5E52',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(12),
  },
  emailPrimaryBtnDisabled: {
    opacity: 0.55,
  },
  emailPrimaryBtnText: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(16),
    color: '#FFFFFF',
  },
  resendBtn: {
    alignSelf: 'center',
    paddingVertical: s(8),
  },
  resendText: {
    fontFamily: FONT,
    fontSize: s(14),
    color: '#6F747C',
    textDecorationLine: 'underline',
  },
  emailError: {
    fontFamily: FONT,
    fontSize: s(13),
    color: '#E53946',
    textAlign: 'center',
    marginTop: s(8),
    marginBottom: s(8),
    paddingHorizontal: s(12),
  },
  emailHint: {
    fontFamily: FONT,
    fontSize: s(12),
    lineHeight: s(18),
    color: '#8C9299',
    textAlign: 'center',
    marginTop: s(16),
    paddingHorizontal: s(8),
  },
  emailWaitingBody: {
    fontFamily: FONT,
    fontSize: s(14),
    lineHeight: s(21),
    color: '#6F747C',
    marginBottom: s(16),
  },
  secondaryLink: {
    alignSelf: 'center',
    paddingVertical: s(10),
    marginBottom: s(4),
  },
  secondaryLinkText: {
    fontFamily: FONT,
    fontSize: s(14),
    color: '#1B5E52',
    textDecorationLine: 'underline',
  },
});
