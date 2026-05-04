/**
 * Aware Design System — Theme Tokens
 * Aligned to aware-app-v4.html design handoff.
 *
 * Primary palette: warm cream (#FAFAF7) bg + deep teal (#1B5E52) accent.
 * Traffic-light scoring: green (clean) → amber (caution) → red (avoid).
 */
import { Platform } from 'react-native';

import { getWindowDimensions } from './dimensions';

const { width: SCREEN_W, height: SCREEN_H } = getWindowDimensions();

// ─── Scale (Figma base: 393×852) ─────────────────────────────────────────────
export const FIGMA_W = 393;
export const FIGMA_H = 852;
export const scale = Math.min(SCREEN_W / FIGMA_W, SCREEN_H / FIGMA_H);
export function s(px: number): number {
  return Math.round(px * scale);
}

// ─── Color Palette ────────────────────────────────────────────────────────────
export const Colors = {
  // Canvas / backgrounds (v4: warm cream palette)
  canvas:        '#FAFAF7', // warm cream — main bg
  canvas2:       '#F4F4F0', // secondary cream — row dividers, icon bg
  canvasDark:    '#012F13', // deep forest — scan camera overlay, awarenews promo
  canvasMid:     '#0A3D1E', // slightly lighter dark (secondary dark panels)
  surface:       'rgba(2, 47, 19, 0.18)',
  surfaceLight:  'rgba(2, 47, 19, 0.08)',
  surfaceStrong: 'rgba(2, 47, 19, 0.32)',

  // Brand teal (v4 primary action color — replaces lime green)
  teal:          '#1B5E52', // primary brand teal
  tealLight:     '#E8F2F0', // teal selection / light bg
  tealMid:       '#2D7A6B', // mid teal for gradients

  // Accent aliases (pointing to teal)
  accent:        '#1B5E52', // primary action
  accentLight:   '#E8F2F0', // light accent bg
  accentDark:    '#0F3D2E', // dark teal for pressed/text

  // Score traffic-light system (v4 values)
  scoreClean:    '#188A55', // 80-100 → clean/safe
  scoreCaution:  '#C98200', // 50-79  → moderate/check
  scoreAvoid:    '#E53946', // 0-49   → avoid

  // Score background tints (v4 badge bg colors)
  scoreCleanBg:  '#EAF7EF', // green badge bg
  scoreCautionBg:'#FFF4D9', // amber badge bg
  scoreAvoidBg:  '#FFEDEE', // red badge bg

  // Text (v4 type system)
  textPrimary:   '#101418', // main text (near-black)
  textSecondary: '#6F747C', // secondary / muted text
  textTertiary:  '#8C9299', // placeholder / faint text
  textWhite:     '#FFFFFF',
  textOffWhite:  '#F0F0F0',
  textMuted:     'rgba(255, 255, 255, 0.60)', // on-dark text
  textFaint:     'rgba(255, 255, 255, 0.35)', // on-dark faint text
  textDark:      '#101418', // alias for textPrimary
  textMidDark:   '#6F747C', // alias for textSecondary
  textOnLight:   '#101418', // text on light backgrounds

  // UI chrome (v4 card/border system — light mode)
  border:        'rgba(0, 0, 0, 0.06)',  // card border
  borderStrong:  'rgba(0, 0, 0, 0.12)',
  divider:       '#F4F4F0',              // row divider
  cardBorder:    'rgba(0, 0, 0, 0.06)',

  // Dark-panel borders (for scan camera, awarenews promo)
  borderDark:       'rgba(255, 255, 255, 0.15)',
  borderDarkStrong: 'rgba(255, 255, 255, 0.30)',
  dividerDark:      'rgba(255, 255, 255, 0.08)',

  // Brand colors for OAuth
  google:        '#4285F4',
  apple:         '#111111',
  facebook:      '#1877F2',

  // Semantic
  danger:        '#E53946', // avoid/error
  warning:       '#C98200', // caution/amber
  success:       '#188A55', // clean/safe
  info:          '#38BDF8',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const Font = {
  regular: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: 'Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: 'System',
  })!,
  medium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    web: 'Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: 'System',
  })!,
  bold: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    web: 'Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: 'System',
  })!,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const Space = {
  xs:   s(4),
  sm:   s(8),
  md:   s(12),
  base: s(16),
  lg:   s(20),
  xl:   s(24),
  xxl:  s(32),
  xxxl: s(48),
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  xs:   s(6),
  sm:   s(10),
  md:   s(13),
  lg:   s(16),
  xl:   s(20),
  xxl:  s(24),
  pill: s(999),
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const Shadow = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 20 },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

// ─── Score helpers ────────────────────────────────────────────────────────────
export function scoreColor(score: number): string {
  if (score >= 80) return Colors.scoreClean;
  if (score >= 50) return Colors.scoreCaution;
  return Colors.scoreAvoid;
}

export function scoreBgColor(score: number): string {
  if (score >= 80) return Colors.scoreCleanBg;
  if (score >= 50) return Colors.scoreCautionBg;
  return Colors.scoreAvoidBg;
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Clean';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Avoid';
}
