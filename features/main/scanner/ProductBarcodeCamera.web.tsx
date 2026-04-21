/**
 * Web: Use expo-camera's CameraView for the live preview (same pipeline as Expo's working web camera).
 * Run ZXing on that video element via decodeFromVideoElement — no second getUserMedia stream.
 * (Expo's built-in web path only decodes QR with jsQR; ZXing adds UPC/EAN/Code128, etc.)
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { CameraView } from 'expo-camera';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

import type { BarcodeScanningResult, CameraViewProps } from 'expo-camera';

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
]);

const emptyScanResult = (): Pick<BarcodeScanningResult, 'cornerPoints' | 'bounds'> => ({
  cornerPoints: [],
  bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } },
});

type Props = Pick<
  CameraViewProps,
  'style' | 'active' | 'facing' | 'enableTorch' | 'onBarcodeScanned' | 'zoom' | 'barcodeScannerSettings'
>;

function queryVideoInHost(host: HTMLElement | null): HTMLVideoElement | null {
  if (!host || typeof host.querySelector !== 'function') return null;
  return host.querySelector('video');
}

function resolveHostEl(hostRef: React.RefObject<View | null>, domId: string): HTMLElement | null {
  if (typeof document !== 'undefined') {
    const byId = document.getElementById(domId);
    if (byId) return byId;
  }
  const fromRef = hostRef.current as unknown as HTMLElement | null;
  if (fromRef && typeof fromRef.querySelector === 'function') return fromRef;
  return null;
}

export default function ProductBarcodeCamera({
  style,
  active,
  facing = 'back',
  enableTorch,
  onBarcodeScanned,
  zoom,
  barcodeScannerSettings: _settings,
}: Props) {
  const hostRef = useRef<View | null>(null);
  const hostDomId = `aware-scanner-${useId().replace(/:/g, '')}`;
  const [cameraReadyTick, setCameraReadyTick] = useState(0);
  const controlsRef = useRef<{ stop: () => void | Promise<void>; switchTorch?: (on: boolean) => Promise<void> } | null>(
    null
  );
  const lastEmitRef = useRef<{ raw: string; t: number }>({ raw: '', t: 0 });
  const enableTorchRef = useRef(!!enableTorch);
  enableTorchRef.current = !!enableTorch;

  const onCameraReady = useCallback(() => {
    setCameraReadyTick((t) => t + 1);
  }, []);

  const emitScan = useCallback(
    (data: string, formatLabel: string) => {
      if (!onBarcodeScanned) return;
      const now = Date.now();
      if (data === lastEmitRef.current.raw && now - lastEmitRef.current.t < 320) return;
      lastEmitRef.current = { raw: data, t: now };
      const payload: BarcodeScanningResult = {
        data,
        type: formatLabel,
        ...emptyScanResult(),
      };
      onBarcodeScanned(payload);
    },
    [onBarcodeScanned]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!active || !onBarcodeScanned || cameraReadyTick === 0) {
      void Promise.resolve(controlsRef.current?.stop()).then(() => {
        controlsRef.current = null;
      });
      return;
    }

    const reader = new BrowserMultiFormatReader(hints, {
      tryPlayVideoTimeout: 15000,
      delayBetweenScanAttempts: 90,
    });

    let cancelled = false;
    let raf = 0;
    let attempt = 0;

    const startDecode = (video: HTMLVideoElement) => {
      if (cancelled) return;
      reader
        .decodeFromVideoElement(video, (result) => {
          if (cancelled || !result) return;
          emitScan(result.getText(), String(result.getBarcodeFormat()));
        })
        .then((controls) => {
          if (cancelled) {
            void Promise.resolve(controls.stop());
            return;
          }
          controlsRef.current = controls;
          if (enableTorchRef.current && controls.switchTorch) {
            void controls.switchTorch(true);
          }
        })
        .catch(() => {
          /* ZXing failed to attach to video */
        });
    };

    const tryFindVideo = () => {
      if (cancelled) return;
      const host = resolveHostEl(hostRef, hostDomId);
      const video = queryVideoInHost(host);
      if (video && (video.readyState >= 2 || video.srcObject)) {
        startDecode(video);
        return;
      }
      attempt += 1;
      if (attempt < 90) {
        raf = requestAnimationFrame(tryFindVideo);
      }
    };

    raf = requestAnimationFrame(tryFindVideo);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      void Promise.resolve(controlsRef.current?.stop()).then(() => {
        controlsRef.current = null;
      });
    };
  }, [active, onBarcodeScanned, emitScan, cameraReadyTick, hostDomId]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c?.switchTorch) return;
    void c.switchTorch(!!enableTorch);
  }, [enableTorch]);

  return (
    <View ref={hostRef} nativeID={hostDomId} style={[styles.host, style]} collapsable={false}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        active={active}
        zoom={zoom}
        enableTorch={enableTorch}
        onCameraReady={onCameraReady}
        /* No onBarcodeScanned: expo web would only run jsQR for QR. ZXing handles all symbologies. */
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});
