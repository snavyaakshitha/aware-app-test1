/**
 * StoreScreen — Individual store page.
 * Shows store-specific clean picks + category browsing.
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, Space, Radius, s, scoreColor } from '../../../shared/theme';
import { HomeStackParamList, Product } from '../../../shared/types';
import { STORES, PRODUCTS, getTopCleanProducts, getProductsByStore } from '../../../shared/mockData';

type Props = NativeStackScreenProps<HomeStackParamList, 'Store'>;

// ─── Category pill data ───────────────────────────────────────────────────────
const CATEGORY_PILLS = [
  'All', 'Snacks', 'Dairy-Free', 'Pantry', 'Beverages', 'Frozen', 'Produce', 'Supplements',
];

// ─── ProductCard ──────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: Product;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
}

function ProductCard({ product, badge, badgeColor, onPress }: ProductCardProps) {
  const sc = scoreColor(product.cleanScore);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.productEmojiWrap, { backgroundColor: sc + '22' }]}>
        <Text style={styles.productEmoji}>{product.emoji}</Text>
        {badge ? (
          <View style={[styles.productBadge, { backgroundColor: badgeColor ?? Colors.accent }]}>
            <Text style={styles.productBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productBrand} numberOfLines={1}>{product.brand}</Text>
      </View>
      <View style={[styles.scoreCircle, { backgroundColor: sc + '22', borderColor: sc }]}>
        <Text style={[styles.scoreNumber, { color: sc }]}>{product.cleanScore}</Text>
      </View>
    </Pressable>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllLink}>See all →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── StoreScreen ─────────────────────────────────────────────────────────────
export default function StoreScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { storeId } = route.params;
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const store = STORES.find(s => s.id === storeId) ?? STORES[0];
  const storeProducts = getProductsByStore(storeId);
  const cleanPicks = getTopCleanProducts(6).filter(p => p.stores.includes(storeId));
  const topCleanFallback = cleanPicks.length >= 3 ? cleanPicks : getTopCleanProducts(6);

  // Category-filtered products
  const snacks = PRODUCTS.filter(p =>
    (p.category === 'snacks' || p.category === 'bars' || p.category === 'chips_crackers') &&
    (p.stores.includes(storeId) || storeProducts.length < 3)
  ).slice(0, 8);

  const dairyFree = PRODUCTS.filter(p =>
    p.dietCompatible.includes('dairy_free') &&
    (p.stores.includes(storeId) || storeProducts.length < 3)
  ).slice(0, 8);

  const pantry = PRODUCTS.filter(p =>
    (p.category === 'condiments' || p.category === 'oils' || p.category === 'sauces' ||
     p.category === 'spreads' || p.category === 'baking') &&
    (p.stores.includes(storeId) || storeProducts.length < 3)
  ).slice(0, 8);

  function navigateToProduct(productId: string) {
    navigation.navigate('ProductDetail', { productId });
  }

  function handleSearchSubmit() {
    if (searchQuery.trim()) {
      navigation.navigate('SearchResults', { query: searchQuery.trim(), storeId });
    }
  }

  return (
    <View style={styles.root}>
      {/* Background blobs */}
      <View style={styles.blob1} pointerEvents="none" />
      <View style={styles.blob2} pointerEvents="none" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
        {/* Top row: back + title */}
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={s(22)} color={Colors.textOffWhite} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.storeEmoji}>{store.emoji}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{store.name}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusDot, { backgroundColor: store.isOpen ? Colors.scoreClean : Colors.scoreAvoid }]} />
            <Text style={[styles.statusText, { color: store.isOpen ? Colors.scoreClean : Colors.scoreAvoid }]}>
              {store.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {/* Search within store */}
        <View style={styles.storeSearchRow}>
          <View style={[styles.storeSearchContainer, { borderColor: store.color + '60' }]}>
            <Feather name="search" size={s(16)} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search in ${store.name}...`}
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>
        </View>
      </View>

      {/* ── Category Pills (sticky) ───────────────────────────────────────── */}
      <View style={styles.pillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
        >
          {CATEGORY_PILLS.map(cat => {
            const active = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + s(100) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Store meta */}
        <View style={[styles.storeMeta, { borderLeftColor: store.color }]}>
          <View style={styles.storeMetaLeft}>
            <Text style={styles.storeMetaTitle}>Clean Picks Available</Text>
            <Text style={styles.storeMetaCount}>{store.productCount} products tracked</Text>
          </View>
          {store.distance && (
            <View style={styles.distanceBadge}>
              <Ionicons name="location-outline" size={s(12)} color={Colors.textMuted} />
              <Text style={styles.distanceText}>{store.distance}</Text>
            </View>
          )}
        </View>

        {/* ── Clean Picks for You ───────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Clean Picks for You 🌿" />
          <FlatList
            data={topCleanFallback}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hListPadding}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                badge="Best Match"
                badgeColor={Colors.accent}
                onPress={() => navigateToProduct(item.id)}
              />
            )}
          />
        </View>

        {/* ── Top Snacks ────────────────────────────────────────────────── */}
        {snacks.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Top Snacks"
              onSeeAll={() => navigation.navigate('SearchResults', { query: 'snacks', storeId })}
            />
            <FlatList
              data={snacks}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hListPadding}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() => navigateToProduct(item.id)}
                />
              )}
            />
          </View>
        )}

        {/* ── Dairy-Free Options ────────────────────────────────────────── */}
        {dairyFree.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Dairy-Free Options"
              onSeeAll={() => navigation.navigate('SearchResults', { query: 'dairy-free', storeId })}
            />
            <FlatList
              data={dairyFree}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hListPadding}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() => navigateToProduct(item.id)}
                />
              )}
            />
          </View>
        )}

        {/* ── Pantry Staples ───────────────────────────────────────────── */}
        {pantry.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Pantry Staples"
              onSeeAll={() => navigation.navigate('SearchResults', { query: 'pantry', storeId })}
            />
            <FlatList
              data={pantry}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hListPadding}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() => navigateToProduct(item.id)}
                />
              )}
            />
          </View>
        )}

        {/* ── Browse All button ─────────────────────────────────────────── */}
        <Pressable
          onPress={() => navigation.navigate('SearchResults', { query: '', storeId })}
          style={({ pressed }) => [styles.browseAllBtn, { backgroundColor: store.color, opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="grid" size={s(18)} color="#fff" />
          <Text style={styles.browseAllText}>Browse All Products at {store.name}</Text>
          <Feather name="arrow-right" size={s(18)} color="#fff" />
        </Pressable>
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

  // Background blobs
  blob1: {
    position: 'absolute',
    width: s(300),
    height: s(300),
    borderRadius: s(150),
    backgroundColor: Colors.accent + '14',
    top: -s(80),
    right: -s(80),
  },
  blob2: {
    position: 'absolute',
    width: s(200),
    height: s(200),
    borderRadius: s(100),
    backgroundColor: Colors.accentDark + '10',
    bottom: s(180),
    left: -s(60),
  },

  // Header
  header: {
    backgroundColor: Colors.canvasDark,
    paddingHorizontal: Space.base,
    paddingBottom: s(12),
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(12),
  },
  backBtn: {
    width: s(36),
    height: s(36),
    borderRadius: Radius.pill,
    backgroundColor: Colors.canvasMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(10),
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  storeEmoji: {
    fontSize: s(22),
  },
  headerTitle: {
    fontSize: s(20),
    fontWeight: '700',
    color: Colors.textOffWhite,
    fontFamily: Font.bold,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  statusDot: {
    width: s(8),
    height: s(8),
    borderRadius: Radius.pill,
  },
  statusText: {
    fontSize: s(12),
    fontWeight: '600',
    fontFamily: Font.medium,
  },

  // Store search
  storeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.canvasMid,
    borderRadius: Radius.pill,
    height: s(42),
    paddingHorizontal: s(14),
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: s(8),
  },
  searchInput: {
    flex: 1,
    fontSize: s(14),
    color: Colors.textOffWhite,
    fontFamily: Font.regular,
    paddingVertical: 0,
  },

  // Category pills
  pillsWrapper: {
    backgroundColor: Colors.canvas,
    paddingVertical: s(10),
    borderBottomWidth: 1,
    borderBottomColor: Colors.accentDark + '20',
    zIndex: 9,
  },
  pillsContent: {
    paddingHorizontal: Space.base,
    gap: s(8),
  },
  pill: {
    paddingHorizontal: s(16),
    paddingVertical: s(7),
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.accentDark + '40',
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pillText: {
    fontSize: s(13),
    fontWeight: '500',
    color: Colors.textOnLight,
    fontFamily: Font.medium,
  },
  pillTextActive: {
    color: Colors.canvasDark,
    fontWeight: '700',
    fontFamily: Font.bold,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: s(16),
  },

  // Store meta strip
  storeMeta: {
    marginHorizontal: Space.base,
    marginBottom: s(20),
    padding: s(12),
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radius.md,
    borderLeftWidth: s(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeMetaLeft: { flex: 1 },
  storeMetaTitle: {
    fontSize: s(14),
    fontWeight: '700',
    color: Colors.textOnLight,
    fontFamily: Font.bold,
  },
  storeMetaCount: {
    fontSize: s(12),
    color: Colors.textMidDark,
    fontFamily: Font.regular,
    marginTop: s(2),
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    backgroundColor: Colors.accentDark + '15',
    paddingHorizontal: s(8),
    paddingVertical: s(4),
    borderRadius: Radius.pill,
  },
  distanceText: {
    fontSize: s(12),
    color: Colors.textMidDark,
    fontFamily: Font.medium,
    fontWeight: '500',
  },

  // Sections
  section: {
    marginBottom: s(24),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.base,
    marginBottom: s(12),
  },
  sectionTitle: {
    fontSize: s(17),
    fontWeight: '700',
    color: Colors.textOnLight,
    fontFamily: Font.bold,
  },
  seeAllLink: {
    fontSize: s(13),
    color: Colors.accentDark,
    fontFamily: Font.medium,
    fontWeight: '500',
  },
  hListPadding: {
    paddingHorizontal: Space.base,
    gap: s(12),
  },

  // Product card
  productCard: {
    width: s(160),
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.accentDark + '18',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  productEmojiWrap: {
    height: s(100),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productEmoji: { fontSize: s(46) },
  productBadge: {
    position: 'absolute',
    top: s(8),
    left: s(8),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: Radius.pill,
  },
  productBadgeText: {
    fontSize: s(9),
    fontWeight: '700',
    color: Colors.canvasDark,
    fontFamily: Font.bold,
  },
  productInfo: {
    padding: s(10),
    paddingTop: s(8),
    paddingBottom: s(28),
  },
  productName: {
    fontSize: s(13),
    fontWeight: '700',
    color: Colors.textOnLight,
    fontFamily: Font.bold,
    lineHeight: s(17),
  },
  productBrand: {
    fontSize: s(11),
    color: Colors.textMidDark,
    fontFamily: Font.regular,
    marginTop: s(2),
  },
  scoreCircle: {
    position: 'absolute',
    bottom: s(10),
    right: s(10),
    width: s(34),
    height: s(34),
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  scoreNumber: {
    fontSize: s(11),
    fontWeight: '800',
    fontFamily: Font.bold,
  },

  // Browse all button
  browseAllBtn: {
    marginHorizontal: Space.base,
    marginTop: s(8),
    height: s(54),
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(10),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  browseAllText: {
    fontSize: s(15),
    fontWeight: '700',
    color: '#fff',
    fontFamily: Font.bold,
    flex: 1,
    textAlign: 'center',
  },
});
