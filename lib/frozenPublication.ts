import type { Href } from 'expo-router';
import { resolveDashboardCardContentFromParam } from '@/lib/dashboardCardScreenLinks';
import { buildFamilyAgendaHomeHref } from '@/lib/familyAgendaNavigation';

/**
 * Telas e cards do Painel antigo que saíram do caminho de uso atual.
 * O código permanece no repositório; não publicar, não reconectar, não alterar
 * até instrução explícita de descongelar.
 * Implementação antiga (não executada): `lib/frozen-dashboard-cards.comment.ts`.
 */
export const FROZEN_DASHBOARD_CARD_CONTENTS = [
  'event_alt',
  'qr',
  'kids_teens',
  'offerings',
  'pastoral',
  'members_list',
  'birthdays',
  'financial',
  'vigilance_scales',
  'parking_vehicle_v2',
  'scale_roster',
  'grouped_manage',
  'administrativo',
  'campaign_card',
] as const;

/** Ainda hospedados em `/(tabs)/dashboard` (menu membro) até tela própria. */
export const LIVE_DASHBOARD_CARD_CONTENTS = [
  'small_group',
  'opportunity_mural_card',
] as const;

export const FROZEN_ROUTES = ['/(tabs)/explore', '/explore'] as const;

export type FrozenDashboardCardContent = (typeof FROZEN_DASHBOARD_CARD_CONTENTS)[number];
export type LiveDashboardCardContent = (typeof LIVE_DASHBOARD_CARD_CONTENTS)[number];

export function isFrozenDashboardCardContent(
  content: string | null | undefined
): content is FrozenDashboardCardContent {
  return (FROZEN_DASHBOARD_CARD_CONTENTS as readonly string[]).includes(content ?? '');
}

export function isLiveDashboardCardContent(
  content: string | null | undefined
): content is LiveDashboardCardContent {
  return (LIVE_DASHBOARD_CARD_CONTENTS as readonly string[]).includes(content ?? '');
}

export function isFrozenRoute(pathname: string | null | undefined): boolean {
  return (FROZEN_ROUTES as readonly string[]).includes(pathname ?? '');
}

function liveScreenParams(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra, presentation: 'minimal' };
}

function compactParams(extra?: Record<string, string | undefined>): Record<string, string> {
  const next: Record<string, string> = {};

  if (!extra) {
    return next;
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      next[key] = value;
    }
  }

  return next;
}

const MEMBER_HOME_HREF: Href = {
  pathname: '/(tabs)',
  params: liveScreenParams(),
};

/**
 * Deep link de card congelado → tela viva equivalente, ou Início se não houver substituta.
 */
export function resolveFrozenDashboardDeepLink(
  contentOrParam: string,
  extraParams?: Record<string, string | undefined>
): Href {
  const content = resolveDashboardCardContentFromParam(contentOrParam) ?? contentOrParam;
  const extra = compactParams(extraParams);

  switch (content) {
    case 'event_alt':
      return buildFamilyAgendaHomeHref();
    case 'offerings':
      return { pathname: '/ofertas', params: liveScreenParams(extra) };
    case 'campaign_card':
      return {
        pathname: '/ofertas',
        params: liveScreenParams({
          campaignContribute: extra.campaignContribute ?? '1',
          ...extra,
        }),
      };
    case 'pastoral':
      return { pathname: '/pastoral', params: liveScreenParams(extra) };
    case 'grouped_manage':
      return { pathname: '/perfil', params: liveScreenParams(extra) };
    case 'birthdays':
      return { pathname: '/aniversariantes', params: liveScreenParams(extra) };
    case 'vigilance_scales':
      return { pathname: '/escalas', params: liveScreenParams(extra) };
    case 'members_list':
      return { pathname: '/membros', params: liveScreenParams(extra) };
    case 'financial':
      return { pathname: '/financial', params: liveScreenParams(extra) };
    case 'administrativo':
      return { pathname: '/administrativo', params: liveScreenParams(extra) };
    default:
      return MEMBER_HOME_HREF;
  }
}

export function resolvePublishedDashboardHref(
  dashboardCard: string | null | undefined,
  extraParams?: Record<string, string | undefined>
): Href {
  if (!dashboardCard) {
    return MEMBER_HOME_HREF;
  }

  const content = resolveDashboardCardContentFromParam(dashboardCard) ?? dashboardCard;

  if (isLiveDashboardCardContent(content)) {
    const params = liveScreenParams({
      dashboardCard: content,
      dashboardCardNonce: String(Date.now()),
      ...compactParams(extraParams),
    });

    return {
      pathname: '/(tabs)/dashboard',
      params,
    };
  }

  return resolveFrozenDashboardDeepLink(content, extraParams);
}
