import {
  ACCESS_SCREEN,
  checkOperatorIsSuperAdmin,
  profileHasAccess,
} from '@/lib/accessControl';
import { getCachedOrFetch } from '@/lib/asyncResultCache';

export type GroupedManageScreenAccess = {
  manageProfile: boolean;
  manageMembers: boolean;
};

const GROUPED_MANAGE_SCREEN_KEYS = [
  ACCESS_SCREEN.manageProfile,
  ACCESS_SCREEN.manageMembers,
] as const;

export async function loadGroupedManageScreenAccess(
  profileId: string,
  options?: { forceRefresh?: boolean }
): Promise<GroupedManageScreenAccess> {
  if (await checkOperatorIsSuperAdmin(options)) {
    return { manageProfile: true, manageMembers: true };
  }

  const entries = await getCachedOrFetch(
    `dashboard:grouped-manage:${profileId}`,
    async () => {
      const resolved = await Promise.all(
        GROUPED_MANAGE_SCREEN_KEYS.map(async (resourceKey) => {
          const allowed = await profileHasAccess(profileId, 'screen', resourceKey, 'view');
          return [resourceKey, allowed] as const;
        })
      );

      return Object.fromEntries(resolved);
    },
    { scopeId: profileId, forceRefresh: options?.forceRefresh }
  );

  return {
    manageProfile: entries[ACCESS_SCREEN.manageProfile] === true,
    manageMembers: entries[ACCESS_SCREEN.manageMembers] === true,
  };
}
