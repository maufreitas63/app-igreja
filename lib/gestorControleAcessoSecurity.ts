/**
 * Segurança do papel Gestor em Controle de Acesso.
 *
 * Proteção aplicada: Gestor não tem visibilidade do Super Administrador
 *
 * A camada autoritativa é o SQL (`assert_gestor_super_admin_shield` e
 * filtros WHERE nas RPCs). Este módulo espelha regras no cliente para
 * UX e prevenção de chamadas desnecessárias.
 */

export const GESTOR_CONTROLE_ACESSO_ROLE_CODE = 'gestor_controle_acesso';

/** Papel oculto/protegido para o Gestor (listagens e atribuições). */
export const SUPER_ADMIN_ROLE_CODE = 'super_admin';

/** Papéis que o Gestor nunca deve ver nem atribuir na UI. */
export const ACCESS_ROLES_HIDDEN_FROM_GESTOR = [SUPER_ADMIN_ROLE_CODE] as const;

/** Recursos de coluna bloqueados (PIN/senha). */
export const GESTOR_BLOCKED_COLUMN_RESOURCE_FRAGMENTS = [
  'access_pin',
  'password',
  'senha',
] as const;

export function isSuperAdminRoleCode(roleCode: string | null | undefined): boolean {
  return (roleCode ?? '').trim().toLowerCase() === SUPER_ADMIN_ROLE_CODE;
}

export function isGestorControleAcessoRoleCode(roleCode: string | null | undefined): boolean {
  return (roleCode ?? '').trim().toLowerCase() === GESTOR_CONTROLE_ACESSO_ROLE_CODE;
}

/** Proteção aplicada: Gestor não tem visibilidade do Super Administrador */
export function isRoleVisibleToAccessActor(
  roleCode: string,
  actorIsSuperAdmin: boolean
): boolean {
  if (actorIsSuperAdmin) {
    return true;
  }

  return !isSuperAdminRoleCode(roleCode);
}

/** Proteção aplicada: Gestor não tem visibilidade do Super Administrador */
export function isColumnResourceAllowedForAccessActor(
  resourceKey: string,
  actorIsSuperAdmin: boolean
): boolean {
  if (actorIsSuperAdmin) {
    return true;
  }

  const key = resourceKey.trim().toLowerCase();
  return !GESTOR_BLOCKED_COLUMN_RESOURCE_FRAGMENTS.some((fragment) => key.includes(fragment));
}
