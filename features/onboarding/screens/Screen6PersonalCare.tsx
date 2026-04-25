import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import {
  SKIN_TYPES, SKIN_CONCERNS, SKIN_INGREDIENTS_TO_AVOID,
  HAIR_TYPES, HAIR_CONCERNS, HAIR_INGREDIENTS_TO_AVOID,
} from '../../../shared/onboardingConstants';
import type { OnboardingData } from '../../../shared/onboardingTypes';

interface Props {
  skinType: string;
  skinConcerns: string[];
  skinIngredientsToAvoid: string[];
  hairType: string;
  hairConcerns: string[];
  hairIngredientsToAvoid: string[];
  progress: number;
  onContinue: (data: Partial<OnboardingData>) => void;
  onBack: () => void;
  onSkip: () => void;
}

type Part = 1 | 2 | 3 | 4;

const PART_TITLES: Record<Part, string> = {
  1: 'What\'s your skin type?',
  2: 'Skin concerns',
  3: 'Skincare ingredients to avoid',
  4: 'Hair profile',
};

type OptionItem = { id: string; label: string; emoji?: string; concern_type?: string };

function RadioGrid({ options, value, onSelect }: { options: OptionItem[]; value: string; onSelect: (v: string) => void }) {
  return (
    <View style={styles.radioGrid}>
      {options.map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => onSelect(opt.id)}
          style={[styles.radioChip, value === opt.id && styles.radioChipOn]}
        >
          <View style={[styles.radioCircle, value === opt.id && styles.radioCircleOn]}>
            {value === opt.id && <View style={styles.radioDot} />}
          </View>
          <Text style={[styles.radioText, value === opt.id && styles.radioTextOn]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CheckGrid({ options, value, onToggle }: { options: OptionItem[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={styles.checkGrid}>
      {options.map((opt) => {
        const active = value.includes(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onToggle(opt.id)}
            style={[styles.checkChip, active && styles.checkChipOn]}
          >
            <Text style={[styles.checkText, active && styles.checkTextOn]} numberOfLines={2}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Screen6PersonalCare({
  skinType: initSkinType, skinConcerns: initSkinConcerns,
  skinIngredientsToAvoid: initSkinIngredients,
  hairType: initHairType, hairConcerns: initHairConcerns,
  hairIngredientsToAvoid: initHairIngredients,
  progress, onContinue, onBack, onSkip,
}: Props) {
  const [part, setPart] = useState<Part>(1);
  const [skinType, setSkinType] = useState(initSkinType);
  const [skinConcerns, setSkinConcerns] = useState<string[]>(initSkinConcerns);
  const [skinIngredients, setSkinIngredients] = useState<string[]>(initSkinIngredients);
  const [hairType, setHairType] = useState(initHairType);
  const [hairConcerns, setHairConcerns] = useState<string[]>(initHairConcerns);
  const [hairIngredients, setHairIngredients] = useState<string[]>(initHairIngredients);

  const toggleArr = (arr: string[], v: string, set: (a: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const handlePrimary = () => {
    if (part < 4) {
      setPart((p) => (p + 1) as Part);
    } else {
      onContinue({
        skinType,
        skinConcerns,
        skinIngredientsToAvoid: skinIngredients,
        hairType,
        hairConcerns,
        hairIngredientsToAvoid: hairIngredients,
      });
    }
  };

  const handleBack = () => {
    if (part > 1) {
      setPart((p) => (p - 1) as Part);
    } else {
      onBack();
    }
  };

  return (
    <OnboardingLayout
      title={PART_TITLES[part]}
      subtitle={`Part ${part} of 4`}
      progress={progress}
      onBack={handleBack}
      onPrimary={handlePrimary}
      primaryLabel={part < 4 ? 'Next' : 'Continue'}
      onSkip={onSkip}
    >
      {part === 1 && (
        <RadioGrid
          options={SKIN_TYPES}
          value={skinType}
          onSelect={setSkinType}
        />
      )}

      {part === 2 && (
        <CheckGrid
          options={SKIN_CONCERNS}
          value={skinConcerns}
          onToggle={(v) => toggleArr(skinConcerns, v, setSkinConcerns)}
        />
      )}

      {part === 3 && (
        <CheckGrid
          options={SKIN_INGREDIENTS_TO_AVOID}
          value={skinIngredients}
          onToggle={(v) => toggleArr(skinIngredients, v, setSkinIngredients)}
        />
      )}

      {part === 4 && (
        <View style={styles.hairSection}>
          <Text style={styles.partSubHeader}>Hair type</Text>
          <RadioGrid options={HAIR_TYPES} value={hairType} onSelect={setHairType} />

          <Text style={[styles.partSubHeader, { marginTop: Space.xl }]}>Hair concerns</Text>
          <CheckGrid
            options={HAIR_CONCERNS}
            value={hairConcerns}
            onToggle={(v) => toggleArr(hairConcerns, v, setHairConcerns)}
          />

          <Text style={[styles.partSubHeader, { marginTop: Space.xl }]}>Haircare ingredients to avoid</Text>
          <CheckGrid
            options={HAIR_INGREDIENTS_TO_AVOID}
            value={hairIngredients}
            onToggle={(v) => toggleArr(hairIngredients, v, setHairIngredients)}
          />
        </View>
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  radioGrid: {
    gap: Space.sm,
  },
  radioChip: {
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
  radioChipOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.08)',
  },
  radioCircle: {
    width: s(20),
    height: s(20),
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.textFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleOn: {
    borderColor: Colors.accent,
  },
  radioDot: {
    width: s(10),
    height: s(10),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
  },
  radioText: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textOffWhite,
  },
  radioTextOn: {
    fontFamily: Font.medium,
    color: Colors.textWhite,
  },
  checkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  checkChip: {
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
  checkChipOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.12)',
  },
  checkText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textOffWhite,
    textAlign: 'center',
    lineHeight: s(17),
  },
  checkTextOn: {
    fontFamily: Font.medium,
    color: Colors.textWhite,
  },
  hairSection: {
    gap: 0,
  },
  partSubHeader: {
    fontFamily: Font.bold,
    fontSize: s(15),
    color: Colors.textWhite,
    marginBottom: Space.md,
  },
});
