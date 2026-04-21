import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import { HOUSEHOLD_REASONS, HOUSEHOLD_INGREDIENTS } from '../../../shared/onboardingConstants';

interface Props {
  reasons: string[];
  ingredients: string[];
  progress: number;
  onContinue: (reasons: string[], ingredients: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

function MultiSelectList({ options, value, onToggle, title }: {
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  title: string;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.list}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => onToggle(opt)}
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
    </View>
  );
}

export default function Screen7Household({
  reasons: initReasons,
  ingredients: initIngredients,
  progress, onContinue, onBack, onSkip,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reasons, setReasons] = useState<string[]>(initReasons);
  const [ingredients, setIngredients] = useState<string[]>(initIngredients);

  const toggleReason = (v: string) =>
    setReasons((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const toggleIngredient = (v: string) =>
    setIngredients((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const handlePrimary = () => {
    if (step === 1) {
      setStep(2);
    } else {
      onContinue(reasons, ingredients);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      onBack();
    }
  };

  return (
    <OnboardingLayout
      title="Household products"
      subtitle={`Step ${step} of 2`}
      progress={progress}
      onBack={handleBack}
      onPrimary={handlePrimary}
      primaryLabel={step === 1 ? 'Next' : 'Continue'}
      onSkip={onSkip}
    >
      {step === 1 && (
        <MultiSelectList
          title="Why do you want transparency in household products?"
          options={HOUSEHOLD_REASONS}
          value={reasons}
          onToggle={toggleReason}
        />
      )}
      {step === 2 && (
        <MultiSelectList
          title="Which ingredients are you most concerned about?"
          options={HOUSEHOLD_INGREDIENTS}
          value={ingredients}
          onToggle={toggleIngredient}
        />
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: Font.bold,
    fontSize: s(15),
    color: Colors.textWhite,
    marginBottom: Space.md,
    lineHeight: s(22),
  },
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
