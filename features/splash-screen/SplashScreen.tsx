/**
 * Aware — Splash Screen
 *
 * Shows for 3 s, then fades out and calls onComplete.
 * useNativeDriver is false for opacity to ensure web compatibility.
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
  // Use JS-driven opacity (false) so web browsers respect the timing correctly
  const opacity   = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    // Icon pops in with a spring
    Animated.spring(iconScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 55,
      friction: 7,
    }).start();

    // Wait 3 s, then fade out over 600 ms
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,   // ← false = works on web AND native
      }).start(() => onComplete?.());
    }, 3000);

    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity }]}>
      <StatusBar style="light" />

      {/* Green glow */}
      <View style={styles.ellipse1} />
      {/* Dark vignette */}
      <View style={styles.ellipse5} />

      {/* Watermark */}
      <View style={styles.watermarkFrame} pointerEvents="none">
        {Array.from({ length: 5 }).map((_, i) => (
          <Text key={i} style={styles.watermarkText}>Aware</Text>
        ))}
      </View>

      {/* Centred icon + wordmark */}
      <View style={styles.centre}>
        <Animated.View style={[styles.iconCard, { transform: [{ scale: iconScale }] }]}>
          <Text style={styles.awText}>
            <Text style={{ color: '#FFFFFF' }}>A</Text>
            <Text style={{ color: '#8BC53D' }}>w</Text>
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
    backgroundColor: '#E2F0CC',
    overflow: 'hidden',
  },

  ellipse1: {
    position: 'absolute',
    width: s(583), height: s(770),
    borderRadius: s(400),
    backgroundColor: '#79FFA8',
    top: s(80), left: s(-50),
    ...Platform.select({
      ios:     { shadowColor: '#79FFA8', shadowOffset: { width:0, height:0 }, shadowOpacity: 1, shadowRadius: s(400) },
      android: { opacity: 0.7 },
      web:     { filter: `blur(${s(400)}px)` } as any,
    }),
  },

  ellipse5: {
    position: 'absolute',
    width: s(1034), height: s(1055),
    borderRadius: s(530),
    backgroundColor: '#012F13',
    top: s(-450), left: s(-400),
    ...Platform.select({
      ios:     { shadowColor: '#012F13', shadowOffset: { width:0, height:0 }, shadowOpacity: 1, shadowRadius: s(60) },
      android: { opacity: 0.85 },
      web:     { filter: `blur(${s(60)}px)` } as any,
    }),
  },

  watermarkFrame: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', opacity: 0.14,
    paddingHorizontal: s(10),
  },
  watermarkText: {
    fontFamily: FONT, fontWeight: '500',
    fontSize: s(160), lineHeight: s(160),
    letterSpacing: s(160) * -0.035,
    textAlign: 'center', color: 'transparent',
    marginBottom: s(-92), includeFontPadding: false,
    ...Platform.select({
      web: { WebkitTextStroke: `${s(2)}px #FFFFFF` } as any,
      ios: { textShadowColor:'#FFFFFF', textShadowOffset:{width:0,height:0}, textShadowRadius:1.5 },
      android: { textShadowColor:'#FFFFFF', textShadowOffset:{width:0,height:0}, textShadowRadius:1.5 },
    }),
  },

  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    paddingBottom: s(60),
  },

  iconCard: {
    width: s(78), height: s(78), borderRadius: s(15),
    backgroundColor: '#012F13',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width:0, height: s(4) },
    shadowOpacity: 0.3, shadowRadius: s(12), elevation: 8,
  },
  awText: {
    fontFamily: FONT, fontWeight: '500',
    fontSize: s(36), lineHeight: s(36),
    letterSpacing: s(36) * -0.035, textAlign: 'center',
  },
  wordmark: {
    fontFamily: FONT, fontWeight: '500',
    fontSize: s(22), lineHeight: s(22),
    letterSpacing: s(22) * -0.035,
    color: '#E2F0CC', marginTop: s(12),
  },
  tagline: {
    fontFamily: FONT, fontWeight: '400',
    fontSize: s(13), color: 'rgba(1,47,19,0.55)',
    marginTop: s(6), letterSpacing: 0.2,
  },
});
