/**
 * Aware — Awarenews Screen
 * Instagram Reels / Stories-style full-screen dark cards.
 * Tap left 40% → previous. Tap right 40% → next.
 * Swipe up → next, swipe down → previous.
 * v4 design: full-screen dark gradient bg, large emoji, tag pill, title, stats.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Font, s } from '../../../shared/theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Data ─────────────────────────────────────────────────────────────────────

interface StatItem { value: string; label: string }
interface NewsItem {
  id: string; emoji: string;
  tag: string; tagColor: string; tagBg: string;
  title: string; subtitle: string; time: string;
  bgDark: string; bgAccent: string;
  stats: StatItem[];
}

const NEWS_ITEMS: NewsItem[] = [
  {
    id: '1', emoji: '🧪',
    tag: 'INGREDIENT ALERT', tagColor: '#E53946', tagBg: 'rgba(229,57,70,0.18)',
    title: 'Palm Oil Is In 50%\nOf Packaged Foods',
    subtitle: "Here's why you should care about it",
    time: '2h ago', bgDark: '#1a2e1a', bgAccent: '#1B5E52',
    stats: [
      { value: '50%', label: 'of packaged\nfoods' },
      { value: 'High', label: 'saturated\nfat' },
      { value: '⚠️',  label: 'Linked to\nheart disease' },
    ],
  },
  {
    id: '2', emoji: '🥤',
    tag: 'STUDY FINDINGS', tagColor: '#C98200', tagBg: 'rgba(201,130,0,0.18)',
    title: 'Ultra-Processed\nDrinks Raise\nDiabetes Risk by 30%',
    subtitle: 'New research from Harvard Medical School',
    time: '5h ago', bgDark: '#2a1f0a', bgAccent: '#92400E',
    stats: [
      { value: '30%',   label: 'higher\nrisk' },
      { value: '2L/day', label: 'average\nconsumption' },
      { value: '12yr',  label: 'study\nduration' },
    ],
  },
  {
    id: '3', emoji: '🌿',
    tag: 'CLEAN SWAP', tagColor: '#188A55', tagBg: 'rgba(24,138,85,0.18)',
    title: '5 Cleaner Alternatives\nTo Everyday\nSkincare Products',
    subtitle: 'Dermatologist-approved swaps for your routine',
    time: '1d ago', bgDark: '#0a1f14', bgAccent: '#1B5E52',
    stats: [
      { value: '5',  label: 'clean\nswaps' },
      { value: '0',  label: 'harmful\nadditives' },
      { value: '✓',  label: 'Derm\napproved' },
    ],
  },
  {
    id: '4', emoji: '🔬',
    tag: 'SCIENCE', tagColor: '#6366F1', tagBg: 'rgba(99,102,241,0.18)',
    title: 'What Does\n"Natural Flavor"\nActually Mean?',
    subtitle: 'The FDA definition might surprise you',
    time: '2d ago', bgDark: '#0f0a2a', bgAccent: '#1E40AF',
    stats: [
      { value: '3000+', label: 'chemicals\nallowed' },
      { value: '?',     label: 'FDA\nloophole' },
      { value: '🔍',   label: 'Read the\nfine print' },
    ],
  },
  {
    id: '5', emoji: '🚨',
    tag: 'INGREDIENT ALERT', tagColor: '#E53946', tagBg: 'rgba(229,57,70,0.18)',
    title: 'Red Dye No. 3\nBanned by FDA',
    subtitle: 'Decades of cancer concerns finally acted upon',
    time: '3d ago', bgDark: '#2a0a0a', bgAccent: '#991B1B',
    stats: [
      { value: 'Red 3', label: 'erythrosine' },
      { value: '1990',  label: 'year concerns\nraised' },
      { value: '2025',  label: 'year\nbanned' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AwarenewsScreen() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);

  const goNext = useCallback(() => {
    const next = Math.min(currentRef.current + 1, NEWS_ITEMS.length - 1);
    currentRef.current = next;
    setCurrent(next);
  }, []);

  const goPrev = useCallback(() => {
    const prev = Math.max(currentRef.current - 1, 0);
    currentRef.current = prev;
    setCurrent(prev);
  }, []);

  // Capture handlers in refs so panResponder always sees latest
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  goNextRef.current = goNext;
  goPrevRef.current = goPrev;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dy) > 12 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderRelease: (_e, gs) => {
        if (gs.dy < -50) goNextRef.current();
        else if (gs.dy > 50) goPrevRef.current();
      },
    })
  ).current;

  const item = NEWS_ITEMS[current];
  const topPad = insets.top + s(8);

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Background ───────────────────────────────────────────── */}
      <View style={[styles.bgBase, { backgroundColor: item.bgDark }]} />
      {/* Top-right accent circle to break flat bg */}
      <View style={[styles.bgCircle, { backgroundColor: item.bgAccent }]} />
      {/* Heavy bottom fade so text stays readable */}
      <View style={styles.bgFade} />

      {/* ── Absolutely-positioned top bar ────────────────────────── */}
      <View style={[styles.topContainer, { paddingTop: topPad }]}>
        {/* Title + search row */}
        <View style={styles.topRow}>
          <View style={styles.topTitleGroup}>
            <View style={styles.topDot} />
            <Text style={styles.topTitle}>Awarenews</Text>
          </View>
          <Feather name="search" size={s(22)} color="white" />
        </View>

        {/* Progress bars */}
        <View style={styles.progressRow}>
          {NEWS_ITEMS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                { opacity: i < current ? 0.9 : i === current ? 1 : 0.35 },
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── Big emoji (center of screen, upper half) ─────────────── */}
      <View style={[styles.emojiContainer, { top: topPad + s(80) }]}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>

      {/* ── Invisible tap zones ───────────────────────────────────── */}
      <Pressable style={styles.tapLeft}  onPress={goPrev} />
      <Pressable style={styles.tapRight} onPress={goNext} />

      {/* ── Bottom content ────────────────────────────────────────── */}
      <View style={[styles.bottomContent, { paddingBottom: insets.bottom + s(96) }]}>

        {/* Tag pill */}
        <View style={[styles.tagPill, { backgroundColor: item.tagBg, borderColor: `${item.tagColor}55` }]}>
          <View style={[styles.tagDot, { backgroundColor: item.tagColor }]} />
          <Text style={[styles.tagText, { color: item.tagColor }]}>{item.tag}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{item.subtitle}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {item.stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Footer: time + "Read full story" */}
        <View style={styles.footerRow}>
          <Text style={styles.timeText}>{item.time}</Text>
          <Pressable style={styles.readMoreBtn}>
            <Text style={styles.readMoreText}>Read full story</Text>
            <Feather name="arrow-right" size={s(13)} color="#101418" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Background layers
  bgBase: {
    ...StyleSheet.absoluteFillObject,
  },
  bgCircle: {
    position: 'absolute',
    top: -s(60),
    right: -s(40),
    width: s(280),
    height: s(280),
    borderRadius: s(140),
    opacity: 0.4,
  },
  bgFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.65,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },

  // Top bar (absolute)
  topContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: s(20),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: s(6),
  },
  topTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  topDot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: 'white',
    opacity: 0.9,
  },
  topTitle: {
    fontFamily: Font.bold,
    fontSize: s(15),
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.3,
  },
  progressRow: {
    flexDirection: 'row',
    gap: s(3),
    paddingBottom: s(8),
  },
  progressBar: {
    flex: 1,
    height: s(2.5),
    borderRadius: s(2),
    backgroundColor: 'white',
  },

  // Emoji
  emojiContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  emoji: {
    fontSize: s(88),
    lineHeight: Platform.OS === 'ios' ? s(96) : s(100),
  },

  // Tap zones
  tapLeft: {
    position: 'absolute',
    top: s(90),
    left: 0,
    width: '40%',
    bottom: s(200),
    zIndex: 5,
  },
  tapRight: {
    position: 'absolute',
    top: s(90),
    right: 0,
    width: '40%',
    bottom: s(200),
    zIndex: 5,
  },

  // Bottom content
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: s(20),
    zIndex: 6,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    alignSelf: 'flex-start',
    borderRadius: s(100),
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    marginBottom: s(14),
    borderWidth: 1,
  },
  tagDot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
  },
  tagText: {
    fontFamily: Font.bold,
    fontSize: s(11),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: s(28),
    fontWeight: '800',
    color: 'white',
    lineHeight: s(34),
    marginBottom: s(8),
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: 'rgba(255,255,255,0.70)',
    marginBottom: s(20),
    lineHeight: s(18),
  },
  statsRow: {
    flexDirection: 'row',
    gap: s(10),
    marginBottom: s(16),
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: s(14),
    paddingVertical: s(10),
    paddingHorizontal: s(8),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statValue: {
    fontFamily: Font.bold,
    fontSize: s(16),
    fontWeight: '800',
    color: 'white',
    lineHeight: s(20),
    marginBottom: s(3),
    textAlign: 'center',
  },
  statLabel: {
    fontFamily: Font.regular,
    fontSize: s(10),
    color: 'rgba(255,255,255,0.60)',
    textAlign: 'center',
    lineHeight: s(13),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: 'rgba(255,255,255,0.50)',
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: 'white',
    borderRadius: s(100),
    paddingHorizontal: s(16),
    paddingVertical: s(8),
  },
  readMoreText: {
    fontFamily: Font.bold,
    fontSize: s(13),
    fontWeight: '700',
    color: '#101418',
  },
});
