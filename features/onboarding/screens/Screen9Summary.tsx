import React from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import { HEALTH_CONDITIONS } from '../../../shared/onboardingConstants';
import type { OnboardingData } from '../../../shared/onboardingTypes';

interface Props {
  data: OnboardingData;
  onEditProfile: () => void;
  onLetsGo: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '🥦 Food & Grocery',
  personalCare: '🧴 Personal Care',
  household: '🏠 Household',
};

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isEmpty = !value || value === 'Not specified';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, isEmpty && styles.rowValueEmpty]}>{value || 'Not specified'}</Text>
    </View>
  );
}

function Tags({ items, empty = 'Not specified' }: { items: string[]; empty?: string }) {
  if (!items || items.length === 0) {
    return <Text style={styles.rowValueEmpty}>{empty}</Text>;
  }
  return (
    <View style={styles.tags}>
      {items.map((item) => (
        <View key={item} style={styles.tag}>
          <Text style={styles.tagText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function conditionLabel(id: string) {
  return HEALTH_CONDITIONS.find((c) => c.id === id)?.label ?? id;
}

export default function Screen9Summary({ data, onEditProfile, onLetsGo }: Props) {
  const insets = useSafeAreaInsets();

  const foodAllergyNames = data.foodAllergies.map(
    (a) => `${a.name} (${a.severity})`
  );
  const intoleranceNames = data.foodIntolerances
    .filter((i) => i.type !== 'none')
    .map((i) => i.subPreference ? `${i.type}: ${i.subPreference}` : i.type);
  const hasFood = data.categories.includes('food');
  const hasPC = data.categories.includes('personalCare');
  const hasHH = data.categories.includes('household');

  return (
    <View style={[styles.root, { paddingTop: insets.top || (Platform.OS === 'android' ? 24 : 20) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>aware</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>You're all set!</Text>
          <Text style={styles.heroSub}>Here's your personalized profile. You can always edit this in Settings.</Text>
        </View>

        {/* Categories */}
        <SummaryCard title="Scanning categories">
          <Tags items={data.categories.map((c) => CATEGORY_LABELS[c] ?? c)} />
        </SummaryCard>

        {/* Health Conditions */}
        <SummaryCard title="Health conditions">
          <Tags
            items={data.healthConditions.filter((c) => c !== 'none' && c !== 'prefer_not_to_say').map(conditionLabel)}
          />
        </SummaryCard>

        {/* Food section */}
        {hasFood && (
          <>
            <SummaryCard title="Food allergies">
              <Tags items={foodAllergyNames} />
            </SummaryCard>
            <SummaryCard title="Food intolerances">
              <Tags items={intoleranceNames} />
            </SummaryCard>
            <SummaryCard title="Dietary patterns">
              <Tags items={data.dietaryPatterns} />
              {data.dietStrictness ? (
                <Text style={styles.note}>Strictness: {data.dietStrictness}</Text>
              ) : null}
            </SummaryCard>
            <SummaryCard title="Supplement avoids">
              <Tags items={data.supplementAvoids} />
            </SummaryCard>
          </>
        )}

        {/* Personal Care */}
        {hasPC && (
          <>
            <SummaryCard title="Skin allergens">
              <Tags items={data.skinAllergens} />
            </SummaryCard>
            <SummaryCard title="Personal care profile">
              <Row label="Skin type" value={data.skinType} />
              <Row label="Hair type" value={data.hairType} />
              <View style={styles.divider} />
              <Text style={styles.subLabel}>Skin concerns</Text>
              <Tags items={data.skinConcerns} />
              <Text style={[styles.subLabel, { marginTop: Space.sm }]}>Skin ingredients to avoid</Text>
              <Tags items={data.skinIngredientsToAvoid} />
              <Text style={[styles.subLabel, { marginTop: Space.sm }]}>Hair concerns</Text>
              <Tags items={data.hairConcerns} />
            </SummaryCard>
          </>
        )}

        {/* Household */}
        {hasHH && (
          <SummaryCard title="Household concerns">
            <Tags items={data.householdReasons} />
            <Text style={[styles.subLabel, { marginTop: Space.sm }]}>Ingredients of concern</Text>
            <Tags items={data.householdIngredients} />
          </SummaryCard>
        )}

        <View style={{ height: s(160) }} />
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Space.base }]}>
        <Pressable onPress={onEditProfile} style={styles.editBtn}>
          <Text style={styles.editText}>Edit Profile</Text>
        </Pressable>
        <Pressable onPress={onLetsGo} style={styles.goBtn}>
          <Text style={styles.goText}>Let's go! 🚀</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvasDark,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  logoText: {
    fontFamily: Font.bold,
    fontSize: s(18),
    color: Colors.accent,
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: Space.xxl,
    paddingHorizontal: Space.xl,
  },
  heroEmoji: {
    fontSize: s(48),
    marginBottom: Space.md,
  },
  heroTitle: {
    fontFamily: Font.bold,
    fontSize: s(28),
    color: Colors.textWhite,
    marginBottom: Space.sm,
  },
  heroSub: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: s(21),
  },
  card: {
    marginHorizontal: Space.base,
    marginBottom: Space.md,
    padding: Space.base,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontFamily: Font.bold,
    fontSize: s(13),
    color: Colors.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Space.xs,
  },
  rowLabel: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
  },
  rowValue: {
    fontFamily: Font.medium,
    fontSize: s(13),
    color: Colors.textWhite,
    maxWidth: '60%',
    textAlign: 'right',
  },
  rowValueEmpty: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textFaint,
    fontStyle: 'italic',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
  tag: {
    backgroundColor: 'rgba(139,197,61,0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: s(4),
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.25)',
  },
  tagText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.accent,
  },
  note: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
    marginTop: Space.sm,
    fontStyle: 'italic',
  },
  subLabel: {
    fontFamily: Font.bold,
    fontSize: s(12),
    color: Colors.textMuted,
    marginBottom: Space.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Space.sm,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.base,
    paddingTop: Space.base,
    backgroundColor: Colors.canvasDark,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Space.sm,
  },
  editBtn: {
    paddingVertical: Space.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editText: {
    fontFamily: Font.medium,
    fontSize: s(15),
    color: Colors.textOffWhite,
  },
  goBtn: {
    paddingVertical: Space.base,
    borderRadius: Radius.pill,
    alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  goText: {
    fontFamily: Font.bold,
    fontSize: s(16),
    color: Colors.canvasDark,
  },
});
