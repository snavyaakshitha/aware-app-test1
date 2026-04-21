import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import { FOOD_INTOLERANCES } from '../../../shared/onboardingConstants';
import type { FoodIntoleranceEntry } from '../../../shared/onboardingTypes';

interface Props {
  value: FoodIntoleranceEntry[];
  progress: number;
  onContinue: (v: FoodIntoleranceEntry[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function Screen4Intolerances({ value, progress, onContinue, onBack, onSkip }: Props) {
  const [selected, setSelected] = useState<FoodIntoleranceEntry[]>(value);

  const toggleItem = (id: string) => {
    if (id === 'none') {
      setSelected([{ type: 'none', subPreference: '' }]);
      return;
    }
    const exists = selected.find((s) => s.type === id);
    const without = selected.filter((s) => s.type !== 'none');
    if (exists) {
      setSelected(without.filter((s) => s.type !== id));
    } else {
      setSelected([...without, { type: id, subPreference: '' }]);
    }
  };

  const setSubPref = (id: string, sub: string) => {
    setSelected((prev) =>
      prev.map((item) => (item.type === id ? { ...item, subPreference: sub } : item))
    );
  };

  const isSelected = (id: string) => selected.some((s) => s.type === id);

  return (
    <OnboardingLayout
      title="Food intolerances & sensitivities"
      subtitle="Do you have any food intolerances or sensitivities?"
      progress={progress}
      onBack={onBack}
      onPrimary={() => onContinue(selected)}
      onSkip={onSkip}
    >
      <View style={styles.list}>
        {FOOD_INTOLERANCES.map((option) => {
          const active = isSelected(option.id);
          const entry = selected.find((s) => s.type === option.id);
          return (
            <View key={option.id}>
              <Pressable
                onPress={() => toggleItem(option.id)}
                style={[styles.row, active && styles.rowOn]}
              >
                <View style={[styles.check, active && styles.checkOn]}>
                  {active && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.label, active && styles.labelOn]}>{option.label}</Text>
              </Pressable>

              {active && option.subOptions && (
                <View style={styles.subPanel}>
                  {option.subOptions.map((sub) => (
                    <Pressable
                      key={sub.id}
                      onPress={() => setSubPref(option.id, sub.id)}
                      style={styles.subRow}
                    >
                      <View style={[styles.radio, entry?.subPreference === sub.id && styles.radioOn]}>
                        {entry?.subPreference === sub.id && <View style={styles.radioDot} />}
                      </View>
                      <Text style={[styles.subLabel, entry?.subPreference === sub.id && styles.subLabelOn]}>
                        {sub.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Space.xs,
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
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
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
  subPanel: {
    backgroundColor: 'rgba(139,197,61,0.05)',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.accent,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingHorizontal: Space.base,
    paddingVertical: Space.sm,
    gap: Space.sm,
    marginBottom: Space.xs,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.sm,
  },
  radio: {
    width: s(20),
    height: s(20),
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.textFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOn: {
    borderColor: Colors.accent,
  },
  radioDot: {
    width: s(10),
    height: s(10),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
  },
  subLabel: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    flex: 1,
  },
  subLabelOn: {
    color: Colors.accent,
    fontFamily: Font.medium,
  },
});
