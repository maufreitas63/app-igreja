import { formatEventDateOnlyMask } from '@/lib/maintenanceEventForm';

export const MAINTENANCE_SCALES_SQL_HINT =
  'Execute no Supabase: scripts/vigilancia-escalas.sql, scripts/escalas-multi-vagas.sql, scripts/escalas-tipos-maintenance-rpc.sql, scripts/escalas-volunteers-rpc.sql, scripts/escalas-maintenance-rpc.sql, scripts/escalas-integrity-constraints.sql, scripts/escalas-deprecate-legacy-generator.sql e scripts/escalas-apply-cycle-batch.sql. Geração em lote: Gerar ciclo em bloco (transacional).';

export type MaintenanceScaleType = {
  id: string;
  code: string;
  name: string;
};

export type MaintenanceScaleVolunteer = {
  id: string;
  name: string;
  isActive: boolean;
  /** Maior `escalas_log.data_servico` do voluntário neste tipo de escala. */
  lastServiceDate: string | null;
  /** Ordem do ciclo rotativo (`voluntarios_escala.ordem_sequencial`). */
  sequenceOrder: number | null;
};

export type MaintenanceScaleLogEntry = {
  id: string;
  scaleTypeId: string;
  scaleTypeCode: string;
  scaleTypeName: string;
  serviceDate: string;
  volunteerId: string;
  volunteerName: string;
};

export { formatEventDateOnlyMask as formatScaleServiceDateInputMask };

/** Data local YYYY-MM-DD (para comparar com escalas_log.data_servico). */
export const toLocalScaleServiceDateIso = (reference = new Date()) => {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/** Escala de hoje em diante (domingos futuros / corrente). */
export const isUpcomingScaleServiceDate = (isoDate: string, reference = new Date()) => {
  const normalized = isoDate.trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];

  if (!normalized) {
    return false;
  }

  return normalized >= toLocalScaleServiceDateIso(reference);
};

/** Normaliza para YYYY-MM-DD (aceita timestamp ISO do Supabase). */
export const normalizeScaleServiceDateIso = (value: string) => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsed = new Date(trimmed);

  if (!Number.isNaN(parsed.getTime())) {
    return toLocalScaleServiceDateIso(parsed);
  }

  return null;
};

/** Exibição: DD/MM/AAAA */
export const formatScaleServiceDateLabel = (isoDate: string) => {
  const normalized = normalizeScaleServiceDateIso(isoDate);

  if (!normalized) {
    return isoDate.trim() || '—';
  }

  const [year, month, day] = normalized.split('-');

  return `${day}/${month}/${year}`;
};

/** Converte DD/MM/AA ou DD/MM/AAAA para YYYY-MM-DD. */
export const parseScaleServiceDateInput = (value: string): string | null => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  let year = Number.parseInt(match[3], 10);

  if (match[3].length === 2) {
    year += year >= 70 ? 1900 : 2000;
  }

  if (
    [day, month, year].some(Number.isNaN)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return null;
  }

  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year
    || probe.getMonth() !== month - 1
    || probe.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const pickRpcField = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const match = Object.keys(row).find((entry) => entry.toLowerCase() === key.toLowerCase());

    if (match == null || row[match] == null) {
      continue;
    }

    const value = String(row[match]).trim();

    if (value) {
      return value;
    }
  }

  return '';
};

const pickRpcIntegerField = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const match = Object.keys(row).find((entry) => entry.toLowerCase() === key.toLowerCase());

    if (match == null || row[match] == null) {
      continue;
    }

    const raw = row[match];

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.trunc(raw);
    }

    const parsed = Number.parseInt(String(raw).trim(), 10);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeVolunteerRpcRows = (data: unknown): Record<string, unknown>[] => {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
  }

  if (typeof data === 'object') {
    return [data as Record<string, unknown>];
  }

  return [];
};

export const sortMaintenanceScaleVolunteersBySequence = (
  volunteers: MaintenanceScaleVolunteer[]
) =>
  [...volunteers].sort((left, right) => {
    const leftOrder = left.sequenceOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sequenceOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, 'pt-BR');
  });

export const parseMaintenanceScaleVolunteerRows = (data: unknown): MaintenanceScaleVolunteer[] =>
  sortMaintenanceScaleVolunteersBySequence(
    normalizeVolunteerRpcRows(data)
    .map((row) => {
      const id = pickRpcField(row, 'id');
      const name = pickRpcField(row, 'nome');
      const isActiveKey = Object.keys(row).find((entry) => entry.toLowerCase() === 'is_ativo');
      const isActive = isActiveKey == null ? true : row[isActiveKey] !== false;
      const lastServiceDateRaw = pickRpcField(
        row,
        'ultima_data_servico',
        'data_servico',
        'data_ultima_escala'
      );
      const lastServiceDate = lastServiceDateRaw
        ? normalizeScaleServiceDateIso(lastServiceDateRaw) ?? lastServiceDateRaw
        : null;
      const sequenceOrder = pickRpcIntegerField(row, 'ordem_sequencial');

      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        isActive,
        lastServiceDate,
        sequenceOrder,
      } satisfies MaintenanceScaleVolunteer;
    })
    .filter((row): row is MaintenanceScaleVolunteer => row !== null)
  );

export const parseRegisterScaleRpc = (data: unknown) => {
  let payload: unknown = data;

  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return { success: false as const, message: 'Resposta inválida do servidor.' };
    }
  }

  if (!payload || typeof payload !== 'object') {
    return { success: false as const, message: 'Resposta inválida do servidor.' };
  }

  const row = payload as Record<string, unknown>;

  const volunteerId = pickRpcField(row, 'voluntario_id', 'id');
  const sequenceOrder = pickRpcIntegerField(row, 'ordem_sequencial');

  return {
    success: row.success === true || row.success === 'true',
    message: typeof row.message === 'string' ? row.message : undefined,
    volunteerId: volunteerId || undefined,
    sequenceOrder,
  };
};
