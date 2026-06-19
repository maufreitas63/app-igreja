import type { Paleta } from '@/lib/paletasTypes';

/** Fallback local quando Supabase ainda não tem a tabela `paletas` ou está offline. */
export const DEFAULT_PALETA_PADRAO: Paleta = {
  id: '00000000-0000-4000-8000-000000000001',
  nome: 'Padrão',
  primary_color: '#10B981',
  secondary_color: '#0F172A',
  bg_color: '#020617',
  accent_color: '#34D399',
  is_active: true,
  created_at: '1970-01-01T00:00:00.000Z',
};

export const DEFAULT_PALETAS_CATALOG: Paleta[] = [
  DEFAULT_PALETA_PADRAO,
  {
    id: '00000000-0000-4000-8000-000000000002',
    nome: 'Acolhimento',
    primary_color: '#FB7185',
    secondary_color: '#FFF7ED',
    bg_color: '#1E293B',
    accent_color: '#FDA4AF',
    is_active: false,
    created_at: '1970-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    nome: 'Tecnológico',
    primary_color: '#06B6D4',
    secondary_color: '#164E63',
    bg_color: '#0F172A',
    accent_color: '#22D3EE',
    is_active: false,
    created_at: '1970-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    nome: 'Serenidade',
    primary_color: '#818CF8',
    secondary_color: '#312E81',
    bg_color: '#1E1B4B',
    accent_color: '#A5B4FC',
    is_active: false,
    created_at: '1970-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    nome: 'Minimalista',
    primary_color: '#94A3B8',
    secondary_color: '#334155',
    bg_color: '#0F172A',
    accent_color: '#E2E8F0',
    is_active: false,
    created_at: '1970-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    nome: 'Vibrante',
    primary_color: '#FBBF24',
    secondary_color: '#B45309',
    bg_color: '#1C1917',
    accent_color: '#FCD34D',
    is_active: false,
    created_at: '1970-01-01T00:00:00.000Z',
  },
];
