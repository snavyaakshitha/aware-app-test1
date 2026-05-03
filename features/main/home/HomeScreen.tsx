/**
 * HomeScreen — v4 design.
 * Cream bg, greeting row, search bar, awarenews promo card,
 * recent scans horizontal list, browse category pills.
 * All navigation logic unchanged.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { Colors, Font, Radius, s, scoreColor } from '../../../shared/theme';
import { HomeStackParamList, Product } from '../../../shared/types';
import { PRODUCTS, getTopCleanProducts } from '../../../shared/mockData';

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

// ─── Mock recent scans ────────────────────────────────────────────────────────
const RECENT_SCANS = getTopCleanProducts(6);

// ─── Browse categories ─────────────────────────────────────────────────────────
const BROWSE_CATEGORIES = [
  { emoji: '🥤', label: 'Beverages' },
  { emoji: '🧃', label: 'Juices' },
  { emoji: '🥛', label: 'Dairy' },
  { emoji: '🍿', label: 'Snacks' },
  { emoji: '🥗', label: 'Salads' },
  { emoji: '🌾', label: 'Grains' },
  { emoji: '🥩', label: 'Protein' },
  { emoji: '🍫', label: 'Sweets' },
];

// ─── Verdict badge info from score ────────────────────────────────────────────
function badgeFromScore(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Clean', color: Colors.scoreClean, bg: Colors.scoreCleanBg };
  if (score >= 50) return { label: 'Caution', color: Colors.scoreCaution, bg: Colors.scoreCautionBg };
  return { label: 'Avoid', color: Colors.scoreAvoid, bg: Colors.scoreAvoidBg };
}

// ─── Recent scan card (128px wide, v4 style) ──────────────────────────────────
interface RecentCardProps {
  product: Product;
  onPress: () => void;
}

function RecentCard({ product, onPress }: RecentCardProps) {
  const badge = badgeFromScore(product.cleanScore);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentCard,
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
      ]}
    >
      {/* Badge top-right */}
      <View style={[styles.recentBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.recentBadgeText, { color: badge.color }]}>
          {badge.label}
        </Text>
      </View>

      {/* Emoji area */}
      <View style={styles.recentEmojiWrap}>
        <Text style={styles.recentEmoji}>{product.emoji}</Text>
      </View>

      {/* Info */}
      <Text style={styles.recentName} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.recentDate}>Today</Text>
    </Pressable>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllLink}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Awarenews promo card ─────────────────────────────────────────────────────
function AwarenewsPromoCard() {
  return (
    <View style={styles.promoCard}>
      {/* Badge */}
      <View style={styles.promoBadgeRow}>
        <View style={styles.promoBadge}>
          <View style={styles.promoBadgeDot} />
          <Text style={styles.promoBadgeText}>AWARENEWS</Text>
        </View>
      </View>
      <Text style={styles.promoTitle}>{'Ingredient alerts &\nhealth stories'}</Text>
      <Text style={styles.promoSub}>Latest food science news →</Text>
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNavProp>();
  const [searchQuery, setSearchQuery] = useState('');

  function handleSearchSubmit() {
    if (searchQuery.trim()) {
      navigation.navigate('SearchResults', { query: searchQuery.trim() });
    }
  }

  function navigateToProduct(productId: string) {
    navigation.navigate('ProductDetail', { productId });
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.canvas} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + s(8), paddingBottom: insets.bottom + s(100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── a. Greeting row ───────────────────────────────────────── */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.subGreeting}>Good morning,</Text>
            <Text style={styles.greeting}>Aisha 👋</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>🧕</Text>
          </View>
        </View>

        {/* ── b. Search bar ─────────────────────────────────────────── */}
        <View style={styles.searchBar}>
          <Feather name="search" size={s(18)} color={Colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products, brands..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          <Feather name="mic" size={s(18)} color={Colors.textTertiary} style={styles.micIcon} />
        </View>

        {/* ── c. Personalize card ───────────────────────────────────── */}
        <Pressable style={styles.personalizeCard}>
          <Text style={styles.personalizeIcon}>✦</Text>
          <View style={styles.personalizeText}>
            <Text style={styles.personalizeTitle}>Complete your profile</Text>
            <Text style={styles.personalizeSub}>Takes 2 min · Get personalized results</Text>
          </View>
          <Feather name="chevron-right" size={s(18)} color={Colors.accent} />
        </Pressable>

        {/* ── d. Awarenews promo card ───────────────────────────────── */}
        <AwarenewsPromoCard />

        {/* ── e. Recent scans ──────────────────────────────────────── */}
        <SectionHeader
          title="Recent scans"
          onSeeAll={() => navigation.navigate('SearchResults', { query: 'recent' })}
        />
        <FlatList
          data={RECENT_SCANS}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hListPad}
          style={styles.hList}
          renderItem={({ item }) => (
            <RecentCard product={item} onPress={() => navigateToProduct(item.id)} />
          )}
        />

        {/* ── f. Browse categories ──────────────────────────────────── */}
        <View style={styles.browseHeaderRow}>
          <SectionHeader
            title="Browse"
            onSeeAll={() => navigation.navigate('SearchResults', { query: 'all' })}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.browseRow}
        >
          {BROWSE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.label}
              style={({ pressed }) => [styles.browsePill, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate('SearchResults', { query: cat.label.toLowerCase() })}
            >
              <Text style={styles.browsePillEmoji}>{cat.emoji}</Text>
              <Text style={styles.browsePillLabel}>{cat.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: s(16),
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: s(16),
  },
  subGreeting: {
    fontSize: s(13),
    color: Colors.textSecondary,
    fontFamily: Font.regular,
    marginBottom: s(2),
  },
  greeting: {
    fontSize: s(22),
    fontWeight: '800',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
  },
  avatar: {
    width: s(42),
    height: s(42),
    borderRadius: Radius.pill,
    backgroundColor: '#E8D5C0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  avatarEmoji: {
    fontSize: s(22),
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: Radius.pill,
    height: s(48),
    borderWidth: 1,
    borderColor: '#E0E0DC',
    marginBottom: s(14),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  searchIcon: {
    marginHorizontal: s(14),
  },
  searchInput: {
    flex: 1,
    fontSize: s(14),
    color: Colors.textPrimary,
    fontFamily: Font.regular,
    paddingVertical: 0,
  },
  micIcon: {
    marginRight: s(14),
  },

  // Personalize card
  personalizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: 'rgba(27,94,82,0.12)',
    borderRadius: Radius.lg,
    paddingVertical: s(14),
    paddingHorizontal: s(16),
    marginBottom: s(14),
    gap: s(10),
  },
  personalizeIcon: {
    fontSize: s(16),
    color: Colors.accent,
  },
  personalizeText: {
    flex: 1,
  },
  personalizeTitle: {
    fontSize: s(14),
    fontWeight: '700',
    color: Colors.accent,
    fontFamily: Font.bold,
  },
  personalizeSub: {
    fontSize: s(12),
    color: Colors.textSecondary,
    fontFamily: Font.regular,
    marginTop: s(1),
  },

  // Awarenews promo card
  promoCard: {
    borderRadius: Radius.xl,
    padding: s(16),
    marginBottom: s(16),
    backgroundColor: '#0f1f14',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  promoBadgeRow: {
    flexDirection: 'row',
    marginBottom: s(10),
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.pill,
    paddingHorizontal: s(9),
    paddingVertical: s(4),
  },
  promoBadgeDot: {
    width: s(6),
    height: s(6),
    borderRadius: Radius.pill,
    backgroundColor: '#188A55',
  },
  promoBadgeText: {
    fontSize: s(10),
    fontWeight: '700',
    color: 'white',
    fontFamily: Font.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontSize: s(15),
    fontWeight: '800',
    color: 'white',
    fontFamily: Font.bold,
    lineHeight: s(21),
    marginBottom: s(6),
  },
  promoSub: {
    fontSize: s(11),
    color: 'rgba(255,255,255,0.60)',
    fontFamily: Font.regular,
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(12),
  },
  sectionTitle: {
    fontSize: s(16),
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
  },
  seeAllLink: {
    fontSize: s(13),
    color: Colors.accent,
    fontFamily: Font.medium,
    fontWeight: '500',
  },

  // Recent scans horizontal list
  hList: {
    marginHorizontal: -s(16),
    marginBottom: s(24),
  },
  hListPad: {
    paddingHorizontal: s(16),
    gap: s(10),
  },

  // Recent scan card
  recentCard: {
    width: s(128),
    backgroundColor: 'white',
    borderRadius: Radius.xl,
    padding: s(10),
    paddingBottom: s(12),
    borderWidth: 1,
    borderColor: '#EBEBEB',
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  recentBadge: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    borderRadius: Radius.pill,
    paddingHorizontal: s(7),
    paddingVertical: s(3),
    zIndex: 1,
  },
  recentBadgeText: {
    fontSize: s(9),
    fontWeight: '700',
    fontFamily: Font.bold,
  },
  recentEmojiWrap: {
    height: s(68),
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEmoji: {
    fontSize: s(38),
  },
  recentName: {
    fontSize: s(12),
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
    lineHeight: s(16),
    marginTop: s(4),
  },
  recentDate: {
    fontSize: s(10),
    color: Colors.textTertiary,
    fontFamily: Font.regular,
    marginTop: s(3),
  },

  // Browse
  browseHeaderRow: {
    // sectionHeaderRow already handles spacing
  },
  browseRow: {
    gap: s(8),
    paddingBottom: s(4),
  },
  browsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: 'white',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    paddingHorizontal: s(14),
    paddingVertical: s(8),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  browsePillEmoji: { fontSize: s(14) },
  browsePillLabel: {
    fontSize: s(13),
    fontWeight: '500',
    color: Colors.textPrimary,
    fontFamily: Font.medium,
  },
});
