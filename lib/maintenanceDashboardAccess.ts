import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
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
import { formatProfileShortName, loadNomeFantasiaPreference } from '@/lib/profileDisplayName';
import { loadSessionProfile } from '@/lib/loadSessionProfile';
import {
  getStoredProfileId,
  getStoredUserPhone,
  repairUserSessionReference,
} from '@/lib/userSession';

export type MaintenanceDashboardAccessSnapshot = {
  allowed: boolean;
  isSuperAdmin: boolean;
  canOpenAccessControlCard: boolean;
  canMonitorFamilyReception: boolean;
  canAccessProfileCadastro: boolean;
  canUpdateMaintenanceEvents: boolean;
  maintenancePanelAccess: Record<string, boolean>;
  scalePanelAccess: Partial<Record<MaintenanceScalePanelContent, boolean>>;
  canAccessPastoralCare: boolean;
  canAccessPastoralRoleChange: boolean;
  headerUserName: string | null;
};

const EMPTY_SNAPSHOT: MaintenanceDashboardAccessSnapshot = {
  allowed: false,
  isSuperAdmin: false,
  canOpenAccessControlCard: false,
  canMonitorFamilyReception: false,
  canAccessProfileCadastro: false,
  canUpdateMaintenanceEvents: false,
  maintenancePanelAccess: {},
  scalePanelAccess: {},
  canAccessPastoralCare: false,
  canAccessPastoralRoleChange: false,
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

  try {
    let profileId = await getStoredProfileId();

    if (!profileId) {
      profileId = await repairUserSessionReference();
    }

    if (profileId) {
      [
        scalePanelAccess,
        canAccessPastoralCare,
        canAccessPastoralRoleChange,
        maintenancePanelAccess,
        canUpdateMaintenanceEvents,
      ] = await Promise.all([
        loadMaintenanceScalePanelAccess(profileId),
        loadPastoralCarePanelAccess(profileId),
        sessionCanAccessPastoralRoleChangePanel(),
        loadMaintenancePanelScreenAccess(),
        sessionHasAccess('screen', 'maintenance.card.events', 'update'),
      ]);
    }
  } catch {
    scalePanelAccess = {};
    canAccessPastoralCare = false;
    canAccessPastoralRoleChange = false;
    maintenancePanelAccess = {};
    canUpdateMaintenanceEvents = false;
  }

  let headerUserName: string | null = null;

  try {
    const phone = await getStoredUserPhone();

    if (phone) {
      await loadNomeFantasiaPreference();
      const sessionProfile = await loadSessionProfile(phone);

      if (sessionProfile) {
        headerUserName = formatProfileShortName(sessionProfile);
      }
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
    maintenancePanelAccess,
    scalePanelAccess,
    canAccessPastoralCare,
    canAccessPastoralRoleChange,
    headerUserName,
  };
}

export async function loadMaintenanceDashboardAccess(options?: { forceRefresh?: boolean }) {
  let profileId = await getStoredProfileId();

  if (!profileId) {
    profileId = await repairUserSessionReference();
  }

  return getCachedOrFetch(
    'maintenance:dashboard:access',
    resolveMaintenanceDashboardAccess,
    {
      scopeId: profileId,
      forceRefresh: options?.forceRefresh,
    }
  );
}
