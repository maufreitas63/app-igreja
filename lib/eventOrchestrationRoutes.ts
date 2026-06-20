import type { Href } from 'expo-router';

export const EVENT_CONTROL_ID = 1;

export const EVENT_ORCHESTRATION_ROUTE_CODES = [
  '/home',
  '/ofertas',
  '/dizimos',
  '/avisos',
] as const;

export type EventOrchestrationRouteCode = (typeof EVENT_ORCHESTRATION_ROUTE_CODES)[number];

export type EventOrchestrationTarget = {
  code: EventOrchestrationRouteCode;
  label: string;
  href: Href;
  pathSignature: string;
};

const buildDashboardOfferingsHref = (focus: 'ofertas' | 'dizimos'): Href => ({
  pathname: '/(tabs)/dashboard',
  params: {
    dashboardCard: '3',
    dashboardCardNonce: String(Date.now()),
    offeringsFocus: focus,
  },
});

export const EVENT_ORCHESTRATION_TARGETS: Record<
  EventOrchestrationRouteCode,
  EventOrchestrationTarget
> = {
  '/home': {
    code: '/home',
    label: 'Home',
    href: '/(tabs)/index',
    pathSignature: '/(tabs)/index',
  },
  '/ofertas': {
    code: '/ofertas',
    label: 'Ofertas',
    href: buildDashboardOfferingsHref('ofertas'),
    pathSignature: '/(tabs)/dashboard:offerings:ofertas',
  },
  '/dizimos': {
    code: '/dizimos',
    label: 'Dízimos',
    href: buildDashboardOfferingsHref('dizimos'),
    pathSignature: '/(tabs)/dashboard:offerings:dizimos',
  },
  '/avisos': {
    code: '/avisos',
    label: 'Avisos',
    href: '/avisos',
    pathSignature: '/avisos',
  },
};

export const EVENT_ORCHESTRATION_LEADER_BUTTONS = [
  EVENT_ORCHESTRATION_TARGETS['/home'],
  EVENT_ORCHESTRATION_TARGETS['/ofertas'],
  EVENT_ORCHESTRATION_TARGETS['/dizimos'],
  EVENT_ORCHESTRATION_TARGETS['/avisos'],
] as const;

export const isEventOrchestrationRouteCode = (
  value: string | null | undefined
): value is EventOrchestrationRouteCode =>
  EVENT_ORCHESTRATION_ROUTE_CODES.includes(value as EventOrchestrationRouteCode);

export const resolveEventOrchestrationTarget = (activeRoute: string | null | undefined) => {
  const normalized = (activeRoute ?? '').trim().toLowerCase();

  if (isEventOrchestrationRouteCode(normalized)) {
    return EVENT_ORCHESTRATION_TARGETS[normalized];
  }

  return null;
};

export const buildEventOrchestrationPathSignature = (
  pathname: string,
  params: Record<string, string | string[] | undefined>
) => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath.endsWith('/index') || normalizedPath === '/(tabs)') {
    return '/(tabs)/index';
  }

  if (!normalizedPath.includes('dashboard')) {
    return normalizedPath;
  }

  const card = String(params.dashboardCard ?? params.dashboardCardParam ?? '').trim();
  const focus = String(params.offeringsFocus ?? '').trim().toLowerCase();

  if (card === '3' || card === 'offerings') {
    if (focus === 'ofertas' || focus === 'dizimos') {
      return `/(tabs)/dashboard:offerings:${focus}`;
    }

    return '/(tabs)/dashboard:offerings';
  }

  return '/(tabs)/dashboard';
};
