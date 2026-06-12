import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
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
import { formatShortName } from '@/lib/formatShortName';
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
  scalePanelAccess: {},
  canAccessPastoralCare: false,
  canAccessPastoralRoleChange: false,
  headerUserName: null,
};

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

  try {
    let profileId = await getStoredProfileId();

    if (!profileId) {
      profileId = await repairUserSessionReference();
    }

    if (profileId) {
      [scalePanelAccess, canAccessPastoralCare, canAccessPastoralRoleChange] = await Promise.all([
        loadMaintenanceScalePanelAccess(profileId),
        loadPastoralCarePanelAccess(profileId),
        sessionCanAccessPastoralRoleChangePanel(),
      ]);
    }
  } catch {
    scalePanelAccess = {};
    canAccessPastoralCare = false;
    canAccessPastoralRoleChange = false;
  }

  let headerUserName: string | null = null;

  try {
    const phone = await getStoredUserPhone();

    if (phone) {
      const sessionProfile = await loadSessionProfile(phone);
      const profileName = sessionProfile?.full_name?.trim();

      if (profileName) {
        headerUserName = formatShortName(profileName);
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
