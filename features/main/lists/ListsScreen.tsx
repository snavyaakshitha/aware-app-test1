/**
 * Aware — Lists / Carts Screen
 *
 * Shows all user shopping lists. Each list links to a store and
 * shows a clean-score average. Supports shared lists (shareable with
 * doctors, nutritionists, family).
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
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

function ListCard({ list, onPress }: { list: ShoppingList; onPress: () => void }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const store = STORES.find(s => s.id === list.storeId);

  const onPressIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, tension: 400, friction: 20 }).start();
  const onPressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, tension: 400, friction: 20 }).start();

  const avgScore = list.cleanScoreAvg ?? 75;
  const checkedCount = list.items.filter(i => i.checked).length;

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }], marginBottom: s(12) }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.listCard}
      >
        {/* Top row */}
        <View style={styles.listCardTop}>
          <View style={styles.listStoreTag}>
            <Text style={styles.listStoreEmoji}>{store?.emoji ?? '🛒'}</Text>
            <Text style={styles.listStoreName}>{store?.name ?? 'Any Store'}</Text>
          </View>
          <View style={[styles.scoreTag, { borderColor: scoreColor(avgScore) }]}>
            <Text style={[styles.scoreTagText, { color: scoreColor(avgScore) }]}>
              {avgScore}
            </Text>
            <Feather name="activity" size={s(11)} color={scoreColor(avgScore)} />
          </View>
        </View>

        {/* List name */}
        <Text style={styles.listName}>{list.name}</Text>

        {/* Product preview emojis */}
        <View style={styles.emojiRow}>
          {list.items.slice(0, 4).map((item, i) => (
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
            <Feather name="package" size={s(13)} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {list.items.length} item{list.items.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {checkedCount > 0 && (
            <View style={styles.metaItem}>
              <Feather name="check-square" size={s(13)} color={Colors.accent} />
              <Text style={[styles.metaText, { color: Colors.accent }]}>
                {checkedCount} checked
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Feather name="clock" size={s(13)} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatDate(list.updatedAt)}</Text>
          </View>
        </View>

        {/* Shared badge */}
        {list.isShared && list.sharedWith && (
          <View style={styles.sharedBadge}>
            <Feather name="users" size={s(12)} color={Colors.info} />
            <Text style={styles.sharedText}>
              Shared with {list.sharedWith.join(', ')}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function ListsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const sheetY = useRef(new Animated.Value(400)).current;

  const openCreateSheet = () => {
    setShowCreateSheet(true);
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  };

  const closeCreateSheet = () => {
    Animated.timing(sheetY, {
      toValue: 400,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowCreateSheet(false);
      setNewListName('');
      setSelectedStoreId(null);
    });
  };

  const totalItems = MOCK_LISTS.reduce((sum, l) => sum + l.items.length, 0);
  const avgScore = Math.round(
    MOCK_LISTS.reduce((sum, l) => sum + (l.cleanScoreAvg ?? 75), 0) / MOCK_LISTS.length
  );

  return (
    <View style={styles.root}>
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
        <View>
          <Text style={styles.headerTitle}>My Lists</Text>
          <Text style={styles.headerSub}>{MOCK_LISTS.length} lists · {totalItems} items</Text>
        </View>
        <Pressable onPress={openCreateSheet} style={styles.createBtn}>
          <Feather name="plus" size={s(20)} color={Colors.textDark} />
        </Pressable>
      </View>

      {/* Clean score summary strip */}
      <View style={styles.scoreSummary}>
        <View style={styles.scoreSummaryLeft}>
          <Text style={styles.scoreSummaryLabel}>Average List Clean Score</Text>
          <View style={styles.scoreSummaryBar}>
            <View style={[styles.scoreFill, {
              width: `${avgScore}%` as any,
              backgroundColor: scoreColor(avgScore),
            }]} />
          </View>
        </View>
        <Text style={[styles.scoreSummaryNum, { color: scoreColor(avgScore) }]}>
          {avgScore}<Text style={styles.scoreSummaryDenom}>/100</Text>
        </Text>
      </View>

      {/* List */}
      {MOCK_LISTS.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: s(56) }}>🛒</Text>
          <Text style={styles.emptyTitle}>No lists yet</Text>
          <Text style={styles.emptySub}>
            Create a shopping list to track clean products for your next store run
          </Text>
          <Pressable onPress={openCreateSheet} style={styles.emptyBtn}>
            <Feather name="plus" size={s(16)} color={Colors.textDark} />
            <Text style={styles.emptyBtnText}>Create your first list</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={MOCK_LISTS}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: s(16) }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ListCard
              list={item}
              onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
            />
          )}
          ListFooterComponent={() => (
            <Pressable onPress={openCreateSheet} style={styles.addMoreBtn}>
              <Feather name="plus-circle" size={s(18)} color={Colors.textMuted} />
              <Text style={styles.addMoreText}>Create new list</Text>
            </Pressable>
          )}
        />
      )}

      {/* Create sheet */}
      {showCreateSheet && (
        <Pressable style={styles.backdrop} onPress={closeCreateSheet}>
          <Animated.View
            style={[styles.createSheet, { transform: [{ translateY: sheetY }] }]}
          >
            <Pressable onPress={() => {}} style={{ flex: 1 }}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>New List</Text>

              <TextInput
                style={styles.nameInput}
                placeholder="List name (e.g. Weekly Whole Foods)"
                placeholderTextColor={Colors.textMuted}
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />

              <Text style={styles.sheetSubLabel}>Link to a store (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: s(4), gap: s(8), flexDirection: 'row' }}>
                {STORES.slice(0, 6).map(store => (
                  <Pressable
                    key={store.id}
                    onPress={() => setSelectedStoreId(store.id === selectedStoreId ? null : store.id)}
                    style={[
                      styles.storeChip,
                      selectedStoreId === store.id && {
                        backgroundColor: Colors.accentLight,
                        borderColor: Colors.accent,
                      },
                    ]}
                  >
                    <Text>{store.emoji}</Text>
                    <Text style={[
                      styles.storeChipText,
                      selectedStoreId === store.id && { color: Colors.textDark, fontWeight: '600' },
                    ]}>
                      {store.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                onPress={() => {
                  if (newListName.trim()) closeCreateSheet();
                }}
                style={[styles.createConfirmBtn, !newListName.trim() && { opacity: 0.5 }]}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
    overflow: 'hidden',
  },
  ellipse1: {
    position: 'absolute',
    width: s(583),
    height: s(770),
    borderRadius: s(400),
    backgroundColor: '#79FFA8',
    top: s(80),
    left: s(-50),
    ...Platform.select({ web: { filter: `blur(${s(400)}px)` } as any }),
  },
  ellipse5: {
    position: 'absolute',
    width: s(1034),
    height: s(1055),
    borderRadius: s(530),
    backgroundColor: Colors.canvasDark,
    top: s(-450),
    left: s(-400),
    ...Platform.select({
      ios: { shadowColor: Colors.canvasDark, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: s(60) },
      web: { filter: `blur(${s(60)}px)` } as any,
    }),
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingBottom: s(12),
    zIndex: 10,
  },
  headerTitle: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(28),
    color: Colors.textWhite,
  },
  headerSub: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    marginTop: s(2),
  },
  createBtn: {
    width: s(44),
    height: s(44),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scoreSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: s(16),
    marginBottom: s(12),
    backgroundColor: 'rgba(2,47,19,0.22)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: s(14),
    gap: s(12),
  },
  scoreSummaryLeft: { flex: 1 },
  scoreSummaryLabel: {
    fontFamily: Font.medium,
    fontWeight: '500',
    fontSize: s(13),
    color: Colors.textMuted,
    marginBottom: s(6),
  },
  scoreSummaryBar: {
    height: s(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  scoreSummaryNum: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(28),
  },
  scoreSummaryDenom: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
  },

  listCard: {
    backgroundColor: 'rgba(2,47,19,0.2)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: s(16),
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
  listStoreEmoji: { fontSize: s(16) },
  listStoreName: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
  },
  scoreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: s(8),
    paddingVertical: s(3),
  },
  scoreTagText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(13),
  },
  listName: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(18),
    color: Colors.textWhite,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moreText: {
    fontFamily: Font.medium,
    fontWeight: '500',
    fontSize: s(12),
    color: Colors.textMuted,
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
    color: Colors.textMuted,
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
    color: Colors.info,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(32),
    gap: s(10),
  },
  emptyTitle: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(22),
    color: Colors.textWhite,
  },
  emptySub: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: s(21),
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: s(20),
    paddingVertical: s(12),
    marginTop: s(8),
  },
  emptyBtnText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(15),
    color: Colors.textDark,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    paddingVertical: s(16),
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginBottom: s(24),
  },
  addMoreText: {
    fontFamily: Font.medium,
    fontWeight: '500',
    fontSize: s(14),
    color: Colors.textMuted,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  createSheet: {
    backgroundColor: '#0A2A15',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderTopWidth: 1,
    borderColor: Colors.border,
    padding: s(20),
    paddingBottom: s(40),
    minHeight: s(320),
  },
  sheetHandle: {
    width: s(36),
    height: s(4),
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: s(16),
  },
  sheetTitle: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(22),
    color: Colors.textWhite,
    marginBottom: s(16),
  },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    fontFamily: Font.regular,
    fontSize: s(15),
    color: Colors.textWhite,
    marginBottom: s(16),
  },
  sheetSubLabel: {
    fontFamily: Font.medium,
    fontWeight: '500',
    fontSize: s(13),
    color: Colors.textMuted,
    marginBottom: s(10),
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(12),
    paddingVertical: s(8),
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  storeChipText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textOffWhite,
  },
  createConfirmBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: s(14),
    alignItems: 'center',
    marginTop: s(20),
  },
  createConfirmText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(16),
    color: Colors.textDark,
  },

  // Reuse divider
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
});
