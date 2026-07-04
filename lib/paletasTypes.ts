export type Paleta = {
  id: string;
  nome: string;
  primary_color: string;
  secondary_color: string;
  bg_color: string;
  accent_color: string;
  is_active: boolean;
  created_at: string;
};

export type PaletaColors = {
  primary: string;
  secondary: string;
  background: string;
  accent: string;
  /** Texto padrão (preto em temas claros). */
  text: string;
  /** Texto secundário / muted. */
  textMuted: string;
  /** Cor de borda (azul no tema Basico). */
  border: string;
  /** Tema claro (fundo claro, texto escuro). */
  isLight: boolean;
};

const parseHex = (hex: string): { r: number; g: number; b: number } | null => {
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
};

/** Luminância relativa (0–1). Valores altos = fundo claro. */
export const hexLuminance = (hex: string): number => {
  const rgb = parseHex(hex);

  if (!rgb) {
    return 0;
  }

  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
};

export const isLightPaletteBackground = (bgColor: string) => hexLuminance(bgColor) >= 0.72;

export const mapPaletaToColors = (
  paleta: Pick<Paleta, 'nome' | 'primary_color' | 'secondary_color' | 'bg_color' | 'accent_color'>
): PaletaColors => {
  const isLight = isLightPaletteBackground(paleta.bg_color);
  const isBasico = paleta.nome.trim().toLowerCase() === 'basico';

  return {
    primary: paleta.primary_color,
    secondary: paleta.secondary_color,
    background: paleta.bg_color,
    accent: paleta.accent_color,
    text: isLight ? '#000000' : '#F8FAFC',
    textMuted: isLight ? '#334155' : '#94A3B8',
    border: isBasico || isLight ? paleta.accent_color || '#2563EB' : paleta.accent_color,
    isLight,
  };
};
