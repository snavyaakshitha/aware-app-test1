/**
 * Aware — Edit Preferences Screen
 * Lets users update their health profile post-onboarding.
 * Same UI language as QuestionnaireScreen but in a settings context.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, s, Radius } from '../../../shared/theme';
import {
  HEALTH_CONDITION_OPTIONS,
  ALLERGEN_OPTIONS,
  DIET_OPTIONS,
  INGREDIENT_AVOID_OPTIONS,
} from '../../../shared/mockData';
import type { ProfileStackParamList } from '../../../shared/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditPreferences'>;

// Mock currently selected
const INITIAL = {
  conditions: ['pcos', 'hypothyroidism'],
  allergens: ['gluten', 'dairy'],
  diets: ['gluten_free', 'dairy_free', 'anti_inflammatory'],
  avoids: ['seed_oils', 'hfcs', 'artificial_dyes', 'carrageenan'],
};

function ChipGrid<T extends { id: string; label: string; emoji?: string }>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: T[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={cgStyles.section}>
      <Pressable onPress={() => setExpanded(v => !v)} style={cgStyles.header}>
        <Text style={cgStyles.title}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <View style={cgStyles.countBadge}>
            <Text style={cgStyles.countText}>{selected.length}</Text>
          </View>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={s(18)} color={Colors.textMuted} />
        </View>
      </Pressable>
      {expanded && (
        <View style={cgStyles.grid}>
          {options.map(opt => {
            const active = selected.includes(opt.id);
            return (
              <Pressable
                key={opt.id}
                onPress={() => onToggle(opt.id)}
                style={[cgStyles.chip, active && cgStyles.chipActive]}
              >
                {opt.emoji && <Text style={{ fontSize: s(14) }}>{opt.emoji}</Text>}
                <Text style={[cgStyles.chipLabel, active && cgStyles.chipLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const cgStyles = StyleSheet.create({
  section: {
    marginBottom: s(4),
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(14),
  },
  title: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(16),
    color: Colors.textWhite,
  },
  countBadge: {
    backgroundColor: 'rgba(139,197,61,0.15)',
    borderRadius: Radius.pill,
    paddingHorizontal: s(8),
    paddingVertical: s(2),
  },
  countText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(12),
    color: Colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
    paddingBottom: s(14),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingHorizontal: s(12),
    paddingVertical: s(7),
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  chipLabel: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textOffWhite,
  },
  chipLabelActive: {
    color: Colors.textDark,
    fontWeight: '600',
  },
});

export default function EditPreferencesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [conditions, setConditions] = useState(INITIAL.conditions);
  const [allergens, setAllergens] = useState(INITIAL.allergens);
  const [diets, setDiets] = useState(INITIAL.diets);
  const [avoids, setAvoids] = useState(INITIAL.avoids);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <View style={styles.root}>
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={s(24)} color={Colors.textWhite} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Preferences</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Changes here will instantly update your product recommendations and clean scores.
        </Text>

        <ChipGrid
          title="Health Conditions"
          options={HEALTH_CONDITION_OPTIONS}
          selected={conditions}
          onToggle={toggle(setConditions)}
        />
        <ChipGrid
          title="Allergens"
          options={ALLERGEN_OPTIONS}
          selected={allergens}
          onToggle={toggle(setAllergens)}
        />
        <ChipGrid
          title="Diet Preferences"
          options={DIET_OPTIONS}
          selected={diets}
          onToggle={toggle(setDiets)}
        />
        <ChipGrid
          title="Ingredients to Avoid"
          options={INGREDIENT_AVOID_OPTIONS}
          selected={avoids}
          onToggle={toggle(setAvoids)}
        />

        <Pressable onPress={() => navigation.goBack()} style={styles.saveFullBtn}>
          <Feather name="check" size={s(18)} color={Colors.textDark} />
          <Text style={styles.saveFullBtnText}>Save Changes</Text>
        </Pressable>
      </ScrollView>
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
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: Font.bold, fontWeight: '700', fontSize: s(18), color: Colors.textWhite,
  },
  saveBtn: {
    paddingHorizontal: s(12), paddingVertical: s(8),
    backgroundColor: Colors.accent, borderRadius: Radius.md,
  },
  saveBtnText: {
    fontFamily: Font.bold, fontWeight: '700', fontSize: s(14), color: Colors.textDark,
  },
  subtitle: {
    fontFamily: Font.regular, fontSize: s(14), color: Colors.textMuted,
    lineHeight: s(21), marginBottom: s(20), marginTop: s(4),
  },
  saveFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: s(8), backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: s(14), marginTop: s(24),
  },
  saveFullBtnText: {
    fontFamily: Font.bold, fontWeight: '700', fontSize: s(16), color: Colors.textDark,
  },
});
