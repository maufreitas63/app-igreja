export const PARM_ENTIDADE_PARAMETER = 'Parm_entidade';

/** Fallback quando `Parm_entidade` ainda não foi carregado ou está vazio. */
export const DEFAULT_ENTITY_PREFIX = 'IBN';

/** Mesma regra do SQL `get_family_id_prefix`: apenas alfanumérico, maiúsculas. */
export function normalizeEntityPrefix(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : DEFAULT_ENTITY_PREFIX;
}

export function buildFamilyId(prefix: string, num: number): string {
  return `${prefix}${String(num).padStart(4, '0')}`;
}

export const DEFAULT_FAMILY_ID = buildFamilyId(DEFAULT_ENTITY_PREFIX, 1);

/** Rótulo exibido nas telas (códigos internos permanecem KIDS / kids_room). */
export const KIDS_ROOM_DISPLAY_LABEL = 'Infantil';

/** Rótulo exibido nas telas (códigos internos permanecem TEENS / teens_room). */
export const TEENS_ROOM_DISPLAY_LABEL = 'Jovens';

export function buildKidsRoomLabel(prefix: string): string {
  return `${prefix} ${KIDS_ROOM_DISPLAY_LABEL}`;
}

export function buildTeensRoomLabel(prefix: string): string {
  return `${prefix} ${TEENS_ROOM_DISPLAY_LABEL}`;
}

export function buildKidsRoomBadgeLabel(prefix: string): string {
  return `${prefix} ${KIDS_ROOM_DISPLAY_LABEL}`;
}

export function buildTeensRoomBadgeLabel(prefix: string): string {
  return `${prefix} ${TEENS_ROOM_DISPLAY_LABEL}`;
}

export function buildNewFamilyRecordingHint(prefix: string): string {
  return `novo (${prefix} na gravação)`;
}
