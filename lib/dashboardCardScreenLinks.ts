import { ACCESS_SCREEN } from '@/lib/accessControl';

/** `id` ou `content` do card → `content` usado no carrossel e na ACL. */
export const DASHBOARD_CARD_PARAM_TO_CONTENT: Record<string, string> = {
  '1': 'event_alt',
  '2': 'qr',
  qr: 'qr',
  '3': 'offerings',
  '4': 'kids_teens',
  '5': 'pastoral',
  '6': 'grouped_manage',
  '7': 'birthdays',
  '8': 'vigilance_scales',
  '9': 'parking_vehicle_v2',
  '10': 'members_list',
  '11': 'financial',
  '12': 'scale_roster',
  event_alt: 'event_alt',
  kids_teens: 'kids_teens',
  offerings: 'offerings',
  pastoral: 'pastoral',
  members_list: 'members_list',
  birthdays: 'birthdays',
  financial: 'financial',
  vigilance_scales: 'vigilance_scales',
  parking_vehicle_v2: 'parking_vehicle_v2',
  grouped_manage: 'grouped_manage',
  scale_roster: 'scale_roster',
};

/** Cards do dashboard que abrem telas filhas — exigem permissão da rota além do card. */
export const DASHBOARD_CARD_LINKED_SCREEN: Partial<Record<string, string>> = {
  pastoral: ACCESS_SCREEN.pastoral,
  financial: ACCESS_SCREEN.financial,
};

export const DASHBOARD_CARD_BLOCKED_MESSAGES: Partial<Record<string, string>> = {
  pastoral: 'Você não tem permissão para abrir o Coração Aberto.',
  financial: 'Você não tem permissão para abrir o módulo financeiro.',
  vigilance_scales: 'Você não tem permissão para abrir Escalas.',
  parking_vehicle_v2: 'Você não tem permissão para abrir o painel de estacionamento.',
  grouped_manage: 'Você não tem permissão para abrir Dados Cadastrais.',
  members_list: 'Você não tem permissão para abrir a Lista de Membros.',
  event_alt: 'Você não tem permissão para abrir a Agenda da Família.',
};

export const resolveDashboardCardContentFromParam = (cardParam?: string | null) => {
  const trimmed = cardParam?.trim() ?? '';

  if (!trimmed) {
    return null;
  }

  return DASHBOARD_CARD_PARAM_TO_CONTENT[trimmed] ?? trimmed;
};
