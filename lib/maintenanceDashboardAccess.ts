import {
  ACCESS_SCREEN,
  sessionCanBypassEventPastDateLock as fetchSessionCanBypassEventPastDateLock,
  sessionHasAccess,
} from '@/lib/accessControl';
import { MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY } from '@/lib/screenAccessResourceKeys';
import { getCachedOrFetch } from '@/lib/asyncResultCache';
import {
  checkSessionIsSuperAdmin,
  sessionCanAccessAccessControlPanel,
} from '@/lib/maintenanceAccessControlApi';
import { loadPastoralCarePanelAccess } from '@/lib/pastoralAccess';
import { sessionCanAccessPastoralRoleChangePanel } from '@/lib/pastoralRoleChangeApi';
import {
  loadMaintenanceScalePanelAccess,
  type MaintenanceScalePanelContent,
} from '@/lib/scaleAccess';
import { checkSessionCanOperateGhostMode } from '@/lib/ghostModeApi';
import { formatShortName } from '@/lib/formatShortName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import {
  resolveEffectiveProfileId,
} from '@/lib/sessionProfile';
import {
  getStoredUserPhone,
} from '@/lib/userSession';

export type MaintenanceDashboardAccessSnapshot = {
  allowed: boolean;
  isSuperAdmin: boolean;
  canOpenAccessControlCard: boolean;
  canMonitorFamilyReception: boolean;
  canAccessProfileCadastro: boolean;
  canUpdateMaintenanceEvents: boolean;
  canManageSupportRequests: boolean;
  canBypassEventPastDateLock: boolean;
  maintenancePanelAccess: Record<string, boolean>;
  scalePanelAccess: Partial<Record<MaintenanceScalePanelContent, boolean>>;
  canAccessPastoralCare: boolean;
  canAccessPastoralRoleChange: boolean;
  canOperateGhostMode: boolean;
  headerUserName: string | null;
};

const EMPTY_SNAPSHOT: MaintenanceDashboardAccessSnapshot = {
  allowed: false,
  isSuperAdmin: false,
  canOpenAccessControlCard: false,
  canMonitorFamilyReception: false,
  canAccessProfileCadastro: false,
  canUpdateMaintenanceEvents: false,
  canManageSupportRequests: false,
  canBypassEventPastDateLock: false,
  maintenancePanelAccess: {},
  scalePanelAccess: {},
  canAccessPastoralCare: false,
  canAccessPastoralRoleChange: false,
  canOperateGhostMode: false,
  headerUserName: null,
};

async function loadMaintenancePanelScreenAccess(): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    Object.entries(MAINTENANCE_PANEL_CONTENT_TO_ACCESS_KEY)
      .filter(([content]) => content !== 'menu')
      .map(async ([content, resourceKey]) => {
        const allowed = await sessionHasAccess('screen', resourceKey, 'view');
        return [content, allowed] as const;
      })
  );

  return Object.fromEntries(entries);
}

async function resolveMaintenanceDashboardAccess(): Promise<MaintenanceDashboardAccessSnapshot> {
  const allowed = await sessionHasAccess('screen', ACCESS_SCREEN.maintenance, 'view');

  if (!allowed) {
    return EMPTY_SNAPSHOT;
  }

  let isSuperAdmin = false;
  let canOpenAccessControlCard = false;
  let canAccessProfileCadastro = false;

  try {
    [isSuperAdmin, canOpenAccessControlCard, canAccessProfileCadastro] = await Promise.all([
      checkSessionIsSuperAdmin(),
      sessionCanAccessAccessControlPanel(),
      sessionHasAccess('screen', 'maintenance.card.profile_cadastro', 'view'),
    ]);
  } catch {
    isSuperAdmin = false;
    canOpenAccessControlCard = false;
    canAccessProfileCadastro = false;
  }

  let scalePanelAccess: Partial<Record<MaintenanceScalePanelContent, boolean>> = {};
  let canAccessPastoralCare = false;
  let canAccessPastoralRoleChange = false;
  let maintenancePanelAccess: Record<string, boolean> = {};
  let canUpdateMaintenanceEvents = false;
  let canManageSupportRequests = false;
  let canBypassEventPastDateLock = false;
  let canOperateGhostMode = false;

  try {
    let profileId = await resolveEffectiveProfileId();

    if (profileId) {
      [
        scalePanelAccess,
        canAccessPastoralCare,
        canAccessPastoralRoleChange,
        maintenancePanelAccess,
        canUpdateMaintenanceEvents,
        canManageSupportRequests,
        canBypassEventPastDateLock,
        canOperateGhostMode,
      ] = await Promise.all([
        loadMaintenanceScalePanelAccess(profileId),
        loadPastoralCarePanelAccess(profileId),
        sessionCanAccessPastoralRoleChangePanel(),
        loadMaintenancePanelScreenAccess(),
        sessionHasAccess('screen', 'maintenance.card.events', 'update'),
        sessionHasAccess('screen', 'maintenance.card.suggestions_improvements', 'update'),
        fetchSessionCanBypassEventPastDateLock(),
        checkSessionCanOperateGhostMode(),
      ]);
    }
  } catch {
    scalePanelAccess = {};
    canAccessPastoralCare = false;
    canAccessPastoralRoleChange = false;
    maintenancePanelAccess = {};
    canUpdateMaintenanceEvents = false;
    canManageSupportRequests = false;
    canBypassEventPastDateLock = false;
    canOperateGhostMode = false;
  }

  let headerUserName: string | null = null;

  try {
    const phone = await getStoredUserPhone();
    const sessionProfile = await loadEffectiveSessionProfile(phone);
    const profileName = sessionProfile?.full_name?.trim();

    if (profileName) {
      headerUserName = formatShortName(profileName);
    }
  } catch {
    headerUserName = null;
  }

  return {
    allowed: true,
    isSuperAdmin,
    canOpenAccessControlCard,
    canMonitorFamilyReception: isSuperAdmin || canAccessProfileCadastro,
    canAccessProfileCadastro: isSuperAdmin || canAccessProfileCadastro,
    canUpdateMaintenanceEvents,
    canManageSupportRequests: isSuperAdmin || canManageSupportRequests,
    canBypassEventPastDateLock,
    maintenancePanelAccess,
    scalePanelAccess,
    canAccessPastoralCare,
    canAccessPastoralRoleChange,
    canOperateGhostMode,
    headerUserName,
  };
}

export async function loadMaintenanceDashboardAccess(options?: { forceRefresh?: boolean }) {
  const profileId = await resolveEffectiveProfileId();

  return getCachedOrFetch(
    'maintenance:dashboard:access',
    resolveMaintenanceDashboardAccess,
    {
      scopeId: profileId,
      forceRefresh: options?.forceRefresh,
    }
  );
}
