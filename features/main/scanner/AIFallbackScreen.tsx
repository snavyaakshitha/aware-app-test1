/**
 * AIFallbackScreen
 *
 * Shown when a barcode is not found in any external API.
 * User captures 2 photos → AI extracts product data → navigates to ScanResult.
 *
 * Two photos needed:
 *  1. Front of the product (packaging / product name / brand)
 *  2. Nutrition / ingredient label (back or side)
 *
 * (Barcode number is already captured — no photo needed.)
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, s, Radius } from '../../../shared/theme';
import {
  callAnalyzeProduct,
  saveAIResult,
  aiResultToSnapshot,
} from '../../../shared/aiProduct';
import { getCurrentUser } from '../../../shared/supabase';
import type { ScannerStackParamList } from '../../../shared/types';

type Props = NativeStackScreenProps<ScannerStackParamList, 'AIFallback'>;

type PhotoState = {
  uri: string;
  base64: string;
} | null;

type ScreenPhase =
  | 'capture'   // taking / reviewing photos
  | 'analyzing' // waiting for AI
  | 'error';    // AI failed

// ─── Image resize helper (web + native) ──────────────────────────────────────

async function resizeToBase64(uri: string, maxDim = 1024): Promise<string> {
  // On web we can use a canvas; on native expo-image-picker already gives base64
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl); // keep as data-URL; Edge Function strips prefix
      };
      img.onerror = reject;
      img.src = uri;
    });
  }
  // Native: already base64 from ImagePicker (with base64: true option)
  return uri;
}

// ─── Photo slot component ─────────────────────────────────────────────────────

interface PhotoSlotProps {
  label: string;
  hint: string;
  icon: string;
  photo: PhotoState;
  onCapture: () => void;
  disabled?: boolean;
}

function PhotoSlot({ label, hint, icon, photo, onCapture, disabled }: PhotoSlotProps) {
  return (
    <Pressable
      onPress={onCapture}
      disabled={disabled}
      style={({ pressed }) => [
        styles.slot,
        photo ? styles.slotFilled : styles.slotEmpty,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={styles.slotImage} resizeMode="cover" />
          <View style={styles.slotOverlay}>
            <View style={styles.slotCheckBadge}>
              <Ionicons name="checkmark" size={s(14)} color="#fff" />
            </View>
            <Text style={styles.slotRetakeLabel}>Tap to retake</Text>
          </View>
        </>
      ) : (
        <View style={styles.slotInner}>
          <View style={styles.slotIconRing}>
            <Ionicons name={icon as any} size={s(28)} color={Colors.accent} />
          </View>
          <Text style={styles.slotLabel}>{label}</Text>
          <Text style={styles.slotHint}>{hint}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AIFallbackScreen({ route, navigation }: Props) {
  const { barcode } = route.params;
  const insets = useSafeAreaInsets();
  const [, requestCameraPermission] = useCameraPermissions();

  const [frontPhoto, setFrontPhoto] = useState<PhotoState>(null);
  const [labelPhoto, setLabelPhoto] = useState<PhotoState>(null);
  const [phase, setPhase] = useState<ScreenPhase>('capture');
  const [errorMsg, setErrorMsg] = useState('');
  const [statusText, setStatusText] = useState('Sending images to AI…');

  const canSubmit = frontPhoto !== null && labelPhoto !== null && phase === 'capture';

  // ── Camera / picker ─────────────────────────────────────────────────────────

  const capturePhoto = useCallback(
    async (slot: 'front' | 'label') => {
      // On native: try camera first; on web: use ImagePicker (which opens file input)
      if (Platform.OS !== 'web') {
        const perm = await requestCameraPermission();
        if (!perm.granted) {
          Alert.alert('Camera needed', 'Please allow camera access to take photos.');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.82,
        base64: true,
        allowsEditing: false,
        // On web, launchCameraAsync is not available — we fall back to image library
      }).catch(async () => {
        // Camera unavailable (e.g. web, simulator) → open gallery
        return ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.82,
          base64: true,
        });
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      let base64 = asset.base64 ?? '';

      // On web the uri IS the base64 data-URL; resize it
      if (Platform.OS === 'web') {
        base64 = await resizeToBase64(asset.uri, 1024);
      } else if (!base64) {
        // Fallback: read from uri (shouldn't happen with base64:true)
        base64 = asset.uri;
      } else {
        base64 = `data:image/jpeg;base64,${base64}`;
      }

      const photoState: PhotoState = { uri: asset.uri, base64 };
      if (slot === 'front') setFrontPhoto(photoState);
      else setLabelPhoto(photoState);
    },
    [requestCameraPermission],
  );

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!frontPhoto || !labelPhoto) return;
    setPhase('analyzing');
    setStatusText('Sending images to AI…');

    try {
      const user = await getCurrentUser().catch(() => null);

      setStatusText('Extracting product info…');
      const aiResult = await callAnalyzeProduct(
        barcode,
        frontPhoto.base64,
        labelPhoto.base64,
        user?.id ?? null,
      );

      // Cache locally
      await saveAIResult(barcode, aiResult);

      // Navigate to ScanResult — the screen will read the cached AI result
      navigation.replace('ScanResult', { barcode });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'AI analysis failed. Please try again.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [barcode, frontPhoto, labelPhoto, navigation]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={s(24)} color={Colors.textWhite} />
      </Pressable>
      <Text style={styles.headerTitle}>AI Analysis</Text>
      <View style={{ width: s(40) }} />
    </View>
  );

  // ── Analyzing overlay ─────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centeredFlex}>
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginBottom: s(16) }} />
            <Text style={styles.analyzingTitle}>AI is reading your product</Text>
            <Text style={styles.analyzingStatus}>{statusText}</Text>
            <View style={styles.modelBadge}>
              <Feather name="zap" size={s(12)} color={Colors.accent} />
              <Text style={styles.modelBadgeText}>Gemini 2.0 Flash</Text>
            </View>
          </View>
          <Text style={styles.analyzingNote}>
            Typically takes 5–15 seconds. Please keep the app open.
          </Text>
        </View>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    const isNetworkError = errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('unavailable');
    const isImageError = errorMsg.toLowerCase().includes('image') || errorMsg.toLowerCase().includes('photo');
    const isTimeout = errorMsg.toLowerCase().includes('too long');

    let emoji = '😕';
    let suggestion = 'Try retaking the photos with better lighting and clearer text.';

    if (isImageError) {
      emoji = '📸';
      suggestion = 'Make sure the text on both labels is clearly visible with good lighting and no glare.';
    } else if (isTimeout) {
      emoji = '⏱️';
      suggestion = 'This can happen with large images. Try taking smaller, zoomed-in photos of the key information.';
    } else if (isNetworkError) {
      emoji = '📡';
      suggestion = 'Check your internet connection and try again.';
    }

    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centeredFlex}>
          <Text style={{ fontSize: s(52), marginBottom: s(16) }}>{emoji}</Text>
          <Text style={styles.errorTitle}>AI analysis failed</Text>
          <Text style={styles.errorMessage}>{errorMsg}</Text>
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionText}>💡 {suggestion}</Text>
          </View>
          <Pressable
            style={styles.retryBtn}
            onPress={() => { setErrorMsg(''); setPhase('capture'); }}
          >
            <Ionicons name="refresh" size={s(16)} color={Colors.canvasDark} />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
          <Pressable
            style={styles.backLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backLinkText}>Go back to scanner</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Capture phase ─────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + s(24) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Notice banner */}
        <View style={styles.noticeBanner}>
          <View style={styles.noticeBannerIcon}>
            <Text style={{ fontSize: s(20) }}>🔍</Text>
          </View>
          <View style={styles.noticeBannerBody}>
            <Text style={styles.noticeBannerTitle}>Product not in any database</Text>
            <Text style={styles.noticeBannerSub}>
              No problem — snap 2 quick photos and our AI will analyse it instantly.
            </Text>
          </View>
        </View>

        {/* Barcode ref */}
        <View style={styles.barcodeRef}>
          <Feather name="hash" size={s(13)} color={Colors.textMuted} />
          <Text style={styles.barcodeRefText}>Barcode: {barcode}</Text>
        </View>

        {/* Instructions */}
        <Text style={styles.sectionLabel}>TAKE 2 PHOTOS</Text>

        {/* Photo slots */}
        <View style={styles.slots}>
          <PhotoSlot
            label="Front of product"
            hint="Show the product name and brand clearly"
            icon="image-outline"
            photo={frontPhoto}
            onCapture={() => capturePhoto('front')}
          />
          <PhotoSlot
            label="Nutrition / ingredient label"
            hint="The ingredients list and nutrition facts panel"
            icon="document-text-outline"
            photo={labelPhoto}
            onCapture={() => capturePhoto('label')}
          />
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>📸 Tips for best results</Text>
          {[
            'Hold the phone steady — no blurry images',
            'Make sure all text is clearly readable',
            'Good lighting matters (no glare)',
            'Capture the full label, not cropped',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Submit CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            !canSubmit && styles.submitBtnDisabled,
            pressed && canSubmit && { opacity: 0.85 },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Feather name="zap" size={s(18)} color={canSubmit ? Colors.canvasDark : Colors.textFaint} />
          <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
            {canSubmit ? 'Analyse with AI' : `Add ${frontPhoto ? '' : 'front '}${!frontPhoto && !labelPhoto ? '+ ' : ''}${labelPhoto ? '' : 'label'} photo${canSubmit ? '' : ' first'}`}
          </Text>
        </Pressable>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Your photos are processed by AI (Gemini / GPT-4o) and stored anonymously
          to improve our community database. No personal data is attached.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvasDark,
  },

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingBottom: s(12),
  },
  backBtn: {
    width: s(40), height: s(40),
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Font.bold,
    fontSize: s(17),
    color: Colors.textWhite,
  },

  // ── Scroll / layout ───────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: s(16),
  },
  centeredFlex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(24),
    gap: s(12),
  },

  // ── Notice banner ─────────────────────────────────────────────────────
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(12),
    padding: s(14),
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.25)',
    backgroundColor: 'rgba(139,197,61,0.07)',
    marginBottom: s(12),
  },
  noticeBannerIcon: {
    marginTop: s(2),
  },
  noticeBannerBody: { flex: 1 },
  noticeBannerTitle: {
    fontFamily: Font.bold,
    fontSize: s(14),
    color: Colors.accent,
    marginBottom: s(3),
  },
  noticeBannerSub: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    lineHeight: s(18),
  },

  // ── Barcode ref ───────────────────────────────────────────────────────
  barcodeRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    marginBottom: s(20),
  },
  barcodeRefText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },

  // ── Section label ─────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: Font.bold,
    fontSize: s(11),
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: s(12),
  },

  // ── Photo slots ───────────────────────────────────────────────────────
  slots: {
    gap: s(12),
    marginBottom: s(20),
  },
  slot: {
    height: s(148),
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  slotEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(139,197,61,0.35)',
    backgroundColor: 'rgba(139,197,61,0.04)',
  },
  slotFilled: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  slotInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    padding: s(16),
  },
  slotIconRing: {
    width: s(52), height: s(52),
    borderRadius: s(26),
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.30)',
    backgroundColor: 'rgba(139,197,61,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(4),
  },
  slotLabel: {
    fontFamily: Font.bold,
    fontSize: s(14),
    color: Colors.textOffWhite,
    textAlign: 'center',
  },
  slotHint: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: s(16),
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  slotOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: s(10),
  },
  slotCheckBadge: {
    position: 'absolute',
    top: s(10), right: s(10),
    width: s(28), height: s(28),
    borderRadius: s(14),
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  slotRetakeLabel: {
    fontFamily: Font.medium,
    fontSize: s(11),
    color: 'rgba(255,255,255,0.80)',
  },

  // ── Tips ──────────────────────────────────────────────────────────────
  tipsCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: s(14),
    marginBottom: s(20),
    gap: s(8),
  },
  tipsTitle: {
    fontFamily: Font.medium,
    fontSize: s(13),
    color: Colors.textOffWhite,
    marginBottom: s(4),
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
  },
  tipDot: {
    width: s(5), height: s(5),
    borderRadius: s(3),
    backgroundColor: Colors.accent,
    marginTop: s(5),
    flexShrink: 0,
  },
  tipText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    flex: 1,
    lineHeight: s(18),
  },

  // ── Submit button ─────────────────────────────────────────────────────
  submitBtn: {
    height: s(52),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(10),
    marginBottom: s(12),
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  submitBtnText: {
    fontFamily: Font.bold,
    fontSize: s(15),
    color: Colors.canvasDark,
  },
  submitBtnTextDisabled: {
    color: Colors.textFaint,
  },

  // ── Analyzing ─────────────────────────────────────────────────────────
  analyzingCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: s(28),
    alignItems: 'center',
    width: '100%',
  },
  analyzingTitle: {
    fontFamily: Font.bold,
    fontSize: s(18),
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: s(8),
  },
  analyzingStatus: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: s(16),
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: 'rgba(139,197,61,0.10)',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.25)',
    paddingHorizontal: s(12),
    paddingVertical: s(5),
  },
  modelBadgeText: {
    fontFamily: Font.medium,
    fontSize: s(12),
    color: Colors.accent,
  },
  analyzingNote: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textFaint,
    textAlign: 'center',
    lineHeight: s(18),
    paddingHorizontal: s(16),
  },

  // ── Error ─────────────────────────────────────────────────────────────
  errorTitle: {
    fontFamily: Font.bold,
    fontSize: s(20),
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: s(8),
  },
  errorMessage: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: s(20),
    marginBottom: s(16),
  },
  suggestionBox: {
    backgroundColor: 'rgba(139,197,61,0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.25)',
    padding: s(12),
    marginBottom: s(16),
  },
  suggestionText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    lineHeight: s(18),
    textAlign: 'center',
  },
  retryBtn: {
    height: s(48),
    paddingHorizontal: s(28),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  retryBtnText: {
    fontFamily: Font.bold,
    fontSize: s(15),
    color: Colors.canvasDark,
  },
  backLink: {
    padding: s(8),
  },
  backLinkText: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },

  // ── Disclaimer ────────────────────────────────────────────────────────
  disclaimer: {
    fontFamily: Font.regular,
    fontSize: s(11),
    color: Colors.textFaint,
    textAlign: 'center',
    lineHeight: s(16),
    paddingHorizontal: s(8),
  },
});
