import type { Href } from 'expo-router';

/** Query para abrir a Agenda da Família no Início (única tela do membro). */
export const OPEN_FAMILY_AGENDA_PARAM = 'openAgenda';
export const OPEN_FAMILY_AGENDA_NONCE_PARAM = 'openAgendaNonce';

export const isFamilyAgendaDashboardCardParam = (value?: string | null) => {
  const normalized = (value ?? '').trim();
  return normalized === '1' || normalized === 'event_alt';
};

export const isOpenFamilyAgendaParam = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'sim';
};

/** Início com a Agenda da Família aberta (substitui o card do Painel). */
export const buildFamilyAgendaHomeHref = (): Href => ({
  pathname: '/(tabs)',
  params: {
    [OPEN_FAMILY_AGENDA_PARAM]: '1',
    [OPEN_FAMILY_AGENDA_NONCE_PARAM]: String(Date.now()),
  },
});
