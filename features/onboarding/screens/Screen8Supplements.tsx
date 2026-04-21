import React, { useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import { SUPPLEMENT_AVOIDS } from '../../../shared/onboardingConstants';

interface Props {
  value: string[];
  progress: number;
  onContinue: (v: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function Screen8Supplements({ value, progress, onContinue, onBack, onSkip }: Props) {
  const [selected, setSelected] = useState<string[]>(value);

  const toggle = (opt: string) => {
    setSelected((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  };

  return (
    <OnboardingLayout
      title="Supplement ingredients to avoid"
      subtitle="We'll flag supplements that contain these. Select all that apply."
      progress={progress}
      onBack={onBack}
      onPrimary={() => onContinue(selected)}
      onSkip={onSkip}
    >
      <View style={styles.list}>
        {SUPPLEMENT_AVOIDS.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggle(opt)}
              style={[styles.row, active && styles.rowOn]}
            >
              <View style={[styles.check, active && styles.checkOn]}>
                {active && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.label, active && styles.labelOn]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Space.sm,
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
  },
  rowOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.08)',
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
});
