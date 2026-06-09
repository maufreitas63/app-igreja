/**
 * Espelho da função SQL `access_role_display_order` (script canônico:
 * scripts/access-control-role-display-order.sql). Manter sincronizado ao alterar a ordem.
 */
export const ACCESS_ROLE_DISPLAY_ORDER = [
  'visitantes',
  'congregado',
  'member',
  'family_acceptor',
  'lider',
  'events_admin',
  'pastoral',
  'super_admin',
] as const;

export type AccessRoleDisplayCode = (typeof ACCESS_ROLE_DISPLAY_ORDER)[number];

export const accessRoleDisplayRank = (roleCode: string): number => {
  const normalized = roleCode.trim().toLowerCase();
  const index = ACCESS_ROLE_DISPLAY_ORDER.indexOf(normalized as AccessRoleDisplayCode);

  return index >= 0 ? index : ACCESS_ROLE_DISPLAY_ORDER.length + 1;
};
