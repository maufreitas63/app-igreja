/**
 * Cores progressivas dos selos da Trilha de Discipulado (passos 1–5).
 * Espelha public.discipleship_badge_color_for_step no SQL.
 */

export const DISCIPLESHIP_STEP_BADGE_META: Record<
  1 | 2 | 3 | 4 | 5,
  { color: string; label: string; meaning: string }
> = {
  1: {
    color: '#0EA5E9',
    label: 'Boas-Vindas',
    meaning: 'Acolhimento e segurança',
  },
  2: {
    color: '#059669',
    label: 'Fundamentos',
    meaning: 'Crescimento e vida nova',
  },
  3: {
    color: '#1E3A8A',
    label: 'Batismo',
    meaning: 'Solenidade e águas do batismo',
  },
  4: {
    color: '#EA580C',
    label: 'Comunhão',
    meaning: 'Calor humano e comunidade',
  },
  5: {
    color: '#C9A227',
    label: 'Serviço',
    meaning: 'Maturidade, honra e conclusão',
  },
};

export const DISCIPLESHIP_LOCKED_BADGE_COLOR = '#94A3B8';
export const DISCIPLESHIP_TRAIL_GOLD_COLOR = '#C9A227';

export function discipleshipBadgeColorForStep(stepOrder: number | null | undefined): string {
  const step = Number(stepOrder);
  if (step >= 1 && step <= 5) {
    return DISCIPLESHIP_STEP_BADGE_META[step as 1 | 2 | 3 | 4 | 5].color;
  }
  return DISCIPLESHIP_LOCKED_BADGE_COLOR;
}

export function discipleshipStepMeta(stepOrder: number | null | undefined) {
  const step = Number(stepOrder);
  if (step >= 1 && step <= 5) {
    return DISCIPLESHIP_STEP_BADGE_META[step as 1 | 2 | 3 | 4 | 5];
  }
  return null;
}
