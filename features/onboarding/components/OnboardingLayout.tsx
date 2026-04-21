import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';

interface Props {
  title: string;
  subtitle?: string;
  progress: number; // 0–1
  onBack?: () => void;
  onPrimary: () => void;
  primaryLabel?: string;
  onSkip?: () => void;
  skipLabel?: string;
  error?: string;
  children: React.ReactNode;
}

export default function OnboardingLayout({
  title,
  subtitle,
  progress,
  onBack,
  onPrimary,
  primaryLabel = 'Continue',
  onSkip,
  skipLabel = 'Skip for now',
  error,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top || (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 20) }]}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {/* Header row */}
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.logoText}>aware</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {children}
        <View style={{ height: s(120) }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Space.base }]}>
        {onSkip ? (
          <Pressable onPress={onSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>{skipLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onPrimary} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvasDark,
  },
  progressTrack: {
    height: s(3),
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginHorizontal: 0,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: s(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.base,
    paddingVertical: Space.md,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: s(36),
    height: s(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: s(22),
    color: Colors.textOffWhite,
  },
  logoText: {
    fontFamily: Font.bold,
    fontSize: s(18),
    color: Colors.accent,
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Space.base,
    paddingTop: Space.lg,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: s(26),
    color: Colors.textWhite,
    marginBottom: Space.sm,
    lineHeight: s(32),
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
    marginBottom: Space.lg,
    lineHeight: s(21),
  },
  errorText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.danger,
    marginBottom: Space.md,
    backgroundColor: 'rgba(239,68,68,0.10)',
    padding: Space.sm,
    borderRadius: Radius.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.base,
    paddingTop: Space.base,
    backgroundColor: Colors.canvasDark,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Space.sm,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Space.sm,
  },
  skipText: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: Space.base,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: Font.bold,
    fontSize: s(16),
    color: Colors.canvasDark,
    letterSpacing: 0.3,
  },
});
