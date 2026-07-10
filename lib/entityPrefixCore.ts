export const PARM_ENTIDADE_PARAMETER = 'Parm_entidade';

/**
 * Fallback técnico neutro quando ainda não há Parm_entidade / código da instância.
 * Não usar nome de uma igreja específica (ex.: IBN).
 */
export const DEFAULT_ENTITY_PREFIX = '';

/** Último recurso para IDs de família se nada estiver configurado. */
export const FALLBACK_ENTITY_PREFIX = 'APP';

/** Mesma regra do SQL `get_family_id_prefix`: apenas alfanumérico, maiúsculas. */
export function normalizeEntityPrefix(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function resolveEntityPrefixOrFallback(raw: string | null | undefined): string {
  return normalizeEntityPrefix(raw) || FALLBACK_ENTITY_PREFIX;
}

export function buildFamilyId(prefix: string, num: number): string {
  const safe = resolveEntityPrefixOrFallback(prefix);
  return `${safe}${String(num).padStart(4, '0')}`;
}

export const DEFAULT_FAMILY_ID = buildFamilyId(FALLBACK_ENTITY_PREFIX, 1);

/** Rótulo exibido nas telas (códigos internos permanecem KIDS / kids_room). */
export const KIDS_ROOM_DISPLAY_LABEL = 'Infantil';

/** Rótulo exibido nas telas (códigos internos permanecem TEENS / teens_room). */
export const TEENS_ROOM_DISPLAY_LABEL = 'Jovens';

function withPrefix(prefix: string, label: string): string {
  const trimmed = normalizeEntityPrefix(prefix);
  return trimmed ? `${trimmed} ${label}` : label;
}

export function buildKidsRoomLabel(prefix: string): string {
  return withPrefix(prefix, KIDS_ROOM_DISPLAY_LABEL);
}

export function buildTeensRoomLabel(prefix: string): string {
  return withPrefix(prefix, TEENS_ROOM_DISPLAY_LABEL);
}

export function buildKidsRoomBadgeLabel(prefix: string): string {
  return withPrefix(prefix, KIDS_ROOM_DISPLAY_LABEL);
}

export function buildTeensRoomBadgeLabel(prefix: string): string {
  return withPrefix(prefix, TEENS_ROOM_DISPLAY_LABEL);
}

export function buildNewFamilyRecordingHint(prefix: string): string {
  const trimmed = normalizeEntityPrefix(prefix);
  return trimmed ? `novo (${trimmed} na gravação)` : 'novo (na gravação)';
}
