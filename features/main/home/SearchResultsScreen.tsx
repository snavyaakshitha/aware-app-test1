import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  Colors, Font, Space, Radius, Shadow, s,
  scoreColor, scoreBgColor, scoreLabel,
} from '../../../shared/theme';
import { HomeStackParamList, Product } from '../../../shared/types';
import { searchProducts, PRODUCTS } from '../../../shared/mockData';

type Props = NativeStackScreenProps<HomeStackParamList, 'SearchResults'>;

const SORT_OPTIONS = ['Best Match', 'Highest Clean Score', 'Lowest Price', 'Most Reviews'] as const;
type SortOption = typeof SORT_OPTIONS[number];

const PROFILE_FILTERS = ['PCOS', 'Gluten-Free', 'No Seed Oils'];

const BADGE_LABEL: Record<string, string> = {
  cleanest: 'Cleanest 🌿',
  best_for_you: 'Best for You',
  best_overall: 'Best Overall',
  best_value: 'Best Value',
  top_rated: 'Top Rated',
  new: 'New',
};

function useSpring() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  return { scale, onPressIn, onPressOut };
}

function ScoreCircle({ score, size = s(52) }: { score: number; size?: number }) {
  const color = scoreColor(score);
  const bg = scoreBgColor(score);
  return (
    <View style={[styles.scoreCircle, { width: size, height: size, borderRadius: size / 2, borderColor: color, backgroundColor: bg }]}>
      <Text style={[styles.scoreNum, { color, fontSize: size * 0.34 }]}>{score}</Text>
      <Text style={[styles.scoreLabel, { color, fontSize: size * 0.17 }]}>{scoreLabel(score)}</Text>
    </View>
  );
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = useSpring();
  const topBadge = product.badges[0];
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={styles.productCard}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
      >
        {/* Product image */}
        <View style={[styles.productEmoji, { backgroundColor: scoreBgColor(product.cleanScore) }]}>
          {topBadge && (
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeText}>{BADGE_LABEL[topBadge]}</Text>
            </View>
          )}
          <Text style={styles.productEmojiText}>{product.emoji}</Text>
        </View>

        {/* Center info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.productBrand}>{product.brand}</Text>
          {product.dietCompatible.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dietTagRow}>
              {product.dietCompatible.slice(0, 3).map(d => (
                <View key={d} style={styles.dietTag}>
                  <Text style={styles.dietTagText}>{d.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Right column */}
        <View style={styles.productRight}>
          <ScoreCircle score={product.cleanScore} />
          <View style={[styles.verifiedBadge, { backgroundColor: product.verified ? Colors.scoreCleanBg : Colors.scoreCautionBg }]}>
            <Text style={[styles.verifiedText, { color: product.verified ? Colors.scoreClean : Colors.scoreCaution }]}>
              {product.verified ? '✓ Verified' : 'Community'}
            </Text>
          </View>
          {product.price && <Text style={styles.priceText}>{product.price}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SearchResultsScreen({ route, navigation }: Props) {
  const { query: initialQuery, storeId } = route.params;
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState(initialQuery);
  const [activeFilters, setActiveFilters] = useState<string[]>(PROFILE_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('Best Match');
  const [showSortModal, setShowSortModal] = useState(false);
  const sortModalAnim = useRef(new Animated.Value(0)).current;

  const openSortModal = () => {
    setShowSortModal(true);
    Animated.spring(sortModalAnim, { toValue: 1, useNativeDriver: true, speed: 14 }).start();
  };
  const closeSortModal = () => {
    Animated.spring(sortModalAnim, { toValue: 0, useNativeDriver: true, speed: 14 }).start(() => setShowSortModal(false));
  };

  const results = useCallback((): Product[] => {
    let r = searchProducts(query);
    if (r.length === 0) r = PRODUCTS.slice(0, 6); // fallback
    if (sortBy === 'Highest Clean Score') r = [...r].sort((a, b) => b.cleanScore - a.cleanScore);
    return r;
  }, [query, sortBy])();

  const removeFilter = (f: string) => setActiveFilters(prev => prev.filter(x => x !== f));

  const { scale: sortScale, onPressIn: sortIn, onPressOut: sortOut } = useSpring();
  const { scale: cancelScale, onPressIn: cancelIn, onPressOut: cancelOut } = useSpring();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background ellipses */}
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={s(22)} color={Colors.textDark} />
        </Pressable>

        <View style={styles.searchBar}>
          <Feather name="search" size={s(16)} color={Colors.textMidDark} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products…"
            placeholderTextColor={Colors.textMidDark}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <Feather name="x-circle" size={s(16)} color={Colors.textMidDark} />
            </Pressable>
          )}
        </View>

        <Animated.View style={{ transform: [{ scale: cancelScale }] }}>
          <Pressable
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
            onPressIn={cancelIn}
            onPressOut={cancelOut}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Filter row */}
      <View style={styles.filterRowWrapper}>
        <Text style={styles.filtersLabel}>Filters:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
          {activeFilters.map(f => (
            <View key={f} style={styles.filterChip}>
              <Text style={styles.filterChipText}>{f}</Text>
              <Pressable onPress={() => removeFilter(f)} style={styles.filterChipX} accessibilityLabel={`Remove ${f} filter`}>
                <Feather name="x" size={s(11)} color={Colors.accent} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addFilterChip} accessibilityRole="button" accessibilityLabel="Add filter">
            <Feather name="plus" size={s(13)} color={Colors.accent} />
            <Text style={styles.addFilterText}>Add</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Sort row */}
      <View style={styles.sortRow}>
        <Animated.View style={{ transform: [{ scale: sortScale }] }}>
          <Pressable
            style={styles.sortBtn}
            onPress={openSortModal}
            onPressIn={sortIn}
            onPressOut={sortOut}
            accessibilityRole="button"
          >
            <Text style={styles.sortBtnText}>Sort: {sortBy}</Text>
            <Feather name="chevron-down" size={s(14)} color={Colors.textDark} />
          </Pressable>
        </Animated.View>
      </View>

      {/* Results count */}
      <View style={styles.resultsCountRow}>
        <Text style={styles.resultsCount}>
          {results.length} products found
        </Text>
        <Text style={styles.resultsCountAccent}> — all fit your profile ✓</Text>
      </View>

      {/* Product list */}
      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + s(24) }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No products found for "{query}"</Text>
          <Text style={styles.emptySubtitle}>Try removing a filter</Text>
          <View style={styles.addProductCard}>
            <Text style={styles.addProductText}>Want to help? Add this product to Aware →</Text>
          </View>
        </View>
      )}

      {/* Sort Modal */}
      <Modal transparent visible={showSortModal} onRequestClose={closeSortModal} animationType="none">
        <Pressable style={styles.modalOverlay} onPress={closeSortModal}>
          <Animated.View
            style={[
              styles.sortSheet,
              {
                transform: [
                  { translateY: sortModalAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) },
                ],
                paddingBottom: insets.bottom + s(16),
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sort By</Text>
            {SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[styles.sortOption, sortBy === opt && styles.sortOptionActive]}
                onPress={() => { setSortBy(opt); closeSortModal(); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: sortBy === opt }}
              >
                <Text style={[styles.sortOptionText, sortBy === opt && styles.sortOptionTextActive]}>
                  {opt}
                </Text>
                {sortBy === opt && <Feather name="check" size={s(18)} color={Colors.accent} />}
              </Pressable>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
    overflow: 'hidden',
  },
  ellipse1: {
    position: 'absolute',
    width: s(583),
    height: s(770),
    backgroundColor: '#79FFA8',
    borderRadius: s(400),
    top: s(80),
    left: s(-50),
    ...(Platform.OS === 'web' ? { filter: 'blur(400px)' } as any : {}),
    opacity: 0.55,
  },
  ellipse5: {
    position: 'absolute',
    width: s(1034),
    height: s(1055),
    backgroundColor: '#012F13',
    borderRadius: s(530),
    top: s(-450),
    left: s(-400),
    ...(Platform.OS === 'web' ? { filter: 'blur(60px)' } as any : {}),
    opacity: 0.18,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.base,
    paddingVertical: Space.sm,
    gap: Space.sm,
    zIndex: 10,
  },
  backBtn: {
    width: s(36),
    height: s(36),
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: Radius.xl,
    paddingHorizontal: Space.md,
    height: s(40),
    ...Shadow.sm,
  },
  searchIcon: { marginRight: Space.xs },
  searchInput: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textDark,
    paddingVertical: 0,
  },
  clearBtn: { padding: Space.xs },
  cancelBtn: { paddingHorizontal: Space.sm },
  cancelText: { fontFamily: Font.bold, fontSize: s(14), color: Colors.textDark, fontWeight: '700' },

  // Filters
  filterRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Space.base,
    zIndex: 10,
    marginBottom: Space.xs,
  },
  filtersLabel: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(13),
    color: Colors.textDark,
    marginRight: Space.sm,
  },
  filterScroll: { flex: 1 },
  filterScrollContent: { paddingRight: Space.base, gap: Space.xs, flexDirection: 'row', alignItems: 'center' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: s(10),
    paddingVertical: s(5),
    gap: s(4),
  },
  filterChipText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(12), color: Colors.accent },
  filterChipX: { padding: s(1) },
  addFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.pill,
    paddingHorizontal: s(10),
    paddingVertical: s(5),
    gap: s(3),
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  addFilterText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(12), color: Colors.accent },

  // Sort
  sortRow: {
    paddingHorizontal: Space.base,
    paddingBottom: Space.xs,
    zIndex: 10,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radius.xl,
    paddingHorizontal: Space.md,
    paddingVertical: s(6),
    gap: s(5),
    ...Shadow.sm,
  },
  sortBtnText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(13), color: Colors.textDark },

  // Results count
  resultsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.base,
    paddingBottom: Space.sm,
    zIndex: 10,
  },
  resultsCount: { fontFamily: Font.regular, fontSize: s(13), color: Colors.textDark },
  resultsCountAccent: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(13), color: Colors.scoreClean },

  // Product card
  listContent: { paddingHorizontal: Space.base },
  separator: { height: Space.sm },
  productCard: {
    flexDirection: 'row',
    height: s(110),
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  productEmoji: {
    width: s(80),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  topBadge: {
    position: 'absolute',
    top: s(6),
    left: s(4),
    backgroundColor: Colors.canvasDark,
    borderRadius: Radius.pill,
    paddingHorizontal: s(5),
    paddingVertical: s(2),
  },
  topBadgeText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(9), color: Colors.textWhite },
  productEmojiText: { fontSize: s(38) },
  productInfo: {
    flex: 1,
    paddingVertical: s(10),
    paddingHorizontal: Space.sm,
    justifyContent: 'space-between',
  },
  productName: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(14),
    color: Colors.textDark,
    lineHeight: s(19),
  },
  productBrand: { fontFamily: Font.regular, fontSize: s(12), color: Colors.textMidDark, opacity: 0.7 },
  dietTagRow: { marginTop: s(3) },
  dietTag: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: s(7),
    paddingVertical: s(2),
    marginRight: s(4),
  },
  dietTagText: { fontFamily: Font.regular, fontSize: s(10), color: Colors.accent, textTransform: 'capitalize' },
  productRight: {
    width: s(70),
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: Space.sm,
    gap: s(4),
  },
  scoreCircle: {
    borderWidth: s(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { fontFamily: Font.bold, fontWeight: '700', lineHeight: undefined },
  scoreLabel: { fontFamily: Font.regular, lineHeight: undefined },
  verifiedBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: s(5),
    paddingVertical: s(2),
  },
  verifiedText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(9) },
  priceText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(12), color: Colors.textDark },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
    gap: Space.md,
  },
  emptyEmoji: { fontSize: s(64) },
  emptyTitle: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(18), color: Colors.textDark, textAlign: 'center' },
  emptySubtitle: { fontFamily: Font.regular, fontSize: s(14), color: Colors.textMidDark, textAlign: 'center' },
  addProductCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Space.base,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  addProductText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(14), color: Colors.accent },

  // Sort modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Space.xl,
    gap: Space.xs,
  },
  sheetHandle: {
    width: s(40),
    height: s(4),
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Space.base,
  },
  sheetTitle: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(18),
    color: Colors.textDark,
    marginBottom: Space.sm,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.md,
    paddingHorizontal: Space.base,
    borderRadius: Radius.lg,
  },
  sortOptionActive: { backgroundColor: Colors.accentLight },
  sortOptionText: { fontFamily: Font.regular, fontSize: s(16), color: Colors.textDark },
  sortOptionTextActive: { fontFamily: Font.bold, fontWeight: '700', color: Colors.accent },
});
