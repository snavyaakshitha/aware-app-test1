/**
 * HomeScreen — Main feed for Aware.
 * Nearby stores + personalized product recommendations.
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { Colors, Font, Space, Radius, s, scoreColor, scoreLabel } from '../../../shared/theme';
import { HomeStackParamList, Product, Store } from '../../../shared/types';
import { STORES, PRODUCTS, getTopCleanProducts } from '../../../shared/mockData';

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

// ─── ProductCard ──────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: Product;
  badge?: string;
  onPress: () => void;
}

function ProductCard({ product, badge, onPress }: ProductCardProps) {
  const sc = scoreColor(product.cleanScore);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.85 }]}
    >
      {/* Emoji area */}
      <View style={[styles.productEmojiWrap, { backgroundColor: sc + '22' }]}>
        <Text style={styles.productEmoji}>{product.emoji}</Text>
        {badge ? (
          <View style={styles.productBadge}>
            <Text style={styles.productBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>

      {/* Info */}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productBrand} numberOfLines={1}>{product.brand}</Text>
      </View>

      {/* Score circle */}
      <View style={[styles.scoreCircle, { backgroundColor: sc + '22', borderColor: sc }]}>
        <Text style={[styles.scoreNumber, { color: sc }]}>{product.cleanScore}</Text>
      </View>
    </Pressable>
  );
}

// ─── StoreCard ────────────────────────────────────────────────────────────────
interface StoreCardProps {
  store: Store;
  onPress: () => void;
}

function StoreCard({ store, onPress }: StoreCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.storeCard, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.storeIconWrap, { backgroundColor: store.color + '33' }]}>
        <Text style={styles.storeEmoji}>{store.emoji}</Text>
      </View>
      <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
      <Text style={styles.storeCount}>{store.productCount}</Text>
      <View style={styles.storeStatusRow}>
        <View style={[styles.statusDot, { backgroundColor: store.isOpen ? Colors.scoreClean : Colors.scoreAvoid }]} />
        <Text style={[styles.statusText, { color: store.isOpen ? Colors.scoreClean : Colors.scoreAvoid }]}>
          {store.isOpen ? 'Open' : 'Closed'}
        </Text>
      </View>
    </Pressable>
  );
}

function SeeAllStoresCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.seeAllCard}>
      <View style={styles.seeAllIconWrap}>
        <Feather name="plus" size={s(22)} color={Colors.accent} />
      </View>
      <Text style={styles.seeAllCardText}>More{'\n'}Stores</Text>
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

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNavProp>();
  const [searchQuery, setSearchQuery] = useState('');

  const topClean = getTopCleanProducts(8);
  const pcosProducts = PRODUCTS.filter(p => p.healthConditionsGoodFor.includes('pcos')).slice(0, 8);
  const snackProducts = PRODUCTS.filter(p => p.category === 'snacks' || p.category === 'bars').slice(0, 8);
  const recentProducts = PRODUCTS.slice(0, 4);

  function handleSearchSubmit() {
    if (searchQuery.trim()) {
      navigation.navigate('SearchResults', { query: searchQuery.trim() });
    }
  }

  function navigateToStore(storeId: string) {
    navigation.navigate('Store', { storeId });
  }

  function navigateToProduct(productId: string) {
    navigation.navigate('ProductDetail', { productId });
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.canvas} />

      {/* Background blobs */}
      <View style={[styles.blob1]} pointerEvents="none" />
      <View style={[styles.blob2]} pointerEvents="none" />

      {/* ── Fixed Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
        <Pressable style={styles.locationRow} onPress={() => {/* location modal stub */}}>
          <Ionicons name="location-sharp" size={s(16)} color={Colors.accent} />
          <Text style={styles.locationText}>San Francisco, CA</Text>
          <Feather name="chevron-down" size={s(14)} color={Colors.textMidDark} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="notifications-outline" size={s(22)} color={Colors.textMidDark} />
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable Content ────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + s(24) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Text style={styles.greeting}>Good morning, Jane 👋</Text>
        <Text style={styles.subGreeting}>Here's what's clean near you today.</Text>

        {/* ── Search bar ──────────────────────────────────────────────────── */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <View style={styles.searchAccentBar} />
            <Feather name="search" size={s(18)} color={Colors.accentDark} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, brands..."
              placeholderTextColor={Colors.textMidDark + 'aa'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>
          <Pressable style={styles.filterBtn} hitSlop={8}>
            <Feather name="sliders" size={s(18)} color={Colors.canvasDark} />
          </Pressable>
        </View>

        {/* ── Nearby Stores ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Nearby Stores" onSeeAll={() => {}} />
          <FlatList
            data={STORES}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hListPadding}
            renderItem={({ item }) => (
              <StoreCard store={item} onPress={() => navigateToStore(item.id)} />
            )}
            ListFooterComponent={<SeeAllStoresCard onPress={() => {}} />}
          />
        </View>

        {/* ── Highly Rated & Clean ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="Highly Rated & Clean ✨"
            onSeeAll={() => navigation.navigate('SearchResults', { query: 'top clean' })}
          />
          <FlatList
            data={topClean}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hListPadding}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                badge={item.badges.includes('cleanest') ? 'Cleanest' : item.badges.includes('best_for_you') ? 'Best for You' : undefined}
                onPress={() => navigateToProduct(item.id)}
              />
            )}
          />
        </View>

        {/* ── Best for PCOS ─────────────────────────────────────────────────── */}
        {pcosProducts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Best for PCOS 🌸"
              onSeeAll={() => navigation.navigate('SearchResults', { query: 'pcos' })}
            />
            <FlatList
              data={pcosProducts}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hListPadding}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  badge="Best for You"
                  onPress={() => navigateToProduct(item.id)}
                />
              )}
            />
          </View>
        )}

        {/* ── Quick Healthy Snacks ──────────────────────────────────────────── */}
        {snackProducts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Quick Healthy Snacks 🥗"
              onSeeAll={() => navigation.navigate('SearchResults', { query: 'snacks' })}
            />
            <FlatList
              data={snackProducts}
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

        {/* ── Recently Viewed ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Recently Viewed" />
          <FlatList
            data={recentProducts}
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
    width: s(260),
    height: s(260),
    borderRadius: s(130),
    backgroundColor: Colors.accent + '18',
    top: -s(60),
    right: -s(60),
  },
  blob2: {
    position: 'absolute',
    width: s(200),
    height: s(200),
    borderRadius: s(100),
    backgroundColor: Colors.accentDark + '12',
    bottom: s(200),
    left: -s(80),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.base,
    paddingBottom: s(10),
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  locationText: {
    fontSize: s(15),
    fontWeight: '600',
    color: Colors.textDark,
    fontFamily: Font.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  iconBtn: {
    width: s(36),
    height: s(36),
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: s(36),
    height: s(36),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: s(13),
    fontWeight: '700',
    color: Colors.canvasDark,
    fontFamily: Font.bold,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: s(4),
  },

  // Greeting
  greeting: {
    fontSize: s(22),
    fontWeight: '700',
    color: Colors.textOnLight,
    fontFamily: Font.bold,
    paddingHorizontal: Space.base,
    marginTop: s(4),
  },
  subGreeting: {
    fontSize: s(14),
    color: Colors.textMidDark,
    fontFamily: Font.regular,
    paddingHorizontal: Space.base,
    marginTop: s(2),
    marginBottom: s(16),
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.base,
    gap: s(10),
    marginBottom: s(24),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderRadius: Radius.pill,
    height: s(48),
    paddingRight: s(14),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.accentDark + '40',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  searchAccentBar: {
    width: s(4),
    alignSelf: 'stretch',
    backgroundColor: Colors.accent,
    borderTopLeftRadius: Radius.pill,
    borderBottomLeftRadius: Radius.pill,
  },
  searchIcon: {
    marginHorizontal: s(10),
  },
  searchInput: {
    flex: 1,
    fontSize: s(15),
    color: Colors.textOnLight,
    fontFamily: Font.regular,
    paddingVertical: 0,
  },
  filterBtn: {
    width: s(48),
    height: s(48),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  section: {
    marginBottom: s(28),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.base,
    marginBottom: s(12),
  },
  sectionTitle: {
    fontSize: s(18),
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

  // Store cards
  storeCard: {
    width: s(110),
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: Radius.lg,
    padding: s(10),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accentDark + '20',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  storeIconWrap: {
    width: s(56),
    height: s(56),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(6),
  },
  storeEmoji: {
    fontSize: s(28),
  },
  storeName: {
    fontSize: s(12),
    fontWeight: '700',
    color: Colors.textOnLight,
    fontFamily: Font.bold,
    textAlign: 'center',
  },
  storeCount: {
    fontSize: s(10),
    color: Colors.textMidDark,
    fontFamily: Font.regular,
    marginTop: s(2),
    textAlign: 'center',
  },
  storeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: s(5),
  },
  statusDot: {
    width: s(6),
    height: s(6),
    borderRadius: Radius.pill,
  },
  statusText: {
    fontSize: s(10),
    fontWeight: '600',
    fontFamily: Font.medium,
  },

  // See all stores card
  seeAllCard: {
    width: s(110),
    backgroundColor: 'transparent',
    borderRadius: Radius.lg,
    padding: s(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accentDark + '40',
    borderStyle: 'dashed',
  },
  seeAllIconWrap: {
    width: s(44),
    height: s(44),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(6),
  },
  seeAllCardText: {
    fontSize: s(12),
    fontWeight: '600',
    color: Colors.accentDark,
    fontFamily: Font.bold,
    textAlign: 'center',
  },

  // Product cards
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
  productEmoji: {
    fontSize: s(46),
  },
  productBadge: {
    position: 'absolute',
    top: s(8),
    left: s(8),
    backgroundColor: Colors.accent,
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
});
