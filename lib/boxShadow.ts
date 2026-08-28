import type { ViewStyle } from 'react-native';

type BoxShadowInput = {
  color: string;
  offsetX?: number;
  offsetY?: number;
  blurRadius?: number;
  opacity?: number;
  elevation?: number;
};

function colorWithOpacity(color: string, opacity: number): string {
  const trimmed = color.trim();
  const func = trimmed.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i);

  if (func) {
    return `rgba(${func[1]}, ${func[2]}, ${func[3]}, ${opacity})`;
  }

  const hex = trimmed.replace('#', '');
  const normalized =
    hex.length === 3 ? hex.split('').map((char) => `${char}${char}`).join('') : hex;

  if (normalized.length < 6 || Number.isNaN(parseInt(normalized.slice(0, 2), 16))) {
    return `rgba(0, 0, 0, ${opacity})`;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Sombra no formato `boxShadow` (RN 0.81 / RN Web). Substitui `shadow*`. */
export function boxShadowStyle({
  color,
  offsetX = 0,
  offsetY = 0,
  blurRadius = 0,
  opacity = 1,
  elevation,
}: BoxShadowInput): ViewStyle {
  return {
    ...(elevation != null ? { elevation } : {}),
    boxShadow: `${offsetX}px ${offsetY}px ${blurRadius}px ${colorWithOpacity(color, opacity)}`,
  };
}

export const NO_BOX_SHADOW: ViewStyle = {
  boxShadow: 'none',
  elevation: 0,
};
