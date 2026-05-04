/**
 * Aware — Splash Screen
 *
 * Shows for 3 s, then fades out and calls onComplete.
 * useNativeDriver is false for opacity to ensure web compatibility.
 *
 * v4 design: teal #1B5E52 bg, centered icon + wordmark in white.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const scale = Math.min(SCREEN_W / 393, SCREEN_H / 852);
function s(px: number) { return Math.round(px * scale); }

const FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
})!;

interface Props { onComplete?: () => void; }

export default function SplashScreen({ onComplete }: Props) {
  const opacity   = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 55,
      friction: 7,
    }).start();

    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }).start(() => onComplete?.());
    }, 3000);

    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity }]}>
      <StatusBar style="light" />

      {/* Subtle decorative circle */}
      <View style={styles.decorCircle} />

      {/* Centred icon + wordmark */}
      <View style={styles.centre}>
        <Animated.View style={[styles.iconCard, { transform: [{ scale: iconScale }] }]}>
          <Text style={styles.awText}>
            <Text style={{ color: '#FFFFFF' }}>A</Text>
            <Text style={{ color: '#7ECFC0' }}>w</Text>
          </Text>
        </Animated.View>
        <Text style={styles.wordmark}>Aware</Text>
        <Text style={styles.tagline}>Clean ingredients, clear choices</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1B5E52',
    overflow: 'hidden',
  },

  // Subtle decorative element — soft lighter teal circle at top-right
  decorCircle: {
    position: 'absolute',
    width: s(400),
    height: s(400),
    borderRadius: s(200),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    top: s(-120),
    right: s(-100),
  },

  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: s(60),
  },

  iconCard: {
    width: s(78),
    height: s(78),
    borderRadius: s(18),
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(14),
  },
  awText: {
    fontFamily: FONT,
    fontWeight: '700',
    fontSize: s(36),
    lineHeight: s(40),
    letterSpacing: s(36) * -0.035,
    textAlign: 'center',
  },
  wordmark: {
    fontFamily: FONT,
    fontWeight: '600',
    fontSize: s(22),
    lineHeight: s(26),
    letterSpacing: s(22) * -0.02,
    color: 'rgba(255, 255, 255, 0.92)',
    marginBottom: s(6),
  },
  tagline: {
    fontFamily: FONT,
    fontWeight: '400',
    fontSize: s(13),
    color: 'rgba(255, 255, 255, 0.60)',
    letterSpacing: 0.2,
  },
});
