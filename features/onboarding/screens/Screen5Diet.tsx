import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import { DIET_PATTERN_ROWS, DIET_NON_SPECIFIC } from '../../../shared/onboardingConstants';

interface Props {
  patterns: string[];
  strictness: 'strict' | 'moderate' | 'flexible' | '';
  progress: number;
  onContinue: (patterns: string[], strictness: 'strict' | 'moderate' | 'flexible' | '') => void;
  onBack: () => void;
  onSkip: () => void;
}

const STRICTNESS: { id: 'strict' | 'moderate' | 'flexible'; label: string; desc: string }[] = [
  { id: 'strict', label: 'Strict', desc: 'I follow it 100%' },
  { id: 'moderate', label: 'Moderate', desc: 'Most of the time' },
  { id: 'flexible', label: 'Flexible', desc: 'I do my best' },
];

export default function Screen5Diet({ patterns, strictness, progress, onContinue, onBack, onSkip }: Props) {
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(patterns);
  const [selectedStrictness, setSelectedStrictness] = useState<'strict' | 'moderate' | 'flexible' | ''>(strictness);

  const toggle = (id: string) => {
    if (DIET_NON_SPECIFIC.includes(id)) {
      setSelectedPatterns([id]);
      setSelectedStrictness('');
      return;
    }
    setSelectedPatterns((prev) => {
      const withoutNonSpecific = prev.filter((x) => !DIET_NON_SPECIFIC.includes(x));
      return withoutNonSpecific.includes(id)
        ? withoutNonSpecific.filter((x) => x !== id)
        : [...withoutNonSpecific, id];
    });
  };

  const hasSpecific = selectedPatterns.some((p) => !DIET_NON_SPECIFIC.includes(p));

  return (
    <OnboardingLayout
      title="Dietary pattern"
      subtitle="Do you follow any dietary pattern? Select all that apply."
      progress={progress}
      onBack={onBack}
      onPrimary={() => onContinue(selectedPatterns, hasSpecific ? selectedStrictness : '')}
      onSkip={onSkip}
    >
      <View style={styles.grid}>
        {DIET_PATTERN_ROWS.map((row) => {
          const active = selectedPatterns.includes(row.id);
          return (
            <Pressable
              key={row.id}
              onPress={() => toggle(row.id)}
              style={[styles.chip, active && styles.chipOn]}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]} numberOfLines={2}>
                {row.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hasSpecific && (
        <View style={styles.strictSection}>
          <Text style={styles.strictTitle}>How strict are you?</Text>
          <View style={styles.strictRow}>
            {STRICTNESS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setSelectedStrictness(opt.id)}
                style={[styles.strictCard, selectedStrictness === opt.id && styles.strictCardOn]}
              >
                <Text style={[styles.strictLabel, selectedStrictness === opt.id && styles.strictLabelOn]}>
                  {opt.label}
                </Text>
                <Text style={[styles.strictDesc, selectedStrictness === opt.id && styles.strictDescOn]}>
                  {opt.desc}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  chip: {
    width: '47%',
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    minHeight: s(52),
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.12)',
  },
  chipText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textOffWhite,
    textAlign: 'center',
    lineHeight: s(18),
  },
  chipTextOn: {
    fontFamily: Font.medium,
    color: Colors.textWhite,
  },
  strictSection: {
    marginTop: Space.xl,
  },
  strictTitle: {
    fontFamily: Font.bold,
    fontSize: s(16),
    color: Colors.textWhite,
    marginBottom: Space.md,
  },
  strictRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  strictCard: {
    flex: 1,
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  strictCardOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.12)',
  },
  strictLabel: {
    fontFamily: Font.bold,
    fontSize: s(13),
    color: Colors.textMuted,
    marginBottom: s(2),
  },
  strictLabelOn: {
    color: Colors.accent,
  },
  strictDesc: {
    fontFamily: Font.regular,
    fontSize: s(11),
    color: Colors.textFaint,
    textAlign: 'center',
  },
  strictDescOn: {
    color: Colors.textMuted,
  },
});
