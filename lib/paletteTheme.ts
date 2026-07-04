import type { DashboardCardTheme } from '@/lib/dashboardCardThemes';
import type { PaletaColors } from '@/lib/paletasTypes';

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return null;
  }

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);

  if (!rgb) {
    return hex;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function darkenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex);

  if (!rgb) {
    return hex;
  }

  const factor = 1 - Math.min(Math.max(amount, 0), 1);

  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);

  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function buildIndexScreenGradient(colors: PaletaColors): [string, string] {
  if (colors.isLight) {
    return [colors.background, colors.secondary || colors.background];
  }

  return [colors.secondary, colors.background];
}

export function buildDashboardScreenGradient(colors: PaletaColors): [string, string, string] {
  if (colors.isLight) {
    return [colors.background, colors.background, colors.secondary || colors.background];
  }

  return [colors.secondary, colors.background, darkenHex(colors.background, 0.35)];
}

/** Tema de superfície (cards, rodapés) derivado da paleta ativa. */
export function buildPaletteSurfaceTheme(colors: PaletaColors): DashboardCardTheme {
  if (colors.isLight) {
    return {
      backgroundColor: '#FFFFFF',
      borderColor: colors.border,
      shadowColor: colors.primary,
      accent: colors.text,
      accentMuted: colors.textMuted,
    };
  }

  return {
    backgroundColor: hexToRgba(colors.primary, 0.2),
    borderColor: colors.accent,
    shadowColor: colors.primary,
    accent: colors.accent,
    accentMuted: hexToRgba(colors.accent, 0.82),
  };
}
