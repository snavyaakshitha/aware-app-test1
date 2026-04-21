import type { BarcodeType } from 'expo-camera';

/**
 * Retail / Open Food Facts–oriented symbologies. Kept focused so native ML Kit
 * spends less time on formats we never need.
 */
export const PRODUCT_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'qr',
];
