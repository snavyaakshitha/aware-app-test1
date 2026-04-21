/**
 * Aware Design System — Theme Tokens
 *
 * Green = Safe. The entire palette revolves around this principle.
 * Traffic-light scoring: green (clean) → amber (caution) → red (avoid)
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
  // Canvas / backgrounds
  canvas:        '#E2F0CC', // sage green — main bg, "safe" feel
  canvasDark:    '#012F13', // deep forest — dark panels, icon cards
  canvasMid:     '#0A3D1E', // slightly lighter dark for cards
  surface:       'rgba(2, 47, 19, 0.18)',  // frosted panel on canvas
  surfaceLight:  'rgba(2, 47, 19, 0.08)',
  surfaceStrong: 'rgba(2, 47, 19, 0.32)',

  // Accent
  accent:        '#8BC53D', // lime green — primary action color
  accentLight:   '#F3FFE0', // very light green — button fills
  accentDark:    '#5A8A1A', // dark lime for pressed states

  // Score traffic-light system
  scoreClean:    '#22C55E', // 80-100 → clean/safe
  scoreCaution:  '#F59E0B', // 50-79 → moderate/check
  scoreAvoid:    '#EF4444', // 0-49 → avoid

  // Score background tints
  scoreCleanBg:  'rgba(34, 197, 94, 0.15)',
  scoreCautionBg:'rgba(245, 158, 11, 0.15)',
  scoreAvoidBg:  'rgba(239, 68, 68, 0.15)',

  // Text
  textWhite:     '#FFFFFF',
  textOffWhite:  '#F0F0F0',
  textMuted:     'rgba(255, 255, 255, 0.60)',
  textFaint:     'rgba(255, 255, 255, 0.35)',
  textDark:      '#012F13',
  textMidDark:   '#1A3D1E',
  textOnLight:   '#1A2E0D',

  // UI chrome
  border:        'rgba(255, 255, 255, 0.15)',
  borderStrong:  'rgba(255, 255, 255, 0.30)',
  divider:       'rgba(255, 255, 255, 0.08)',

  // Brand colors for OAuth
  google:        '#4285F4',
  apple:         '#111111',
  facebook:      '#1877F2',

  // Semantic
  danger:        '#EF4444',
  warning:       '#F59E0B',
  success:       '#22C55E',
  info:          '#38BDF8',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const Font = {
  regular: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: 'System',
  })!,
  medium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: 'System',
  })!,
  bold: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
    android: { elevation: 3 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 },
    android: { elevation: 6 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20 },
    android: { elevation: 10 },
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
