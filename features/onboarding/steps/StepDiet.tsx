import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, s, Radius } from '../../../shared/theme';
import { DIET_PATTERN_ROWS } from '../../../shared/onboardingConstants';
import type { DietaryBlock, DietPatternId } from '../../../shared/onboardingTypes';

type Props = {
  value: DietaryBlock;
  onChange: (v: DietaryBlock) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
};

const SPECIFIC: DietPatternId[] = ['pescatarian', 'vegetarian', 'vegan', 'paleo', 'keto', 'mediterranean', 'whole30', 'clean_eating'];

export default function StepDiet({ value, onChange, onContinue, onBack, onSkip }: Props) {
  const patterns = value.patterns ?? [];

  const toggle = (id: DietPatternId) => {
    let next = patterns.includes(id) ? patterns.filter((x) => x !== id) : [...patterns, id];
    if (id === 'omnivore' || id === 'no_specific') {
      next = [id];
    } else {
      next = next.filter((x) => x !== 'omnivore' && x !== 'no_specific');
    }
    onChange({ ...value, patterns: next });
  };

  const hasSpecific = patterns.some((p) => SPECIFIC.includes(p));

  return (
    <OnboardingLayout
      title="Dietary pattern"
      subtitle="Do you follow any dietary pattern?"
      onBack={onBack}
      onPrimary={onContinue}
      showSkip
      onSkip={onSkip}
    >
      <View style={styles.grid}>
        {DIET_PATTERN_ROWS.map((row) => {
          const active = patterns.includes(row.id);
          return (
            <Pressable
              key={row.id}
              onPress={() => toggle(row.id)}
              style={[styles.chip, active && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtOn]} numberOfLines={2}>
                {row.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hasSpecific ? (
        <>
          <Text style={styles.q}>How strict are you?</Text>
          <View style={styles.strictRow}>
            {(['strict', 'moderate', 'flexible'] as const).map((sopt) => (
              <Pressable
                key={sopt}
                onPress={() => onChange({ ...value, strictness: sopt })}
                style={[styles.strictChip, value.strictness === sopt && styles.strictChipOn]}
              >
                <Text style={[styles.strictTxt, value.strictness === sopt && styles.strictTxtOn]}>
                  {sopt.charAt(0).toUpperCase() + sopt.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(10),
    marginBottom: s(16),
  },
  chip: {
    width: '47%',
    padding: s(12),
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    minHeight: s(56),
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.12)',
  },
  chipTxt: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textOffWhite,
    textAlign: 'center',
  },
  chipTxtOn: { color: Colors.textWhite, fontFamily: Font.medium },
  q: {
    fontFamily: Font.bold,
    fontSize: s(16),
    color: Colors.textWhite,
    marginBottom: s(10),
  },
  strictRow: { flexDirection: 'row', gap: s(8), flexWrap: 'wrap' },
  strictChip: {
    paddingHorizontal: s(16),
    paddingVertical: s(10),
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  strictChipOn: { borderColor: Colors.accent, backgroundColor: 'rgba(139,197,61,0.15)' },
  strictTxt: { fontFamily: Font.medium, fontSize: s(14), color: Colors.textMuted },
  strictTxtOn: { color: Colors.accent },
});
