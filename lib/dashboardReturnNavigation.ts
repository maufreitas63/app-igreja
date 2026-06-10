import type { Href } from 'expo-router';

export const RETURN_DASHBOARD_CARD_PARAM = 'returnDashboardCard';

export const pickRouteParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
};

export const resolveReturnDashboardCardParam = (
  params: Record<string, string | string[] | undefined>
): string | null => pickRouteParam(params[RETURN_DASHBOARD_CARD_PARAM]);

export const withReturnDashboardCard = (
  returnDashboardCard: string,
  params: Record<string, string> = {}
): Record<string, string> => ({
  ...params,
  [RETURN_DASHBOARD_CARD_PARAM]: returnDashboardCard,
});

export const buildReturnToDashboardHref = (
  dashboardCard: string,
  extraParams?: Record<string, string | undefined>
): Href => {
  const params: Record<string, string> = { dashboardCard };

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) {
        params[key] = value;
      }
    }
  }

  return {
    pathname: '/(tabs)/dashboard',
    params,
  };
};
