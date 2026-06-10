import { profileHasAccess, sessionHasAccess, type AccessAction } from '@/lib/accessControl';
import { normalizeScaleTypeCode } from '@/lib/maintenanceScaleTypesApi';
import { isTstMaxScaleTypeCode } from '@/lib/tstMaxScaleFilter';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';

export const SCALE_PERMITTED_RPC_MISSING = 'SCALE_PERMITTED_RPC_MISSING';

export const MAINTENANCE_SCALE_PANEL = {
  scaleTypes: 'maintenance.card.scale_types',
  scaleVolunteers: 'maintenance.card.scale_volunteers',
  scales: 'maintenance.card.scales',
} as const;

export type MaintenanceScalePanelContent = 'scale_types' | 'scale_volunteers' | 'scales';

export const MAINTENANCE_SCALE_PANEL_CONTENT_TO_KEY: Record<MaintenanceScalePanelContent, string> = {
  scale_types: MAINTENANCE_SCALE_PANEL.scaleTypes,
  scale_volunteers: MAINTENANCE_SCALE_PANEL.scaleVolunteers,
  scales: MAINTENANCE_SCALE_PANEL.scales,
};

export const scaleTypeResourceKey = (code: string) =>
  `scale_type.${normalizeScaleTypeCode(code)}`;

export type PermittedScaleType = {
  id: string;
  code: string;
  name: string;
};

const parsePermittedScaleTypeRows = (data: unknown): PermittedScaleType[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const code = String(record.codigo ?? record.code ?? '').trim();
      const name = String(record.nome ?? record.name ?? '').trim();

      if (!id || !code || !name) {
        return null;
      }

      return { id, code, name } satisfies PermittedScaleType;
    })
    .filter((row): row is PermittedScaleType => row !== null)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
};

export async function fetchPermittedScaleTypes(
  action: AccessAction = 'view',
  profileId?: string | null
): Promise<PermittedScaleType[]> {
  const resolvedProfileId = profileId ?? (await resolveActorProfileId());

  const { data, error } = await supabase.rpc('listar_tipos_escala_permitidos', {
    p_profile_id: resolvedProfileId,
    p_action: action,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('listar_tipos_escala_permitidos')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      const schemaError = new Error(SCALE_PERMITTED_RPC_MISSING);
      schemaError.name = 'ScalePermittedRpcMissing';
      throw schemaError;
    }

    throw error;
  }

  return parsePermittedScaleTypeRows(data);
}

export async function sessionCanAccessScaleType(
  code: string,
  action: AccessAction = 'view'
): Promise<boolean> {
  const resourceKey = scaleTypeResourceKey(code);
  const direct = await sessionHasAccess('screen', resourceKey, action);

  if (direct) {
    return true;
  }

  const permitted = await fetchPermittedScaleTypes(action);
  const normalized = normalizeScaleTypeCode(code);

  return permitted.some((row) => normalizeScaleTypeCode(row.code) === normalized);
}

export async function loadMaintenanceScalePanelAccess(
  profileId: string
): Promise<Record<MaintenanceScalePanelContent, boolean>> {
  const entries = await Promise.all(
    (Object.entries(MAINTENANCE_SCALE_PANEL_CONTENT_TO_KEY) as [MaintenanceScalePanelContent, string][]).map(
      async ([content, resourceKey]) => {
        const allowed = await profileHasAccess(profileId, 'screen', resourceKey, 'view');
        return [content, allowed] as const;
      }
    )
  );

  return Object.fromEntries(entries) as Record<MaintenanceScalePanelContent, boolean>;
}

export type ProfileScaleLeadershipAssignment = {
  scaleTypeId: string;
  scaleTypeCode: string;
  scaleTypeName: string;
  assigned: boolean;
};

const parseLeadershipRows = (data: unknown): ProfileScaleLeadershipAssignment[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const scaleTypeId = String(record.tipo_escala_id ?? record.scaleTypeId ?? '').trim();
      const scaleTypeCode = String(record.tipo_codigo ?? record.scaleTypeCode ?? '').trim();
      const scaleTypeName = String(record.tipo_nome ?? record.scaleTypeName ?? '').trim();

      if (!scaleTypeId || !scaleTypeCode || !scaleTypeName) {
        return null;
      }

      if (isTstMaxScaleTypeCode(scaleTypeCode)) {
        return null;
      }

      return {
        scaleTypeId,
        scaleTypeCode,
        scaleTypeName,
        assigned: record.assigned === true,
      } satisfies ProfileScaleLeadershipAssignment;
    })
    .filter((row): row is ProfileScaleLeadershipAssignment => row !== null);
};

export async function listProfileScaleLeadershipAdmin(targetProfileId: string) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_liderancas_escala_admin', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
  });

  if (error) {
    throw error;
  }

  return parseLeadershipRows(data);
}

export async function saveProfileScaleLeadershipAdmin(
  targetProfileId: string,
  scaleTypeId: string,
  assigned: boolean
) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('salvar_lideranca_escala_admin', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
    p_tipo_escala_id: scaleTypeId,
    p_assigned: assigned,
  });

  if (error) {
    return { success: false as const, message: error.message || 'Não foi possível salvar a liderança.' };
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return {
    success: record.success === true,
    message: String(record.message ?? (record.success === true ? 'Salvo.' : 'Não foi possível salvar.')),
  } as const;
}
