import {
  ACCESS_SCREEN,
  DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY,
} from '@/lib/accessControl';
import { PASTORAL_CARE_PANEL_RESOURCE } from '@/lib/pastoralAccess';
import {
  MAINTENANCE_SCALE_PANEL_CONTENT_TO_KEY,
  scaleTypeResourceKey,
} from '@/lib/scaleAccess';

/** `content` do carrossel de manutenção → `resource_key` em `access_resources`. */
export const MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY: Record<string, string> = {
  menu: ACCESS_SCREEN.maintenance,
  events: 'maintenance.card.events',
  events_gantt: 'maintenance.card.events_gantt',
  sala_monitor: 'maintenance.card.sala_monitor',
  quorum_presence: 'maintenance.card.quorum_presence',
  scale_types: MAINTENANCE_SCALE_PANEL_CONTENT_TO_KEY.scale_types,
  scale_volunteers: MAINTENANCE_SCALE_PANEL_CONTENT_TO_KEY.scale_volunteers,
  scales: MAINTENANCE_SCALE_PANEL_CONTENT_TO_KEY.scales,
  pastoral_care: PASTORAL_CARE_PANEL_RESOURCE,
  financials: 'maintenance.card.financials',
  profile_cadastro: 'maintenance.card.profile_cadastro',
  family_reception: 'maintenance.card.profile_cadastro',
  access_control: 'maintenance.card.access_control',
};

export function resolveDashboardCardAccessResourceKey(
  content: string | null | undefined,
  options?: { scaleTypeCode?: string | null }
): string | null {
  const trimmed = content?.trim() ?? '';

  if (!trimmed) {
    return null;
  }

  if (trimmed === 'scale_roster') {
    const code = options?.scaleTypeCode?.trim() ?? '';

    if (code) {
      return scaleTypeResourceKey(code);
    }

    return DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY.scale_roster ?? null;
  }

  return DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY[trimmed] ?? null;
}

export function resolveMaintenancePanelAccessResourceKey(
  content: string | null | undefined,
  options?: { inEventEditor?: boolean }
): string | null {
  if (options?.inEventEditor) {
    return MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY.events ?? null;
  }

  const trimmed = content?.trim() ?? '';

  if (!trimmed) {
    return null;
  }

  return (
    MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY[trimmed] ?? `maintenance.card.${trimmed}`
  );
}
