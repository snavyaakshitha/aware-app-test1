import { Dimensions, Platform } from 'react-native';

/** Matches `FIGMA_W` / `FIGMA_H` in theme — safe default during SSR / `expo export`. */
const DEFAULT = { width: 393, height: 852 };

/**
 * Window size for responsive `s()` scaling. On web during static export there is no `window`;
 * we fall back to the Figma base so the bundle builds and first paint is stable.
 */
export function getWindowDimensions(): { width: number; height: number } {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth || DEFAULT.width,
        height: window.innerHeight || DEFAULT.height,
      };
    }
    return DEFAULT;
  }

  const { width, height } = Dimensions.get('window');
  return {
    width: width > 0 ? width : DEFAULT.width,
    height: height > 0 ? height : DEFAULT.height,
  };
}
