/**
 * Aware — List Detail Screen
 * Shows all items in a shopping list. Supports check-off, quantity change,
 * share, and per-item clean score.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Pressable, Platform, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, s, Radius, scoreColor } from '../../../shared/theme';
import { MOCK_LISTS } from '../../../shared/mockData';
import type { ListsStackParamList } from '../../../shared/types';

type Props = NativeStackScreenProps<ListsStackParamList, 'ListDetail'>;

export default function ListDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const list = MOCK_LISTS.find(l => l.id === route.params.listId) ?? MOCK_LISTS[0];
  const [items, setItems] = useState(list.items);

  const toggleCheck = (id: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  return (
    <View style={styles.root}>
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={s(24)} color={Colors.textWhite} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{list.name}</Text>
          {list.storeName && (
            <Text style={styles.headerSub}>{list.storeName}</Text>
          )}
        </View>
        <Pressable style={styles.shareBtn}>
          <Feather name="share-2" size={s(18)} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          {checked.length} of {items.length} checked
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${items.length > 0 ? (checked.length / items.length) * 100 : 0}%` as any,
          }]} />
        </View>
      </View>

      <FlatList
        data={[...unchecked, ...checked]}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: s(16) }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => toggleCheck(item.id)}
            style={[styles.itemCard, item.checked && styles.itemChecked]}
          >
            <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
              {item.checked && <Feather name="check" size={s(14)} color={Colors.textDark} />}
            </View>
            <View style={styles.itemEmoji}>
              <Text style={{ fontSize: s(26) }}>{item.product.emoji}</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, item.checked && styles.strikethrough]} numberOfLines={1}>
                {item.product.name}
              </Text>
              <Text style={styles.itemBrand}>{item.product.brand}</Text>
            </View>
            <View style={[styles.itemScore, { borderColor: scoreColor(item.product.cleanScore) }]}>
              <Text style={[styles.itemScoreText, { color: scoreColor(item.product.cleanScore) }]}>
                {item.product.cleanScore}
              </Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={() => (
          <Pressable style={styles.addItemBtn}>
            <Feather name="plus" size={s(16)} color={Colors.accent} />
            <Text style={styles.addItemText}>Add item</Text>
          </Pressable>
        )}
      />

      {/* Share CTA */}
      <View style={styles.shareStrip}>
        <Feather name="users" size={s(16)} color={Colors.info} />
        <Text style={styles.shareStripText}>Share with a nutritionist or family member</Text>
        <Pressable style={styles.shareNowBtn}>
          <Text style={styles.shareNowText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas, overflow: 'hidden' },
  ellipse1: {
    position: 'absolute', width: s(583), height: s(770), borderRadius: s(400),
    backgroundColor: '#79FFA8', top: s(80), left: s(-50),
    ...Platform.select({ web: { filter: `blur(${s(400)}px)` } as any }),
  },
  ellipse5: {
    position: 'absolute', width: s(1034), height: s(1055), borderRadius: s(530),
    backgroundColor: Colors.canvasDark, top: s(-450), left: s(-400),
    ...Platform.select({ web: { filter: `blur(${s(60)}px)` } as any }),
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(16), paddingBottom: s(12), zIndex: 10,
  },
  backBtn: {
    width: s(40), height: s(40), borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, paddingHorizontal: s(10) },
  headerTitle: {
    fontFamily: Font.bold, fontWeight: '700', fontSize: s(18), color: Colors.textWhite,
  },
  headerSub: { fontFamily: Font.regular, fontSize: s(13), color: Colors.textMuted },
  shareBtn: {
    width: s(40), height: s(40), borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  progressRow: {
    paddingHorizontal: s(16), marginBottom: s(12), gap: s(6), zIndex: 10,
  },
  progressLabel: { fontFamily: Font.regular, fontSize: s(12), color: Colors.textMuted },
  progressBar: {
    height: s(5), backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.pill, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: Radius.pill },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: s(12),
    backgroundColor: 'rgba(2,47,19,0.2)', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: s(12), marginBottom: s(8),
  },
  itemChecked: { opacity: 0.55 },
  checkbox: {
    width: s(24), height: s(24), borderRadius: s(6),
    borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  itemEmoji: {
    width: s(44), height: s(44), borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: Font.medium, fontWeight: '500', fontSize: s(14), color: Colors.textWhite },
  itemBrand: { fontFamily: Font.regular, fontSize: s(12), color: Colors.textMuted },
  strikethrough: { textDecorationLine: 'line-through', color: Colors.textMuted },
  itemScore: {
    width: s(36), height: s(36), borderRadius: s(18), borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  itemScoreText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(13) },

  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: s(6), borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', paddingVertical: s(14), marginBottom: s(24),
  },
  addItemText: {
    fontFamily: Font.medium, fontWeight: '500', fontSize: s(14), color: Colors.accent,
  },

  shareStrip: {
    flexDirection: 'row', alignItems: 'center', gap: s(8),
    margin: s(16), backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)',
    padding: s(12),
  },
  shareStripText: { flex: 1, fontFamily: Font.regular, fontSize: s(13), color: Colors.info },
  shareNowBtn: {
    backgroundColor: 'rgba(56,189,248,0.15)', borderRadius: Radius.sm,
    paddingHorizontal: s(12), paddingVertical: s(6),
  },
  shareNowText: { fontFamily: Font.bold, fontWeight: '700', fontSize: s(13), color: Colors.info },
});
