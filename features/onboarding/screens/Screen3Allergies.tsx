import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Switch, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import { FOOD_ALLERGENS, SKIN_ALLERGENS } from '../../../shared/onboardingConstants';
import type { FoodAllergyEntry, AllergySeverity, OnboardingData } from '../../../shared/onboardingTypes';

type Variant = 'food' | 'personal' | 'both';

interface Props {
  variant: Variant;
  foodAllergies: FoodAllergyEntry[];
  foodAllergyTraces: boolean;
  foodAllergyOther: string;
  skinAllergens: string[];
  skinAllergenTraces: boolean;
  skinAllergenOther: string;
  progress: number;
  onContinue: (data: Partial<OnboardingData>) => void;
  onBack: () => void;
  onSkip: () => void;
}

const SEVERITIES: { id: AllergySeverity; label: string }[] = [
  { id: 'mild', label: 'Mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'severe', label: 'Severe' },
];

function FoodSection({
  allergies,
  traces,
  other,
  onAllergiesChange,
  onTracesChange,
  onOtherChange,
}: {
  allergies: FoodAllergyEntry[];
  traces: boolean;
  other: string;
  onAllergiesChange: (a: FoodAllergyEntry[]) => void;
  onTracesChange: (v: boolean) => void;
  onOtherChange: (v: string) => void;
}) {
  const toggleFood = (name: string) => {
    const exists = allergies.find((a) => a.name === name);
    if (exists) {
      onAllergiesChange(allergies.filter((a) => a.name !== name));
    } else {
      onAllergiesChange([...allergies, { name, severity: 'moderate' }]);
    }
  };

  const setSeverity = (name: string, severity: AllergySeverity) => {
    onAllergiesChange(allergies.map((a) => (a.name === name ? { ...a, severity } : a)));
  };

  return (
    <View>
      <Text style={styles.sectionHeader}>🍽 Food allergies</Text>
      {FOOD_ALLERGENS.map((name) => {
        const entry = allergies.find((a) => a.name === name);
        const active = !!entry;
        const isOther = name === 'Other';
        return (
          <View key={name}>
            <Pressable
              onPress={() => toggleFood(name)}
              style={[styles.row, active && styles.rowOn]}
            >
              <View style={[styles.check, active && styles.checkOn]}>
                {active && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.label, active && styles.labelOn]}>{name}</Text>
            </Pressable>
            {active && !isOther && (
              <View style={styles.severityRow}>
                {SEVERITIES.map((sv) => (
                  <Pressable
                    key={sv.id}
                    onPress={() => setSeverity(name, sv.id)}
                    style={[styles.svChip, entry?.severity === sv.id && styles.svChipOn]}
                  >
                    <Text style={[styles.svText, entry?.severity === sv.id && styles.svTextOn]}>
                      {sv.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {active && isOther && (
              <TextInput
                style={styles.otherInput}
                placeholder="Specify allergen…"
                placeholderTextColor={Colors.textFaint}
                value={other}
                onChangeText={onOtherChange}
              />
            )}
          </View>
        );
      })}
      <View style={styles.traceRow}>
        <Text style={styles.traceLabel}>Warn me about "May contain" traces</Text>
        <Switch
          value={traces}
          onValueChange={onTracesChange}
          trackColor={{ false: Colors.border, true: Colors.accent }}
          thumbColor={Colors.textWhite}
        />
      </View>
    </View>
  );
}

function SkinSection({
  selected,
  traces,
  other,
  onSelectedChange,
  onTracesChange,
  onOtherChange,
}: {
  selected: string[];
  traces: boolean;
  other: string;
  onSelectedChange: (v: string[]) => void;
  onTracesChange: (v: boolean) => void;
  onOtherChange: (v: string) => void;
}) {
  const toggle = (name: string) => {
    onSelectedChange(
      selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name]
    );
  };

  return (
    <View>
      <Text style={styles.sectionHeader}>🧴 Skin-reacting ingredients</Text>
      <Text style={styles.sectionSub}>Check any that cause skin reactions — contact allergies or sensitivities</Text>
      {SKIN_ALLERGENS.map((name) => {
        const active = selected.includes(name);
        const isOther = name === 'Other';
        return (
          <View key={name}>
            <Pressable
              onPress={() => toggle(name)}
              style={[styles.row, active && styles.rowOn]}
            >
              <View style={[styles.check, active && styles.checkOn]}>
                {active && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.label, active && styles.labelOn]}>{name}</Text>
            </Pressable>
            {active && isOther && (
              <TextInput
                style={styles.otherInput}
                placeholder="Specify ingredient…"
                placeholderTextColor={Colors.textFaint}
                value={other}
                onChangeText={onOtherChange}
              />
            )}
          </View>
        );
      })}
      <View style={styles.traceRow}>
        <Text style={styles.traceLabel}>Flag products with 'may contain traces' of my triggers</Text>
        <Switch
          value={traces}
          onValueChange={onTracesChange}
          trackColor={{ false: Colors.border, true: Colors.accent }}
          thumbColor={Colors.textWhite}
        />
      </View>
    </View>
  );
}

export default function Screen3Allergies({
  variant,
  foodAllergies,
  foodAllergyTraces,
  foodAllergyOther,
  skinAllergens,
  skinAllergenTraces,
  skinAllergenOther,
  progress,
  onContinue,
  onBack,
  onSkip,
}: Props) {
  const [fa, setFa] = useState<FoodAllergyEntry[]>(foodAllergies);
  const [fat, setFat] = useState(foodAllergyTraces);
  const [fao, setFao] = useState(foodAllergyOther);
  const [sa, setSa] = useState<string[]>(skinAllergens);
  const [sat, setSat] = useState(skinAllergenTraces);
  const [sao, setSao] = useState(skinAllergenOther);

  const title = variant === 'food'
    ? 'Do you have any food allergies?'
    : variant === 'personal'
    ? 'Which ingredients do you react to?'
    : 'Allergies & skin reactions';

  const handleContinue = () => {
    onContinue({
      foodAllergies: fa,
      foodAllergyTraces: fat,
      foodAllergyOther: fao,
      skinAllergens: sa,
      skinAllergenTraces: sat,
      skinAllergenOther: sao,
    });
  };

  return (
    <OnboardingLayout
      title={title}
      progress={progress}
      onBack={onBack}
      onPrimary={handleContinue}
      onSkip={onSkip}
    >
      {(variant === 'food' || variant === 'both') && (
        <FoodSection
          allergies={fa}
          traces={fat}
          other={fao}
          onAllergiesChange={setFa}
          onTracesChange={setFat}
          onOtherChange={setFao}
        />
      )}
      {variant === 'both' && <View style={styles.divider} />}
      {(variant === 'personal' || variant === 'both') && (
        <SkinSection
          selected={sa}
          traces={sat}
          other={sao}
          onSelectedChange={setSa}
          onTracesChange={setSat}
          onOtherChange={setSao}
        />
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontFamily: Font.bold,
    fontSize: s(16),
    color: Colors.textWhite,
    marginBottom: Space.sm,
    marginTop: Space.sm,
  },
  sectionSub: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
    marginBottom: Space.md,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: Space.xs,
  },
  rowOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.08)',
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  check: {
    width: s(22),
    height: s(22),
    borderRadius: Radius.xs,
    borderWidth: 1.5,
    borderColor: Colors.textFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  checkMark: {
    fontSize: s(12),
    color: Colors.canvasDark,
    fontFamily: Font.bold,
  },
  label: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textOffWhite,
    flex: 1,
  },
  labelOn: {
    fontFamily: Font.medium,
    color: Colors.textWhite,
  },
  severityRow: {
    flexDirection: 'row',
    gap: Space.sm,
    padding: Space.md,
    backgroundColor: 'rgba(139,197,61,0.05)',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.accent,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    marginBottom: Space.xs,
  },
  svChip: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  svChipOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.20)',
  },
  svText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
  },
  svTextOn: {
    color: Colors.accent,
    fontFamily: Font.medium,
  },
  otherInput: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.accent,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textWhite,
    backgroundColor: 'rgba(139,197,61,0.05)',
    marginBottom: Space.xs,
  },
  traceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    marginTop: Space.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  traceLabel: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textOffWhite,
    flex: 1,
    marginRight: Space.md,
    lineHeight: s(19),
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Space.xl,
  },
});
