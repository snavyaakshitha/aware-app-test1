/**
 * Aware — Lists Screen
 * v4 design: cream #FAFAF7 bg, white cards, teal accent.
 * Shows user shopping lists with clean-score average.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  TextInput,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, s, Radius, scoreColor, Shadow } from '../../../shared/theme';
import { MOCK_LISTS, STORES } from '../../../shared/mockData';
import type { ListsStackParamList, ShoppingList } from '../../../shared/types';

type Props = NativeStackScreenProps<ListsStackParamList, 'Lists'>;

function formatDate(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ─── List card (v4 light design) ─────────────────────────────────────────────

function ListCard({ list, onPress }: { list: ShoppingList; onPress: () => void }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const store = STORES.find(s => s.id === list.storeId);
  const avgScore = list.cleanScoreAvg ?? 75;
  const checkedCount = list.items.filter(i => i.checked).length;
  const sColor = scoreColor(avgScore);

  const onPressIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, tension: 400, friction: 20 }).start();
  const onPressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, tension: 400, friction: 20 }).start();

  // Score badge bg
  const scoreBg =
    avgScore >= 80 ? Colors.scoreCleanBg :
    avgScore >= 50 ? Colors.scoreCautionBg :
    Colors.scoreAvoidBg;

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }], marginBottom: s(12) }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.listCard}
      >
        {/* Top row: store + score badge */}
        <View style={styles.listCardTop}>
          <View style={styles.listStoreTag}>
            <Text style={styles.listStoreEmoji}>{store?.emoji ?? '🛒'}</Text>
            <Text style={styles.listStoreName}>{store?.name ?? 'Any Store'}</Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: scoreBg }]}>
            <Text style={[styles.scoreBadgeText, { color: sColor }]}>
              {avgScore}
            </Text>
          </View>
        </View>

        {/* List name */}
        <Text style={styles.listName}>{list.name}</Text>

        {/* Product preview emojis */}
        <View style={styles.emojiRow}>
          {list.items.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.emojiChip}>
              <Text style={{ fontSize: s(18) }}>{item.product.emoji}</Text>
            </View>
          ))}
          {list.items.length > 4 && (
            <View style={styles.emojiChip}>
              <Text style={styles.moreText}>+{list.items.length - 4}</Text>
            </View>
          )}
        </View>

        {/* Bottom meta row */}
        <View style={styles.listCardMeta}>
          <View style={styles.metaItem}>
            <Feather name="package" size={s(12)} color={Colors.textTertiary} />
            <Text style={styles.metaText}>
              {list.items.length} item{list.items.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {checkedCount > 0 && (
            <View style={styles.metaItem}>
              <Feather name="check-square" size={s(12)} color={Colors.accent} />
              <Text style={[styles.metaText, { color: Colors.accent }]}>
                {checkedCount} checked
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Feather name="clock" size={s(12)} color={Colors.textTertiary} />
            <Text style={styles.metaText}>{formatDate(list.updatedAt)}</Text>
          </View>
        </View>

        {/* Shared badge */}
        {list.isShared && list.sharedWith && (
          <View style={styles.sharedBadge}>
            <Feather name="users" size={s(12)} color={Colors.accent} />
            <Text style={styles.sharedText}>
              Shared with {list.sharedWith.join(', ')}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── ListsScreen ──────────────────────────────────────────────────────────────

export default function ListsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const sheetY = useRef(new Animated.Value(400)).current;

  const openCreateSheet = () => {
    setShowCreateSheet(true);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
  };

  const closeCreateSheet = () => {
    Animated.timing(sheetY, { toValue: 400, duration: 250, useNativeDriver: true }).start(() => {
      setShowCreateSheet(false);
      setNewListName('');
      setSelectedStoreId(null);
    });
  };

  const totalItems = MOCK_LISTS.reduce((sum, l) => sum + l.items.length, 0);
  const avgScore = MOCK_LISTS.length
    ? Math.round(MOCK_LISTS.reduce((sum, l) => sum + (l.cleanScoreAvg ?? 75), 0) / MOCK_LISTS.length)
    : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.canvas} />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + s(10) }]}>
        <View>
          <Text style={styles.headerTitle}>My Lists</Text>
          <Text style={styles.headerSub}>{MOCK_LISTS.length} lists · {totalItems} items</Text>
        </View>
        <Pressable onPress={openCreateSheet} style={styles.createBtn}>
          <Feather name="plus" size={s(20)} color="white" />
        </Pressable>
      </View>

      {/* ── Average score summary card ──────────────────────────────── */}
      {MOCK_LISTS.length > 0 && (
        <View style={styles.scoreSummaryCard}>
          <View style={styles.scoreSummaryLeft}>
            <Text style={styles.scoreSummaryLabel}>Average clean score</Text>
            <View style={styles.scoreSummaryBarTrack}>
              <View
                style={[
                  styles.scoreSummaryBarFill,
                  { width: `${avgScore}%` as any, backgroundColor: scoreColor(avgScore) },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.scoreSummaryNum, { color: scoreColor(avgScore) }]}>
            {avgScore}
            <Text style={styles.scoreSummaryDenom}>/100</Text>
          </Text>
        </View>
      )}

      {/* ── List ───────────────────────────────────────────────────── */}
      {MOCK_LISTS.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: s(56) }}>🛒</Text>
          <Text style={styles.emptyTitle}>No lists yet</Text>
          <Text style={styles.emptySub}>
            Create a shopping list to track clean products for your next store run
          </Text>
          <Pressable onPress={openCreateSheet} style={styles.emptyBtn}>
            <Feather name="plus" size={s(16)} color="white" />
            <Text style={styles.emptyBtnText}>Create your first list</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={MOCK_LISTS}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + s(100) },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ListCard
              list={item}
              onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
            />
          )}
          ListFooterComponent={() => (
            <Pressable onPress={openCreateSheet} style={styles.addMoreBtn}>
              <Feather name="plus-circle" size={s(18)} color={Colors.textTertiary} />
              <Text style={styles.addMoreText}>Create new list</Text>
            </Pressable>
          )}
        />
      )}

      {/* ── Create list bottom sheet ────────────────────────────────── */}
      {showCreateSheet && (
        <Pressable style={styles.backdrop} onPress={closeCreateSheet}>
          <Animated.View
            style={[styles.createSheet, { transform: [{ translateY: sheetY }] }]}
          >
            <Pressable onPress={() => {}} style={{ flex: 1 }}>
              {/* Handle */}
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>New List</Text>

              <TextInput
                style={styles.nameInput}
                placeholder="List name (e.g. Weekly Whole Foods)"
                placeholderTextColor={Colors.textTertiary}
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />

              <Text style={styles.sheetSubLabel}>Link to a store (optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storeRow}
              >
                {STORES.slice(0, 6).map(store => (
                  <Pressable
                    key={store.id}
                    onPress={() => setSelectedStoreId(store.id === selectedStoreId ? null : store.id)}
                    style={[
                      styles.storeChip,
                      selectedStoreId === store.id && styles.storeChipSelected,
                    ]}
                  >
                    <Text>{store.emoji}</Text>
                    <Text style={[
                      styles.storeChipText,
                      selectedStoreId === store.id && styles.storeChipTextSelected,
                    ]}>
                      {store.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                onPress={() => { if (newListName.trim()) closeCreateSheet(); }}
                style={[styles.createConfirmBtn, !newListName.trim() && { opacity: 0.45 }]}
              >
                <Text style={styles.createConfirmText}>Create List</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingBottom: s(14),
  },
  headerTitle: {
    fontFamily: Font.bold,
    fontSize: s(26),
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textSecondary,
    marginTop: s(2),
  },
  createBtn: {
    width: s(44),
    height: s(44),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },

  // Score summary card
  scoreSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: s(20),
    marginBottom: s(16),
    backgroundColor: 'white',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: s(14),
    gap: s(12),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  scoreSummaryLeft: { flex: 1 },
  scoreSummaryLabel: {
    fontFamily: Font.medium,
    fontSize: s(12),
    color: Colors.textSecondary,
    marginBottom: s(6),
  },
  scoreSummaryBarTrack: {
    height: s(6),
    backgroundColor: Colors.canvas2,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  scoreSummaryBarFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  scoreSummaryNum: {
    fontFamily: Font.bold,
    fontSize: s(24),
    fontWeight: '700',
  },
  scoreSummaryDenom: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textSecondary,
  },

  // FlatList
  listContent: {
    paddingHorizontal: s(20),
  },

  // List card (v4 light)
  listCard: {
    backgroundColor: 'white',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: s(16),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  listCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  listStoreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  listStoreEmoji: { fontSize: s(15) },
  listStoreName: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textSecondary,
  },
  scoreBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: s(10),
    paddingVertical: s(3),
  },
  scoreBadgeText: {
    fontFamily: Font.bold,
    fontSize: s(13),
    fontWeight: '700',
  },
  listName: {
    fontFamily: Font.bold,
    fontSize: s(17),
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: s(10),
  },
  emojiRow: {
    flexDirection: 'row',
    gap: s(6),
    marginBottom: s(10),
  },
  emojiChip: {
    width: s(38),
    height: s(38),
    borderRadius: Radius.sm,
    backgroundColor: Colors.canvas2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  moreText: {
    fontFamily: Font.medium,
    fontSize: s(12),
    color: Colors.textTertiary,
  },
  listCardMeta: {
    flexDirection: 'row',
    gap: s(14),
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  metaText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textTertiary,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    marginTop: s(8),
    paddingTop: s(8),
    borderTopWidth: 1,
    borderColor: Colors.divider,
  },
  sharedText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.accent,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(32),
    gap: s(10),
  },
  emptyTitle: {
    fontFamily: Font.bold,
    fontSize: s(22),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: s(21),
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: s(20),
    paddingVertical: s(12),
    marginTop: s(8),
  },
  emptyBtnText: {
    fontFamily: Font.bold,
    fontSize: s(15),
    fontWeight: '600',
    color: 'white',
  },

  // Add more button
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    paddingVertical: s(16),
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    marginBottom: s(24),
    backgroundColor: 'white',
  },
  addMoreText: {
    fontFamily: Font.medium,
    fontSize: s(14),
    color: Colors.textTertiary,
  },

  // Sheet backdrop + card
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  createSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
    padding: s(20),
    paddingBottom: s(40),
    minHeight: s(320),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  sheetHandle: {
    width: s(36),
    height: s(4),
    borderRadius: Radius.pill,
    backgroundColor: '#D0D0CC',
    alignSelf: 'center',
    marginBottom: s(16),
  },
  sheetTitle: {
    fontFamily: Font.bold,
    fontSize: s(20),
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: s(16),
  },
  nameInput: {
    backgroundColor: Colors.canvas,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E0E0DC',
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    fontFamily: Font.regular,
    fontSize: s(15),
    color: Colors.textPrimary,
    marginBottom: s(16),
  },
  sheetSubLabel: {
    fontFamily: Font.medium,
    fontSize: s(13),
    color: Colors.textSecondary,
    marginBottom: s(10),
  },
  storeRow: {
    paddingHorizontal: s(4),
    gap: s(8),
    flexDirection: 'row',
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(12),
    paddingVertical: s(8),
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#E0E0DC',
    backgroundColor: Colors.canvas,
  },
  storeChipSelected: {
    backgroundColor: Colors.tealLight,
    borderColor: Colors.accent,
  },
  storeChipText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textSecondary,
  },
  storeChipTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  createConfirmBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    height: s(52),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(20),
  },
  createConfirmText: {
    fontFamily: Font.bold,
    fontSize: s(16),
    fontWeight: '600',
    color: 'white',
  },
});
