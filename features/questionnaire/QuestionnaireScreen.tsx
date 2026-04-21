/**
 * Aware — Questionnaire Screen (STUB)
 *
 * Placeholder shown after sign-in while the full questionnaire is built.
 * This screen will be replaced with the multi-step health/allergen/preference
 * questionnaire that personalizes the user's Aware experience.
 *
 * TODO: implement full interactive questionnaire covering:
 *   - Health conditions (PCOS, thyroid, diabetes, lactose intolerance, etc.)
 *   - Allergens (nuts, gluten, soy, dairy, shellfish, eggs, …)
 *   - Diet restrictions (vegan, keto, paleo, halal, kosher, …)
 *   - Ingredients to avoid (high fructose corn syrup, seed oils, etc.)
 *   - Free-text additions for anything not listed
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const scale = Math.min(SCREEN_W / 393, SCREEN_H / 852);
function s(px: number) { return Math.round(px * scale); }

const FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'Inter, -apple-system, sans-serif',
  default: 'System',
});
const FONT_BOLD = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  web: 'Inter, -apple-system, sans-serif',
  default: 'System',
});

interface Props {
  onComplete: () => void;
}

export default function QuestionnaireScreen({ onComplete }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(s(30))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background consistent with the rest of the app */}
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      <Animated.View
        style={[
          styles.card,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Icon */}
        <View style={styles.iconRing}>
          <Feather name="clipboard" size={s(32)} color="#8BC53D" />
        </View>

        <Text style={styles.title}>Let's get to know you</Text>
        <Text style={styles.subtitle}>
          Answer a few questions so we can personalize your product recommendations
          based on your health, allergies, and preferences.
        </Text>

        {/* Preview chips */}
        <View style={styles.chips}>
          {['Health conditions', 'Allergens', 'Diet', 'Ingredients to avoid'].map(
            (chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            )
          )}
        </View>

        <Pressable
          onPress={onComplete}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && { opacity: 0.88 },
          ]}
        >
          <Text style={styles.ctaText}>Get Started</Text>
          <Feather name="arrow-right" size={s(18)} color="#012F13" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E2F0CC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  ellipse1: {
    position: 'absolute',
    width: s(583),
    height: s(770),
    borderRadius: s(400),
    backgroundColor: '#79FFA8',
    top: s(80),
    left: s(-50),
    ...Platform.select({
      ios: {
        shadowColor: '#79FFA8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: s(400),
      },
      android: { opacity: 0.7 },
      web: { filter: `blur(${s(400)}px)` } as any,
    }),
  },

  ellipse5: {
    position: 'absolute',
    width: s(1034),
    height: s(1055),
    borderRadius: s(530),
    backgroundColor: '#012F13',
    top: s(-450),
    left: s(-400),
    ...Platform.select({
      ios: {
        shadowColor: '#012F13',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: s(60),
      },
      android: { opacity: 0.85 },
      web: { filter: `blur(${s(60)}px)` } as any,
    }),
  },

  card: {
    width: s(342),
    backgroundColor: 'rgba(2, 47, 19, 0.22)',
    borderRadius: s(24),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: s(28),
    alignItems: 'center',
  },

  iconRing: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    backgroundColor: 'rgba(139, 197, 61, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 197, 61, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(20),
  },

  title: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(24),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: s(10),
  },

  subtitle: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(14),
    lineHeight: s(21),
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: s(20),
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: s(8),
    marginBottom: s(28),
  },
  chip: {
    backgroundColor: 'rgba(139, 197, 61, 0.18)',
    borderRadius: s(20),
    borderWidth: 1,
    borderColor: 'rgba(139, 197, 61, 0.35)',
    paddingHorizontal: s(12),
    paddingVertical: s(6),
  },
  chipText: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(12),
    color: '#8BC53D',
  },

  ctaButton: {
    width: '100%',
    height: s(48),
    backgroundColor: '#8BC53D',
    borderRadius: s(13),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    fontSize: s(16),
    color: '#012F13',
  },
});
