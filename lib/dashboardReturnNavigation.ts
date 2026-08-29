import type { Href } from 'expo-router';
import { resolvePublishedDashboardHref } from '@/lib/frozenPublication';

export const RETURN_DASHBOARD_CARD_PARAM = 'returnDashboardCard';
export const RETURN_ROUTE_PARAM = 'returnRoute';
export const PRESENTATION_PARAM = 'presentation';
export const MINIMAL_PRESENTATION_VALUE = 'minimal';
export const LEGACY_PRESENTATION_VALUE = 'legacy';

export const pickRouteParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
};

export const isMinimalPresentationRoute = (
  presentation: string | string[] | undefined
) => pickRouteParam(presentation) !== LEGACY_PRESENTATION_VALUE;

export const withMinimalPresentation = (
  params: Record<string, string> = {}
): Record<string, string> => ({
  ...params,
  [PRESENTATION_PARAM]: MINIMAL_PRESENTATION_VALUE,
});

export const resolveReturnDashboardCardParam = (
  params: Record<string, string | string[] | undefined>
): string | null => pickRouteParam(params[RETURN_DASHBOARD_CARD_PARAM]);

export const resolveReturnRouteParam = (
  params: Record<string, string | string[] | undefined>
): string | null => pickRouteParam(params[RETURN_ROUTE_PARAM]);

export const withReturnRoute = (
  returnRoute: string,
  params: Record<string, string> = {}
): Record<string, string> =>
  withMinimalPresentation({
    ...params,
    [RETURN_ROUTE_PARAM]: returnRoute,
  });

export const withReturnDashboardCard = (
  returnDashboardCard: string,
  params: Record<string, string> = {}
): Record<string, string> =>
  withMinimalPresentation({
    ...params,
    [RETURN_DASHBOARD_CARD_PARAM]: returnDashboardCard,
  });

export const buildReturnToDashboardHref = (
  dashboardCard: string,
  extraParams?: Record<string, string | undefined>
): Href => resolvePublishedDashboardHref(dashboardCard, extraParams);
