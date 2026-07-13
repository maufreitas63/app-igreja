import type { Href } from 'expo-router';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';

export const EVENT_CONTROL_ID = 1;

/** Rotas exibidas no painel do orquestrador. */
export const EVENT_ORCHESTRATION_LEADER_ROUTE_CODES = [
  '/home',
  '/ofertas_dizimos',
  '/avisos',
] as const;

/** Rotas legadas ainda aceitas no banco (event_control). */
export const EVENT_ORCHESTRATION_LEGACY_ROUTE_CODES = ['/ofertas', '/dizimos'] as const;

export const EVENT_ORCHESTRATION_ROUTE_CODES = [
  ...EVENT_ORCHESTRATION_LEADER_ROUTE_CODES,
  ...EVENT_ORCHESTRATION_LEGACY_ROUTE_CODES,
] as const;

export type EventOrchestrationLeaderRouteCode =
  (typeof EVENT_ORCHESTRATION_LEADER_ROUTE_CODES)[number];

export type EventOrchestrationRouteCode = (typeof EVENT_ORCHESTRATION_ROUTE_CODES)[number];

export type EventOrchestrationTarget = {
  code: EventOrchestrationLeaderRouteCode;
  label: string;
  href: Href;
  pathSignature: string;
};

const OFFERINGS_HREF: Href = {
  pathname: '/ofertas',
  params: withMinimalPresentation(),
};

const OFFERINGS_PATH_SIGNATURE = '/ofertas';

export const EVENT_ORCHESTRATION_TARGETS: Record<
  EventOrchestrationLeaderRouteCode,
  EventOrchestrationTarget
> = {
  '/home': {
    code: '/home',
    label: 'Home',
    href: '/(tabs)',
    pathSignature: '/(tabs)',
  },
  '/ofertas_dizimos': {
    code: '/ofertas_dizimos',
    label: 'Ofertas / Dízimos',
    href: OFFERINGS_HREF,
    pathSignature: OFFERINGS_PATH_SIGNATURE,
  },
  '/avisos': {
    code: '/avisos',
    label: 'Avisos',
    href: '/avisos',
    pathSignature: '/avisos',
  },
};

export const normalizeEventOrchestrationRouteCode = (
  value: string | null | undefined
): EventOrchestrationLeaderRouteCode | null => {
  const normalized = (value ?? '').trim().toLowerCase();

  if (normalized === '/ofertas' || normalized === '/dizimos') {
    return '/ofertas_dizimos';
  }

  if (
    EVENT_ORCHESTRATION_LEADER_ROUTE_CODES.includes(
      normalized as EventOrchestrationLeaderRouteCode
    )
  ) {
    return normalized as EventOrchestrationLeaderRouteCode;
  }

  return null;
};

export const isEventOrchestrationRouteCode = (
  value: string | null | undefined
): value is EventOrchestrationRouteCode =>
  EVENT_ORCHESTRATION_ROUTE_CODES.includes(value as EventOrchestrationRouteCode);

export const resolveEventOrchestrationTarget = (activeRoute: string | null | undefined) => {
  const normalized = normalizeEventOrchestrationRouteCode(activeRoute);

  if (!normalized) {
    return null;
  }

  return EVENT_ORCHESTRATION_TARGETS[normalized];
};

export const buildEventOrchestrationPathSignature = (
  pathname: string,
  params: Record<string, string | string[] | undefined>,
  segments: string[] = []
) => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  // Web/PWA: índice autenticado em `(tabs)` pode expor pathname `/` ou `/index`.
  if (
    segments[0] === '(tabs)'
    && (normalizedPath === '/' || normalizedPath === '/index' || normalizedPath === '/(tabs)/index')
  ) {
    return '/(tabs)';
  }

  if (
    normalizedPath.endsWith('/index')
    || normalizedPath === '/(tabs)'
    || normalizedPath === '/(tabs)/index'
  ) {
    return '/(tabs)';
  }

  if (normalizedPath === '/ofertas') {
    return OFFERINGS_PATH_SIGNATURE;
  }

  if (!normalizedPath.includes('dashboard')) {
    return normalizedPath;
  }

  const card = String(params.dashboardCard ?? params.dashboardCardParam ?? '').trim();

  if (card === '3' || card === 'offerings') {
    return OFFERINGS_PATH_SIGNATURE;
  }

  return '/(tabs)/dashboard';
};
