import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import type { Category } from '../../../shared/onboardingTypes';

interface Props {
  value: Category[];
  progress: number;
  onContinue: (categories: Category[]) => void;
}

const CARDS: { id: Category; emoji: string; title: string; sub: string }[] = [
  { id: 'food', emoji: '🥦', title: 'FOOD & GROCERY', sub: 'Includes supplements' },
  { id: 'personalCare', emoji: '🧴', title: 'PERSONAL CARE', sub: 'Skincare, haircare & more' },
  { id: 'household', emoji: '🏠', title: 'HOUSEHOLD', sub: 'Cleaning & home products' },
];

export default function Screen1Categories({ value, progress, onContinue }: Props) {
  const [selected, setSelected] = useState<Category[]>(value);
  const [error, setError] = useState('');

  const toggle = (id: Category) => {
    setError('');
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      setError('Please select at least one category.');
      return;
    }
    onContinue(selected);
  };

  return (
    <OnboardingLayout
      title="What do you want to scan?"
      subtitle="Select the categories you care about. You can change these later."
      progress={progress}
      onPrimary={handleContinue}
      primaryLabel="Continue"
      error={error}
    >
      <View style={styles.cards}>
        {CARDS.map((card) => {
          const active = selected.includes(card.id);
          return (
            <Pressable
              key={card.id}
              onPress={() => toggle(card.id)}
              style={[styles.card, active && styles.cardOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <View style={styles.cardRow}>
                <Text style={styles.emoji}>{card.emoji}</Text>
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, active && styles.cardTitleOn]}>
                    {card.title}
                  </Text>
                  <Text style={styles.cardSub}>{card.sub}</Text>
                </View>
                <View style={[styles.toggle, active && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, active && styles.toggleThumbOn]} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: Space.md,
    marginTop: Space.sm,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: Space.base,
  },
  cardOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,197,61,0.10)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  emoji: {
    fontSize: s(32),
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: Font.bold,
    fontSize: s(14),
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  cardTitleOn: {
    color: Colors.textWhite,
  },
  cardSub: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textFaint,
    marginTop: s(2),
  },
  toggle: {
    width: s(44),
    height: s(26),
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    paddingHorizontal: s(3),
  },
  toggleOn: {
    backgroundColor: Colors.accent,
  },
  toggleThumb: {
    width: s(20),
    height: s(20),
    borderRadius: Radius.pill,
    backgroundColor: Colors.textMuted,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    backgroundColor: Colors.canvasDark,
    alignSelf: 'flex-end',
  },
});
