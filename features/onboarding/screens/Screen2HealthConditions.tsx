import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { Colors, Font, Radius, Space, s } from '../../../shared/theme';
import { HEALTH_CONDITIONS } from '../../../shared/onboardingConstants';

interface Props {
  value: string[];
  progress: number;
  onContinue: (conditions: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function Screen2HealthConditions({
  value, progress, onContinue, onBack, onSkip,
}: Props) {
  const [selected, setSelected] = useState<string[]>(value);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? HEALTH_CONDITIONS.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase())
      )
    : HEALTH_CONDITIONS;

  const toggle = (id: string) => {
    if (id === 'none' || id === 'prefer_not_to_say') {
      setSelected([id]);
      return;
    }
    setSelected((prev) => {
      const without = prev.filter((x) => x !== 'none' && x !== 'prefer_not_to_say');
      return without.includes(id) ? without.filter((x) => x !== id) : [...without, id];
    });
  };

  return (
    <OnboardingLayout
      title="Health conditions"
      subtitle="We'll flag ingredients that may affect you. Select all that apply."
      progress={progress}
      onBack={onBack}
      onPrimary={() => onContinue(selected)}
      onSkip={onSkip}
    >
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conditions…"
          placeholderTextColor={Colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.list}>
        {filtered.map((condition) => {
          const active = selected.includes(condition.id);
          return (
            <Pressable
              key={condition.id}
              onPress={() => toggle(condition.id)}
              style={[styles.item, active && styles.itemOn]}
            >
              <View style={[styles.check, active && styles.checkOn]}>
                {active && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.label, active && styles.labelOn]}>
                {condition.label}
              </Text>
            </Pressable>
          );
        })}
        {filtered.length === 0 && (
          <Text style={styles.noResults}>No conditions match your search.</Text>
        )}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space.md,
    marginBottom: Space.base,
    gap: Space.sm,
  },
  searchIcon: {
    fontSize: s(16),
  },
  searchInput: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textWhite,
    paddingVertical: Space.md,
  },
  list: {
    gap: Space.sm,
  },
  item: {
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
  itemOn: {
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
  noResults: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textFaint,
    textAlign: 'center',
    paddingVertical: Space.xl,
  },
});
