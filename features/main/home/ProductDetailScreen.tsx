import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
  Platform,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  Colors, Font, Space, Radius, Shadow, s,
  scoreColor, scoreBgColor, scoreLabel,
} from '../../../shared/theme';
import { HomeStackParamList, Product, Ingredient } from '../../../shared/types';
import { getProductById, PRODUCTS, STORES } from '../../../shared/mockData';

type Props = NativeStackScreenProps<HomeStackParamList, 'ProductDetail'>;
type TabKey = 'overview' | 'ingredients' | 'why';

// Mock user profile for demo
const USER_CONDITIONS = ['PCOS', 'Hypothyroidism'];
const USER_AVOIDS = ['Sunflower Oil'];

function useSpring() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  return { scale, onPressIn, onPressOut };
}

// ── Clean Score Gauge ──────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const color = scoreColor(score);
  const bg = scoreBgColor(score);
  const size = s(90);
  return (
    <View style={[styles.gaugeOuter, { width: size, height: size, borderRadius: size / 2, borderColor: color, backgroundColor: bg }]}>
      <Text style={[styles.gaugeScore, { color, fontSize: s(32) }]}>{score}</Text>
      <Text style={[styles.gaugeLabel, { color }]}>{scoreLabel(score)}</Text>
    </View>
  );
}

// ── Confidence Badge ───────────────────────────────────────────────────────────
function ConfidenceBadge({ badge }: { badge: Product['confidenceBadge'] }) {
  const map = {
    verified: { label: 'Verified ✓', color: Colors.scoreClean, bg: Colors.scoreCleanBg },
    community: { label: 'Community', color: Colors.scoreCaution, bg: Colors.scoreCautionBg },
    pending:   { label: 'Pending',   color: Colors.textMuted,   bg: Colors.surfaceLight },
  };
  const { label, color, bg } = map[badge];
  return (
    <View style={[styles.confBadge, { backgroundColor: bg }]}>
      <Text style={[styles.confBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Add to List Modal ─────────────────────────────────────────────────────────
function AddToListModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.addListSheet, { paddingBottom: insets.bottom + s(16) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add to List</Text>
          <View style={styles.listOptionRow}>
            <Text style={styles.listOptionText}>🛒  Weekly Whole Foods Run</Text>
          </View>
          <View style={styles.listOptionRow}>
            <Text style={styles.listOptionText}>🎯  Target Quick Picks</Text>
          </View>
          <View style={styles.listOptionRow}>
            <Text style={styles.listOptionText}>🌸  PCOS-Friendly Pantry</Text>
          </View>
          <Pressable style={styles.newListBtn} onPress={onClose}>
            <Feather name="plus" size={s(16)} color={Colors.accent} />
            <Text style={styles.newListBtnText}>Create New List</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Ingredient row ─────────────────────────────────────────────────────────────
function IngredientRow({ ing }: { ing: Ingredient }) {
  const [expanded, setExpanded] = useState(false);
  const dotColor = ing.isConcern
    ? (ing.reason?.toLowerCase().includes('major') ? Colors.scoreAvoid : Colors.scoreCaution)
    : Colors.scoreClean;
  return (
    <Pressable
      style={styles.ingRow}
      onPress={() => ing.reason && setExpanded(e => !e)}
      accessibilityRole={ing.reason ? 'button' : 'text'}
    >
      <View style={[styles.ingDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.ingName}>{ing.name}</Text>
        {expanded && ing.reason && (
          <Text style={styles.ingReason}>{ing.reason}</Text>
        )}
      </View>
      {ing.reason && (
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={s(14)} color={Colors.textMuted} />
      )}
    </Pressable>
  );
}

// ── Mini product card for Similar Products ─────────────────────────────────────
function MiniProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = useSpring();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={styles.miniCard} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={[styles.miniEmoji, { backgroundColor: scoreBgColor(product.cleanScore) }]}>
          <Text style={styles.miniEmojiText}>{product.emoji}</Text>
        </View>
        <Text style={styles.miniName} numberOfLines={2}>{product.name}</Text>
        <View style={[styles.miniScore, { borderColor: scoreColor(product.cleanScore), backgroundColor: scoreBgColor(product.cleanScore) }]}>
          <Text style={[styles.miniScoreNum, { color: scoreColor(product.cleanScore) }]}>{product.cleanScore}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Tab Bar ────────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'why', label: 'Why Clean?' },
  ];
  const underline = useRef(new Animated.Value(0)).current;
  const tabPositions: Record<TabKey, number> = { overview: 0, ingredients: 1, why: 2 };

  const handlePress = (key: TabKey) => {
    Animated.spring(underline, {
      toValue: tabPositions[key],
      useNativeDriver: false,
      speed: 20,
    }).start();
    onChange(key);
  };

  const tabWidth = 100 / tabs.length;

  return (
    <View style={styles.tabBar}>
      {tabs.map(t => (
        <Pressable
          key={t.key}
          style={styles.tabItem}
          onPress={() => handlePress(t.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === t.key }}
        >
          <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>
            {t.label}
          </Text>
        </Pressable>
      ))}
      <Animated.View
        style={[
          styles.tabUnderline,
          {
            width: `${tabWidth}%` as any,
            left: underline.interpolate({
              inputRange: [0, 1, 2],
              outputRange: ['0%', `${tabWidth}%`, `${tabWidth * 2}%`],
            }),
          },
        ]}
      />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const insets = useSafeAreaInsets();

  const product = getProductById(productId) ?? PRODUCTS[0];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showAddList, setShowAddList] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const { scale: backScale, onPressIn: backIn, onPressOut: backOut } = useSpring();
  const { scale: addScale, onPressIn: addIn, onPressOut: addOut } = useSpring();

  const productStores = STORES.filter(s => product.stores.includes(s.id));
  const similarProducts = PRODUCTS
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 3);

  const cleanCount = product.allIngredients.filter(i => i.isClean).length;
  const concernCount = product.allIngredients.filter(i => i.isConcern).length;
  const flagCount = product.allIngredients.filter(i => !i.isClean && !i.isConcern).length;

  const profileMatch = product.healthConditionsGoodFor
    .map(c => c.replace(/_/g, ' ').toUpperCase())
    .filter(c => USER_CONDITIONS.some(u => c.includes(u.toUpperCase())));

  const avoidConflicts = product.allIngredients
    .filter(i => USER_AVOIDS.some(a => i.name.toLowerCase().includes(a.toLowerCase())));

  return (
    <View style={[styles.container, { paddingBottom: 0 }]}>
      {/* Background ellipses */}
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      {/* Fixed Header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + s(8) }]}>
        <Animated.View style={{ transform: [{ scale: backScale }] }}>
          <Pressable style={styles.headerBtn} onPress={() => navigation.goBack()} onPressIn={backIn} onPressOut={backOut}>
            <Feather name="arrow-left" size={s(20)} color={Colors.textDark} />
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: addScale }] }}>
          <Pressable style={styles.headerAddBtn} onPress={() => setShowAddList(true)} onPressIn={addIn} onPressOut={addOut}>
            <Feather name="plus" size={s(16)} color={Colors.textWhite} />
            <Text style={styles.headerAddText}>Add to List</Text>
          </Pressable>
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + s(120) }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Hero section */}
        <View style={[styles.hero, { paddingTop: insets.top + s(72) }]}>
          <View style={styles.heroCard}>
            {/* Confidence badge */}
            <View style={styles.heroBadgeRow}>
              <ConfidenceBadge badge={product.confidenceBadge} />
            </View>

            {/* Product emoji */}
            <View style={[styles.heroEmojiWrapper, { backgroundColor: scoreBgColor(product.cleanScore) }]}>
              <Text style={styles.heroEmoji}>{product.emoji}</Text>
            </View>

            {/* Score gauge */}
            <View style={styles.gaugeWrapper}>
              <ScoreGauge score={product.cleanScore} />
            </View>

            {/* Brand + name */}
            <View style={styles.heroMeta}>
              <Text style={styles.heroBrand}>{product.brand}</Text>
              <Text style={styles.heroName}>{product.name}</Text>
            </View>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.quickStats}>
          <View style={styles.statPill}>
            <Text style={styles.statText}>🍽️ {product.calories} cal</Text>
          </View>
          {product.protein != null && (
            <View style={styles.statPill}>
              <Text style={styles.statText}>💪 {product.protein}g protein</Text>
            </View>
          )}
          {product.sodium != null && (
            <View style={styles.statPill}>
              <Text style={styles.statText}>🧂 {product.sodium}mg sodium</Text>
            </View>
          )}
        </View>

        {/* Health Fit bar */}
        <View style={styles.healthFitCard}>
          <Text style={styles.healthFitLabel}>Health Fit for Your Profile</Text>
          <View style={styles.healthBar}>
            <View
              style={[
                styles.healthBarFill,
                {
                  width: `${product.healthScore}%` as any,
                  backgroundColor: scoreColor(product.healthScore),
                },
              ]}
            />
          </View>
          {profileMatch.length > 0 && (
            <View style={styles.healthFitRow}>
              <Text style={styles.healthFitWorksText}>Works for: </Text>
              {USER_CONDITIONS.map(c => (
                <View key={c} style={styles.healthCondChip}>
                  <Text style={styles.healthCondChipText}>{c}</Text>
                </View>
              ))}
            </View>
          )}
          {avoidConflicts.length > 0 && (
            <View style={styles.healthWarnRow}>
              <Ionicons name="warning-outline" size={s(14)} color={Colors.scoreCaution} />
              <Text style={styles.healthWarnText}>
                Contains: {avoidConflicts.map(i => i.name).join(', ')} (on your avoid list)
              </Text>
            </View>
          )}
        </View>

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Diet compatibility */}
            <Text style={styles.sectionTitle}>Diet Compatibility</Text>
            <View style={styles.dietRow}>
              {product.dietCompatible.map(d => (
                <View key={d} style={styles.dietBadge}>
                  <Text style={styles.dietBadgeText}>{d.replace(/_/g, ' ')} ✓</Text>
                </View>
              ))}
            </View>

            {/* Available at */}
            {productStores.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Available At</Text>
                <View style={styles.storeRow}>
                  {productStores.map(st => (
                    <View key={st.id} style={[styles.storePill, { borderColor: st.color }]}>
                      <Text style={styles.storeText}>{st.emoji} {st.name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Similar clean products */}
            {similarProducts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Similar Clean Products</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniCardScroll}>
                  {similarProducts.map(p => (
                    <MiniProductCard
                      key={p.id}
                      product={p}
                      onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        )}

        {/* Tab: Ingredients */}
        {activeTab === 'ingredients' && (
          <View style={styles.tabContent}>
            <View style={styles.ingBreakdown}>
              <View style={styles.ingCount}>
                <View style={[styles.ingCountDot, { backgroundColor: Colors.scoreClean }]} />
                <Text style={styles.ingCountText}>{cleanCount} Clean</Text>
              </View>
              {concernCount > 0 && (
                <View style={styles.ingCount}>
                  <View style={[styles.ingCountDot, { backgroundColor: Colors.scoreCaution }]} />
                  <Text style={styles.ingCountText}>{concernCount} Concerns</Text>
                </View>
              )}
              {flagCount > 0 && (
                <View style={styles.ingCount}>
                  <View style={[styles.ingCountDot, { backgroundColor: Colors.scoreAvoid }]} />
                  <Text style={styles.ingCountText}>{flagCount} Flags</Text>
                </View>
              )}
            </View>

            <View style={styles.ingList}>
              {product.allIngredients.map((ing, idx) => (
                <IngredientRow key={`${ing.name}-${idx}`} ing={ing} />
              ))}
            </View>
          </View>
        )}

        {/* Tab: Why Clean? */}
        {activeTab === 'why' && (
          <View style={styles.tabContent}>
            <Text style={styles.whyCleanText}>{product.whyClean}</Text>

            {/* Methodology accordion */}
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setShowMethodology(m => !m)}
              accessibilityRole="button"
            >
              <Text style={styles.accordionTitle}>How we score</Text>
              <Feather name={showMethodology ? 'chevron-up' : 'chevron-down'} size={s(18)} color={Colors.textDark} />
            </Pressable>
            {showMethodology && (
              <View style={styles.accordionBody}>
                <Text style={styles.accordionText}>
                  We analyze ingredient quality, processing level, and third-party certifications to arrive at the Clean Score.
                </Text>
                <Pressable style={styles.learnMoreBtn}>
                  <Text style={styles.learnMoreText}>Learn about our methodology →</Text>
                </Pressable>
              </View>
            )}

            {/* Source */}
            <View style={styles.sourceCard}>
              <Feather name={product.verified ? 'shield' : 'users'} size={s(16)} color={product.verified ? Colors.scoreClean : Colors.scoreCaution} />
              <Text style={styles.sourceText}>
                {product.verified ? 'Verified by Aware Team' : 'Community Contributed'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + s(16) }]}>
        <View style={styles.bottomCtaRow}>
          {/* Share */}
          <Pressable style={styles.iconCta} accessibilityLabel="Share product">
            <Feather name="share-2" size={s(20)} color={Colors.textDark} />
          </Pressable>

          {/* Add to List */}
          <Pressable
            style={styles.addToListBtn}
            onPress={() => setShowAddList(true)}
            accessibilityRole="button"
          >
            <Feather name="plus" size={s(18)} color={Colors.textWhite} />
            <Text style={styles.addToListBtnText}>Add to List</Text>
          </Pressable>

          {/* Save */}
          <Pressable style={styles.iconCta} accessibilityLabel="Save product">
            <Feather name="bookmark" size={s(20)} color={Colors.textDark} />
          </Pressable>
        </View>
      </View>

      <AddToListModal visible={showAddList} onClose={() => setShowAddList(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.canvas, overflow: 'hidden' },
  scroll: { flex: 1 },
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
    zIndex: 0,
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
    zIndex: 0,
  },

  // Fixed header
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.base,
    paddingBottom: Space.sm,
    zIndex: 100,
  },
  headerBtn: {
    width: s(38),
    height: s(38),
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: s(8),
    gap: s(4),
    ...Shadow.sm,
  },
  headerAddText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(13), color: Colors.textWhite },

  // Hero
  hero: { paddingHorizontal: Space.base, paddingBottom: Space.base, zIndex: 1 },
  heroCard: {
    backgroundColor: Colors.canvasMid,
    borderRadius: Radius.xxl,
    padding: Space.xl,
    alignItems: 'center',
    ...Shadow.lg,
    minHeight: s(240),
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBadgeRow: {
    position: 'absolute',
    top: Space.base,
    left: Space.base,
    zIndex: 10,
  },
  heroEmojiWrapper: {
    width: s(100),
    height: s(100),
    borderRadius: s(50),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.sm,
  },
  heroEmoji: { fontSize: s(60) },
  gaugeWrapper: {
    position: 'absolute',
    right: Space.xl,
    bottom: s(60),
  },
  heroMeta: { alignItems: 'flex-start', width: '100%', paddingTop: Space.sm },
  heroBrand: { fontFamily: Font.regular, fontSize: s(14), color: Colors.textMuted },
  heroName: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(22),
    color: Colors.textWhite,
    lineHeight: s(28),
    marginTop: s(2),
  },

  // Confidence badge
  confBadge: { borderRadius: Radius.pill, paddingHorizontal: s(10), paddingVertical: s(4) },
  confBadgeText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(12) },

  // Gauge
  gaugeOuter: {
    borderWidth: s(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: { fontFamily: Font.bold, fontWeight: '700' },
  gaugeLabel: { fontFamily: Font.regular, fontSize: s(11), marginTop: -s(2) },

  // Quick stats
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: Space.base,
    gap: Space.sm,
    marginBottom: Space.base,
    flexWrap: 'wrap',
    zIndex: 1,
  },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: s(7),
    ...Shadow.sm,
  },
  statText: { fontFamily: Font.regular, fontSize: s(13), color: Colors.textDark },

  // Health Fit
  healthFitCard: {
    marginHorizontal: Space.base,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: Radius.xl,
    padding: Space.base,
    marginBottom: Space.base,
    ...Shadow.sm,
    zIndex: 1,
  },
  healthFitLabel: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(14),
    color: Colors.textDark,
    marginBottom: Space.sm,
  },
  healthBar: {
    height: s(8),
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginBottom: Space.sm,
  },
  healthBarFill: { height: '100%', borderRadius: Radius.pill },
  healthFitRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Space.xs },
  healthFitWorksText: { fontFamily: Font.regular, fontSize: s(12), color: Colors.textDark },
  healthCondChip: {
    backgroundColor: Colors.scoreCleanBg,
    borderRadius: Radius.pill,
    paddingHorizontal: s(8),
    paddingVertical: s(3),
  },
  healthCondChipText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(11), color: Colors.scoreClean },
  healthWarnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: Colors.scoreCautionBg,
    borderRadius: Radius.sm,
    padding: s(7),
    marginTop: Space.sm,
  },
  healthWarnText: { fontFamily: Font.regular, fontSize: s(12), color: Colors.scoreCaution, flex: 1 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Space.base,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: Radius.xl,
    padding: s(4),
    marginBottom: Space.base,
    position: 'relative',
    zIndex: 1,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: s(9) },
  tabLabel: { fontFamily: Font.regular, fontSize: s(13), color: Colors.textMidDark },
  tabLabelActive: { fontFamily: Font.bold, fontWeight: '700', color: Colors.accent },
  tabUnderline: {
    position: 'absolute',
    bottom: s(6),
    height: s(3),
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
  },

  // Tab content
  tabContent: { paddingHorizontal: Space.base, gap: Space.base, zIndex: 1 },
  sectionTitle: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(15),
    color: Colors.textDark,
    marginBottom: -Space.xs,
  },
  dietRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs },
  dietBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: s(12),
    paddingVertical: s(6),
  },
  dietBadgeText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(12), color: Colors.accent, textTransform: 'capitalize' },
  storeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  storePill: {
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: s(6),
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  storeText: { fontFamily: Font.regular, fontSize: s(13), color: Colors.textDark },
  miniCardScroll: { gap: Space.sm, paddingRight: Space.base },
  miniCard: {
    width: s(110),
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: Radius.lg,
    padding: Space.sm,
    alignItems: 'center',
    ...Shadow.sm,
  },
  miniEmoji: {
    width: s(52),
    height: s(52),
    borderRadius: s(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xs,
  },
  miniEmojiText: { fontSize: s(30) },
  miniName: {
    fontFamily: Font.regular,
    fontSize: s(11),
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: s(4),
  },
  miniScore: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    borderWidth: s(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniScoreNum: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(12) },

  // Ingredients tab
  ingBreakdown: {
    flexDirection: 'row',
    gap: Space.base,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radius.lg,
    padding: Space.base,
  },
  ingCount: { flexDirection: 'row', alignItems: 'center', gap: s(5) },
  ingCountDot: { width: s(10), height: s(10), borderRadius: s(5) },
  ingCountText: { fontFamily: Font.regular, fontSize: s(13), color: Colors.textDark },
  ingList: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Space.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: Space.sm,
  },
  ingDot: { width: s(10), height: s(10), borderRadius: s(5), marginTop: s(3) },
  ingName: { fontFamily: Font.regular, fontSize: s(14), color: Colors.textDark },
  ingReason: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.scoreCaution,
    marginTop: s(3),
  },

  // Why Clean tab
  whyCleanText: {
    fontFamily: Font.regular,
    fontSize: s(15),
    color: Colors.textDark,
    lineHeight: s(24),
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radius.lg,
    padding: Space.base,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radius.lg,
    padding: Space.base,
  },
  accordionTitle: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(15), color: Colors.textDark },
  accordionBody: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: Radius.lg,
    padding: Space.base,
    marginTop: -Space.sm,
    gap: Space.sm,
  },
  accordionText: { fontFamily: Font.regular, fontSize: s(14), color: Colors.textDark, lineHeight: s(22) },
  learnMoreBtn: {},
  learnMoreText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(14),
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radius.lg,
    padding: Space.base,
  },
  sourceText: { fontFamily: Font.regular, fontSize: s(13), color: Colors.textDark },

  // Bottom CTA
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(226, 240, 204, 0.95)',
    paddingTop: Space.sm,
    paddingHorizontal: Space.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    zIndex: 100,
  },
  bottomCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  iconCta: {
    width: s(46),
    height: s(46),
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  addToListBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.xl,
    height: s(48),
    gap: s(6),
    ...Shadow.md,
  },
  addToListBtnText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(16), color: Colors.textWhite },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  addListSheet: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Space.xl,
    gap: Space.sm,
  },
  sheetHandle: {
    width: s(40),
    height: s(4),
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Space.sm,
  },
  sheetTitle: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(20),
    color: Colors.textDark,
    marginBottom: Space.xs,
  },
  listOptionRow: {
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  listOptionText: { fontFamily: Font.regular, fontSize: s(16), color: Colors.textDark },
  newListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.md,
  },
  newListBtnText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(16), color: Colors.accent },
});
