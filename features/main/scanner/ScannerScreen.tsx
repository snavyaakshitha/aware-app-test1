/**
 * Scanner — full-screen camera barcode scanning + floating bottom panel for manual entry.
 * All scanning logic is preserved exactly; only the layout has changed.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  TextInput,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ProductBarcodeCamera from './ProductBarcodeCamera';
import { PRODUCT_BARCODE_TYPES } from './barcodeTypes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, s, Radius, scoreColor, scoreLabel, scoreBgColor } from '../../../shared/theme';
import { fetchProductByBarcode, resolveTextToBarcode } from '../../../shared/productCatalog';
import { extractProductCode } from '../../../shared/scanResolve';
import { fetchUserPreferences, getCurrentUser } from '../../../shared/supabase';
import type { ScannerStackParamList, UserPreferences } from '../../../shared/types';

type Props = NativeStackScreenProps<ScannerStackParamList, 'Scanner'>;

type ScanState = 'idle' | 'scanning' | 'found' | 'not_found';

type RecentItem = { barcode: string; name: string };

// ─── Scan zone dimensions ─────────────────────────────────────────────────────
const ZONE_W = s(310);
const ZONE_H = s(190);
const CORNER_SIZE = s(22);
const CORNER_THICKNESS = s(3);

export default function ScannerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [flashOn, setFlashOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [prefs, setPrefs] = useState<Partial<UserPreferences> | null>(null);
  const [cameraGate, setCameraGate] = useState(true);
  const [systemScannerAvailable, setSystemScannerAvailable] = useState(false);

  const pausedRef = useRef(false);
  const acceptScansRef = useRef(true);
  const lastScanRef = useRef<{ t: number; raw: string }>({ t: 0, raw: '' });
  const scanLineY = useRef(new Animated.Value(0)).current;
  const scanLineLoop = useRef<Animated.CompositeAnimation | null>(null);

  const sheetY = useRef(new Animated.Value(300)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const [previewProduct, setPreviewProduct] = useState<{
    name: string;
    brand: string;
    barcode: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      pausedRef.current = false;
      acceptScansRef.current = true;
      setCameraGate(true);
      setScanState('idle');
      setPreviewProduct(null);
    }, [])
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser();
      if (!user || cancelled) return;
      const p = await fetchUserPreferences(user.id);
      if (!cancelled) setPrefs(p);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    setSystemScannerAvailable(CameraView.isModernBarcodeScannerAvailable === true);
  }, []);

  const startScanLine = useCallback(() => {
    scanLineY.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    anim.start();
    scanLineLoop.current = anim;
  }, [scanLineY]);

  const stopScanLine = useCallback(() => {
    scanLineLoop.current?.stop();
  }, []);

  const processRawScan = useCallback(
    async (raw: string, _source: 'camera' | 'manual' | 'demo') => {
      if (pausedRef.current) return;
      acceptScansRef.current = false;
      setCameraGate(false);
      const now = Date.now();
      if (now - lastScanRef.current.t < 2500 && lastScanRef.current.raw === raw) {
        acceptScansRef.current = true;
        setCameraGate(true);
        return;
      }
      lastScanRef.current = { t: now, raw };

      let lookupCode = extractProductCode(raw);
      if (!lookupCode) lookupCode = await resolveTextToBarcode(raw.trim());
      if (!lookupCode) {
        setScanState('not_found');
        acceptScansRef.current = true;
        setCameraGate(true);
        return;
      }

      setScanState('scanning');
      startScanLine();
      const res = await fetchProductByBarcode(lookupCode);
      stopScanLine();

      if (!res.ok) {
        setScanState('not_found');
        acceptScansRef.current = true;
        setCameraGate(true);
        return;
      }

      pausedRef.current = true;
      setScanState('found');
      setPreviewProduct({
        name: res.product.productName,
        brand: res.product.brand,
        barcode: lookupCode,
      });
      setRecent((prev) => [
        { barcode: lookupCode, name: res.product.productName },
        ...prev.filter((x) => x.barcode !== lookupCode),
      ].slice(0, 5));

      Animated.parallel([
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    },
    [prefs, sheetOpacity, sheetY, startScanLine, stopScanLine]
  );

  const onBarcodeScanned = useCallback(
    (event: { data: string }) => {
      if (!acceptScansRef.current || pausedRef.current) return;
      void processRawScan(event.data, 'camera');
    },
    [processRawScan]
  );

  const hideResult = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(sheetOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setPreviewProduct(null);
      setScanState('idle');
      pausedRef.current = false;
      acceptScansRef.current = true;
      setCameraGate(true);
    });
  }, [sheetOpacity, sheetY]);

  const handleViewDetails = useCallback(() => {
    if (previewProduct) navigation.navigate('ScanResult', { barcode: previewProduct.barcode });
  }, [navigation, previewProduct]);

  const handleDemo = useCallback(() => {
    void processRawScan('3017624010701', 'demo');
  }, [processRawScan]);

  const handleSystemScanner = useCallback(async () => {
    if (Platform.OS === 'web' || !CameraView.isModernBarcodeScannerAvailable) return;
    setCameraGate(false);
    const sub = CameraView.onModernBarcodeScanned((event) => {
      void processRawScan(event.data, 'camera');
    });
    try {
      await CameraView.launchScanner({ barcodeTypes: [...PRODUCT_BARCODE_TYPES] });
    } finally {
      sub.remove();
      setCameraGate(true);
    }
  }, [processRawScan]);

  const handleManualSubmit = useCallback(() => {
    const raw = manualCode.trim();
    if (!raw) return;
    void processRawScan(raw, 'manual');
    setManualCode('');
  }, [manualCode, processRawScan]);

  const resetScan = useCallback(() => {
    acceptScansRef.current = true;
    setCameraGate(true);
    setScanState('idle');
  }, []);

  const isWeb = Platform.OS === 'web';
  const camAllowed = permission?.granted === true;
  const showCamera = camAllowed;

  const scanLineTranslate = scanLineY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ZONE_H - s(2)],
  });

  const hintText = scanState === 'scanning'
    ? 'Looking up product…'
    : scanState === 'not_found'
    ? 'Not found — try entering the barcode below'
    : isWeb
    ? 'Hold barcode steady in the frame (UPC / EAN)'
    : 'Align the barcode inside the frame';

  return (
    <View style={styles.root}>

      {/* ── Layer 1: Full-screen camera ────────────────────────────────── */}
      {showCamera ? (
        <ProductBarcodeCamera
          style={StyleSheet.absoluteFillObject}
          facing="back"
          zoom={isWeb ? undefined : 0.08}
          enableTorch={flashOn}
          active={scanState === 'idle' && cameraGate}
          barcodeScannerSettings={{ barcodeTypes: PRODUCT_BARCODE_TYPES }}
          onBarcodeScanned={onBarcodeScanned}
        />
      ) : (
        <View style={styles.noCameraFill} />
      )}

      {/* ── Layer 2: UI overlay (flex column) ─────────────────────────── */}
      <View style={StyleSheet.absoluteFillObject}>

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + s(10) }]}>
          <Text style={styles.topTitle}>Scanner</Text>
          <Pressable
            onPress={() => setFlashOn((v) => !v)}
            style={styles.flashBtn}
            disabled={!showCamera}
          >
            <Ionicons
              name={flashOn ? 'flash' : 'flash-off'}
              size={s(22)}
              color={!showCamera ? Colors.textFaint : flashOn ? Colors.accent : Colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Center: scan zone (no touch interception) */}
        <View style={styles.centerSection} pointerEvents="none">
          {/* No camera, show icon hint */}
          {!showCamera && (
            <View style={styles.noCameraHint}>
              <MaterialIcons name="videocam-off" size={s(44)} color="rgba(255,255,255,0.25)" />
              <Text style={styles.noCameraText}>
                {isWeb ? 'Allow camera access (HTTPS required)' : 'Camera permission needed'}
              </Text>
            </View>
          )}

          {/* Scan zone overlay */}
          <View style={[styles.scanZone, { width: ZONE_W, height: ZONE_H }]}>
            {/* Corner brackets */}
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c]]} />
            ))}
            {/* Animated scan line */}
            {scanState === 'scanning' && (
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
              />
            )}
          </View>

          {/* Hint text */}
          <View style={styles.hintWrap}>
            {scanState === 'scanning' && (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: s(8) }} />
            )}
            <Text style={[
              styles.hintText,
              scanState === 'not_found' && styles.hintTextWarn,
            ]}>
              {hintText}
            </Text>
          </View>
        </View>

        {/* Bottom floating panel */}
        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + s(12) }]}>

          {/* Status banner for not_found */}
          {scanState === 'not_found' && (
            <View style={styles.notFoundArea}>
              <View style={styles.notFoundBanner}>
                <Text style={styles.notFoundBannerText}>🔍 Not found in any database</Text>
                <Pressable onPress={resetScan} hitSlop={8}>
                  <Text style={styles.notFoundRetry}>Try again</Text>
                </Pressable>
              </View>
              {/* AI fallback CTA — only if a barcode was actually scanned */}
              {lastScanRef.current.raw ? (
                <Pressable
                  style={styles.aiFallbackCta}
                  onPress={() => {
                    const code = lastScanRef.current.raw;
                    if (code) navigation.navigate('AIFallback', { barcode: code });
                  }}
                >
                  <View style={styles.aiFallbackCtaLeft}>
                    <Text style={styles.aiFallbackCtaIcon}>✨</Text>
                    <View>
                      <Text style={styles.aiFallbackCtaTitle}>Analyse with AI instead</Text>
                      <Text style={styles.aiFallbackCtaSub}>Snap 2 photos → instant result</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={s(18)} color={Colors.accent} />
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Manual input pill */}
          <View style={styles.inputPill}>
            <Ionicons name="search-outline" size={s(18)} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Barcode, URL, or product name…"
              placeholderTextColor={Colors.textFaint}
              value={manualCode}
              onChangeText={setManualCode}
              onSubmitEditing={handleManualSubmit}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {manualCode.length > 0 && (
              <Pressable onPress={handleManualSubmit} style={styles.goBtn}>
                <Text style={styles.goBtnText}>Go</Text>
              </Pressable>
            )}
          </View>

          {/* Action row */}
          {!camAllowed && (
            <Pressable onPress={() => void requestPermission()} style={styles.permBtn}>
              <Ionicons name="camera-outline" size={s(16)} color={Colors.canvasDark} />
              <Text style={styles.permBtnText}>
                {isWeb ? 'Allow camera in browser' : 'Allow camera access'}
              </Text>
            </Pressable>
          )}

          <View style={styles.actionRow}>
            {!isWeb && systemScannerAvailable && scanState === 'idle' && (
              <Pressable onPress={() => void handleSystemScanner()} style={styles.actionChip}>
                <Ionicons name="scan-outline" size={s(14)} color={Colors.accent} />
                <Text style={styles.actionChipText}>System scanner</Text>
              </Pressable>
            )}
            {scanState === 'idle' && (
              <Pressable onPress={handleDemo} style={styles.actionChip}>
                <Ionicons name="flask-outline" size={s(14)} color={Colors.textMuted} />
                <Text style={[styles.actionChipText, { color: Colors.textMuted }]}>
                  Try Nutella demo
                </Text>
              </Pressable>
            )}
          </View>

          {/* Recent scans */}
          {recent.length > 0 && scanState === 'idle' && (
            <View style={styles.recentSection}>
              <Text style={styles.recentLabel}>Recent</Text>
              <FlatList
                data={recent}
                horizontal
                keyExtractor={(item) => item.barcode}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: s(8) }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => navigation.navigate('ScanResult', { barcode: item.barcode })}
                    style={styles.recentCard}
                  >
                    <Feather name="package" size={s(18)} color={Colors.accent} />
                    <Text style={styles.recentName} numberOfLines={2}>{item.name}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      </View>

      {/* ── Layer 3: Result bottom sheet ───────────────────────────────── */}
      {previewProduct && scanState === 'found' && (
        <Animated.View
          style={[styles.resultSheet, { transform: [{ translateY: sheetY }], opacity: sheetOpacity }]}
        >
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetContent, { paddingBottom: insets.bottom + s(16) }]}>
            <View style={styles.sheetProductRow}>
              <View style={styles.sheetEmoji}>
                <Text style={{ fontSize: s(28) }}>📦</Text>
              </View>
              <View style={styles.sheetProductInfo}>
                <Text style={styles.sheetProductName} numberOfLines={2}>{previewProduct.name}</Text>
                <Text style={styles.sheetBrand}>{previewProduct.brand}</Text>
                <View style={styles.sheetFitBadge}>
                  <Feather name="search" size={s(13)} color={Colors.accent} />
                  <Text style={[styles.sheetFitText, { color: Colors.accent }]}>Tap to see full analysis</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={handleViewDetails} style={styles.sheetViewBtn}>
              <Text style={styles.sheetViewBtnText}>View full analysis →</Text>
            </Pressable>
            <Pressable onPress={hideResult} style={styles.sheetDismiss}>
              <Text style={styles.sheetDismissText}>Scan another product</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Loading overlay */}
      {scanState === 'scanning' && (
        <View style={styles.loadingDot} pointerEvents="none">
          <View style={styles.loadingDotInner}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.loadingDotText}>Looking up…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  noCameraFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.canvasDark,
  },

  // ── Top bar ──────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingBottom: s(14),
    backgroundColor: 'rgba(1,20,8,0.75)',
  },
  topTitle: {
    fontFamily: Font.bold,
    fontSize: s(20),
    color: Colors.textWhite,
    letterSpacing: 0.3,
  },
  flashBtn: {
    width: s(40),
    height: s(40),
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Center scan zone ─────────────────────────────────────────────────
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCameraHint: {
    position: 'absolute',
    alignItems: 'center',
    gap: s(12),
    paddingHorizontal: s(32),
  },
  noCameraText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
  scanZone: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  tl: {
    top: 0, left: 0,
    borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
    borderColor: Colors.accent, borderTopLeftRadius: s(4),
  },
  tr: {
    top: 0, right: 0,
    borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
    borderColor: Colors.accent, borderTopRightRadius: s(4),
  },
  bl: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
    borderColor: Colors.accent, borderBottomLeftRadius: s(4),
  },
  br: {
    bottom: 0, right: 0,
    borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
    borderColor: Colors.accent, borderBottomRightRadius: s(4),
  },
  scanLine: {
    position: 'absolute',
    left: 0, right: 0, height: s(2),
    backgroundColor: Colors.accent,
    opacity: 0.85,
  },
  hintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(20),
    paddingHorizontal: s(20),
  },
  hintText: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  hintTextWarn: {
    color: Colors.scoreCaution,
  },

  // ── Bottom panel ─────────────────────────────────────────────────────
  bottomPanel: {
    backgroundColor: 'rgba(1,18,8,0.94)',
    borderTopLeftRadius: s(22),
    borderTopRightRadius: s(22),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: s(16),
    paddingTop: s(18),
    gap: s(12),
  },
  notFoundArea: {
    gap: s(8),
  },
  notFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: s(14),
    paddingVertical: s(10),
  },
  notFoundBannerText: {
    fontFamily: Font.medium,
    fontSize: s(14),
    color: Colors.scoreCaution,
  },
  notFoundRetry: {
    fontFamily: Font.medium,
    fontSize: s(13),
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
  aiFallbackCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139,197,61,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.28)',
    paddingHorizontal: s(14),
    paddingVertical: s(12),
  },
  aiFallbackCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    flex: 1,
  },
  aiFallbackCtaIcon: {
    fontSize: s(22),
  },
  aiFallbackCtaTitle: {
    fontFamily: Font.bold,
    fontSize: s(14),
    color: Colors.accent,
    marginBottom: s(2),
  },
  aiFallbackCtaSub: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: s(14),
    paddingVertical: s(4),
    gap: s(10),
    minHeight: s(48),
  },
  input: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: s(15),
    color: Colors.textWhite,
    paddingVertical: s(6),
  },
  goBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: s(16),
    paddingVertical: s(8),
    borderRadius: Radius.pill,
  },
  goBtnText: {
    fontFamily: Font.bold,
    fontSize: s(14),
    color: Colors.canvasDark,
  },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    backgroundColor: Colors.accent,
    paddingVertical: s(12),
    borderRadius: Radius.pill,
  },
  permBtnText: {
    fontFamily: Font.bold,
    fontSize: s(14),
    color: Colors.canvasDark,
  },
  actionRow: {
    flexDirection: 'row',
    gap: s(8),
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(12),
    paddingVertical: s(7),
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionChipText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.accent,
  },
  recentSection: {
    gap: s(8),
  },
  recentLabel: {
    fontFamily: Font.bold,
    fontSize: s(13),
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recentCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: s(10),
    alignItems: 'center',
    width: s(90),
  },
  recentScore: {
    fontFamily: Font.bold,
    fontSize: s(17),
    marginBottom: s(3),
  },
  recentName: {
    fontFamily: Font.regular,
    fontSize: s(10),
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: s(14),
  },

  // ── Result sheet ─────────────────────────────────────────────────────
  resultSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#081C0F',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderTopWidth: 1,
    borderColor: Colors.border,
    zIndex: 100,
  },
  sheetHandle: {
    width: s(36), height: s(4),
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: s(12), marginBottom: s(4),
  },
  sheetContent: { paddingHorizontal: s(20), paddingTop: s(12) },
  sheetProductRow: { flexDirection: 'row', gap: s(12), marginBottom: s(16) },
  sheetEmoji: {
    width: s(68), height: s(68),
    borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sheetProductInfo: { flex: 1 },
  sheetProductName: {
    fontFamily: Font.bold, fontSize: s(16),
    color: Colors.textWhite, marginBottom: s(2), lineHeight: s(22),
  },
  sheetBrand: {
    fontFamily: Font.regular, fontSize: s(13),
    color: Colors.textMuted, marginBottom: s(6),
  },
  sheetFitBadge: {
    flexDirection: 'row', alignItems: 'center', gap: s(4),
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: s(8), paddingVertical: s(3),
    alignSelf: 'flex-start',
  },
  sheetFitText: {
    fontFamily: Font.medium, fontSize: s(12), color: Colors.scoreClean,
  },
  sheetScore: {
    width: s(56), height: s(56),
    borderRadius: s(28), borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sheetScoreNum: { fontFamily: Font.bold, fontSize: s(20), lineHeight: s(22) },
  sheetScoreLabel: { fontFamily: Font.regular, fontSize: s(9) },
  sheetViewBtn: {
    height: s(48),
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: s(10),
  },
  sheetViewBtnText: {
    fontFamily: Font.bold, fontSize: s(15), color: Colors.canvasDark,
  },
  sheetDismiss: { alignItems: 'center', paddingVertical: s(4) },
  sheetDismissText: {
    fontFamily: Font.regular, fontSize: s(13),
    color: Colors.textMuted, textDecorationLine: 'underline',
  },

  // ── Loading indicator ────────────────────────────────────────────────
  loadingDot: {
    position: 'absolute',
    top: s(120), alignSelf: 'center',
    zIndex: 50,
  },
  loadingDotInner: {
    flexDirection: 'row', alignItems: 'center', gap: s(8),
    backgroundColor: 'rgba(1,20,8,0.88)',
    borderRadius: Radius.pill,
    paddingHorizontal: s(16), paddingVertical: s(10),
    borderWidth: 1, borderColor: Colors.border,
  },
  loadingDotText: {
    fontFamily: Font.regular, fontSize: s(13), color: Colors.textMuted,
  },
});
