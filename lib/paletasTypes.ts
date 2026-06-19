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
};

export const mapPaletaToColors = (paleta: Pick<Paleta, 'primary_color' | 'secondary_color' | 'bg_color' | 'accent_color'>): PaletaColors => ({
  primary: paleta.primary_color,
  secondary: paleta.secondary_color,
  background: paleta.bg_color,
  accent: paleta.accent_color,
});
