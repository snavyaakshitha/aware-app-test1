/**
 * Native: expo-camera preview + on-device barcode scanning (ML Kit / Vision).
 */
import { CameraView, type CameraViewProps } from 'expo-camera';

export default function ProductBarcodeCamera(props: CameraViewProps) {
  return <CameraView {...props} />;
}
