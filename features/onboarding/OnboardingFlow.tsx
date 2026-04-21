import React, { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Category, OnboardingData, StepId } from '../../shared/onboardingTypes';
import { EMPTY_ONBOARDING } from '../../shared/onboardingTypes';
import {
  upsertUserPreferences,
  isSupabaseConfigured,
} from '../../shared/supabase';

import Screen1Categories from './screens/Screen1Categories';
import Screen2HealthConditions from './screens/Screen2HealthConditions';
import Screen3Allergies from './screens/Screen3Allergies';
import Screen4Intolerances from './screens/Screen4Intolerances';
import Screen5Diet from './screens/Screen5Diet';
import Screen6PersonalCare from './screens/Screen6PersonalCare';
import Screen7Household from './screens/Screen7Household';
import Screen8Supplements from './screens/Screen8Supplements';
import Screen9Summary from './screens/Screen9Summary';
import type { FoodIntoleranceEntry } from '../../shared/onboardingTypes';

// ─── Step Sequence ────────────────────────────────────────────────────────────
function buildSteps(categories: Category[]): StepId[] {
  const hasFood = categories.includes('food');
  const hasPC = categories.includes('personalCare');
  const hasHH = categories.includes('household');

  const steps: StepId[] = ['S1', 'S2'];

  if (hasFood && hasPC) steps.push('S3BOTH');
  else if (hasFood) steps.push('S3F');
  else if (hasPC) steps.push('S3P');

  if (hasFood) {
    steps.push('S4');
    steps.push('S5');
    steps.push('S8');
  }
  if (hasPC) steps.push('S6');
  if (hasHH) steps.push('S7');

  steps.push('S9');
  return steps;
}

// Auto-populate Screen6 based on health conditions
function applyHealthConditionPrepopulation(data: OnboardingData): OnboardingData {
  const conditions = data.healthConditions;
  const addConcerns: string[] = [];
  const addIngredients: string[] = [];

  if (conditions.includes('eczema')) {
    addConcerns.push('Eczema / Dermatitis');
    addIngredients.push('Fragrance / Parfum', 'SLS');
  }
  if (conditions.includes('psoriasis')) {
    addConcerns.push('Psoriasis');
  }
  if (conditions.includes('pcos')) {
    addIngredients.push('Parabens', 'Phthalates');
  }

  return {
    ...data,
    skinConcerns: [...new Set([...data.skinConcerns, ...addConcerns])],
    skinIngredientsToAvoid: [...new Set([...data.skinIngredientsToAvoid, ...addIngredients])],
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  userId: string | null;
  onComplete: () => void;
}

export default function OnboardingFlow({ userId, onComplete }: Props) {
  const [steps, setSteps] = useState<StepId[]>(['S1', 'S9']);
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<OnboardingData>(EMPTY_ONBOARDING);

  const currentStep = steps[stepIdx];
  const progress = (stepIdx + 1) / steps.length;

  const goNext = useCallback(() => {
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const goBack = useCallback(() => {
    setStepIdx((i) => Math.max(i - 1, 0));
  }, []);

  const mergeData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  // Finish onboarding: persist data then go to main app
  const finishOnboarding = useCallback(async (finalData: OnboardingData) => {
    try {
      await AsyncStorage.setItem('@aware_onboarding_complete', 'true');
      await AsyncStorage.setItem('@aware_onboarding_data', JSON.stringify(finalData));
    } catch (_) { /* storage failure is non-fatal */ }

    // Save to Supabase what fits the existing schema
    if (isSupabaseConfigured && userId) {
      try {
        const conditionMap: Record<string, string> = {
          pcos: 'pcos', hypothyroidism: 'hypothyroidism', celiac: 'celiac',
          ibs: 'ibs', ibd: 'crohns', gerd: 'gerd', diabetes_t2: 'diabetes_t2',
          high_cholesterol: 'high_cholesterol', eczema: 'eczema', psoriasis: 'psoriasis',
          acne: 'acne', migraines: 'migraines',
        };
        const allergenMap: Record<string, string> = {
          'Milk / Dairy': 'dairy', 'Eggs': 'eggs', 'Fish': 'fish',
          'Shellfish': 'shellfish', 'Tree Nuts': 'tree_nuts', 'Peanuts': 'peanuts',
          'Wheat': 'wheat', 'Soybeans': 'soy', 'Sesame': 'sesame',
        };
        const dietMap: Record<string, string> = {
          vegan: 'vegan', vegetarian: 'vegetarian', pescatarian: 'pescatarian',
          keto: 'keto', paleo: 'paleo', mediterranean: 'mediterranean', whole30: 'whole30',
        };
        await upsertUserPreferences(userId, {
          healthConditions: finalData.healthConditions
            .map((c) => conditionMap[c])
            .filter(Boolean) as any,
          allergens: finalData.foodAllergies
            .map((a) => allergenMap[a.name])
            .filter(Boolean) as any,
          diets: finalData.dietaryPatterns
            .map((d) => dietMap[d])
            .filter(Boolean) as any,
          onboardingComplete: true,
        });
      } catch (_) { /* Supabase failure is non-fatal */ }
    }

    onComplete();
  }, [userId, onComplete]);

  // ── Screen renderers ────────────────────────────────────────────────────────

  if (currentStep === 'S1') {
    return (
      <Screen1Categories
        value={data.categories}
        progress={progress}
        onContinue={(categories) => {
          mergeData({ categories });
          const newSteps = buildSteps(categories);
          setSteps(newSteps);
          setStepIdx(1); // advance to S2
        }}
      />
    );
  }

  if (currentStep === 'S2') {
    return (
      <Screen2HealthConditions
        value={data.healthConditions}
        progress={progress}
        onBack={goBack}
        onSkip={() => { mergeData({ healthConditions: [] }); goNext(); }}
        onContinue={(conditions) => { mergeData({ healthConditions: conditions }); goNext(); }}
      />
    );
  }

  if (currentStep === 'S3F' || currentStep === 'S3P' || currentStep === 'S3BOTH') {
    const variant = currentStep === 'S3F' ? 'food' : currentStep === 'S3P' ? 'personal' : 'both';
    return (
      <Screen3Allergies
        variant={variant}
        foodAllergies={data.foodAllergies}
        foodAllergyTraces={data.foodAllergyTraces}
        foodAllergyOther={data.foodAllergyOther}
        skinAllergens={data.skinAllergens}
        skinAllergenTraces={data.skinAllergenTraces}
        skinAllergenOther={data.skinAllergenOther}
        progress={progress}
        onBack={goBack}
        onSkip={() => {
          mergeData({ foodAllergies: [], skinAllergens: [] });
          goNext();
        }}
        onContinue={(partial) => { mergeData(partial); goNext(); }}
      />
    );
  }

  if (currentStep === 'S4') {
    return (
      <Screen4Intolerances
        value={data.foodIntolerances}
        progress={progress}
        onBack={goBack}
        onSkip={() => { mergeData({ foodIntolerances: [] }); goNext(); }}
        onContinue={(v: FoodIntoleranceEntry[]) => { mergeData({ foodIntolerances: v }); goNext(); }}
      />
    );
  }

  if (currentStep === 'S5') {
    return (
      <Screen5Diet
        patterns={data.dietaryPatterns}
        strictness={data.dietStrictness}
        progress={progress}
        onBack={goBack}
        onSkip={() => { mergeData({ dietaryPatterns: [], dietStrictness: '' }); goNext(); }}
        onContinue={(patterns, strictness) => {
          mergeData({ dietaryPatterns: patterns, dietStrictness: strictness });
          goNext();
        }}
      />
    );
  }

  if (currentStep === 'S6') {
    const prepopulated = applyHealthConditionPrepopulation(data);
    return (
      <Screen6PersonalCare
        skinType={prepopulated.skinType}
        skinConcerns={prepopulated.skinConcerns}
        skinIngredientsToAvoid={prepopulated.skinIngredientsToAvoid}
        hairType={prepopulated.hairType}
        hairConcerns={prepopulated.hairConcerns}
        hairIngredientsToAvoid={prepopulated.hairIngredientsToAvoid}
        progress={progress}
        onBack={goBack}
        onSkip={() => {
          mergeData({
            skinType: '', skinConcerns: [], skinIngredientsToAvoid: [],
            hairType: '', hairConcerns: [], hairIngredientsToAvoid: [],
          });
          goNext();
        }}
        onContinue={(partial) => { mergeData(partial); goNext(); }}
      />
    );
  }

  if (currentStep === 'S7') {
    return (
      <Screen7Household
        reasons={data.householdReasons}
        ingredients={data.householdIngredients}
        progress={progress}
        onBack={goBack}
        onSkip={() => { mergeData({ householdReasons: [], householdIngredients: [] }); goNext(); }}
        onContinue={(reasons, ingredients) => {
          mergeData({ householdReasons: reasons, householdIngredients: ingredients });
          goNext();
        }}
      />
    );
  }

  if (currentStep === 'S8') {
    return (
      <Screen8Supplements
        value={data.supplementAvoids}
        progress={progress}
        onBack={goBack}
        onSkip={() => { mergeData({ supplementAvoids: [] }); goNext(); }}
        onContinue={(v) => { mergeData({ supplementAvoids: v }); goNext(); }}
      />
    );
  }

  // S9 – Summary
  return (
    <Screen9Summary
      data={data}
      onEditProfile={() => setStepIdx(0)}
      onLetsGo={() => finishOnboarding(data)}
    />
  );
}
