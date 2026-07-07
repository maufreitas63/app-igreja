import { withActiveMembershipProfileFilter } from '@/lib/activeMemberProfile';
import { derivePermittedScaleTypesFromSchedule } from '@/lib/scaleVolunteerProfileMatch';
import {
  fetchPermittedScaleTypes,
  SCALE_PERMITTED_RPC_MISSING,
} from '@/lib/scaleAccess';
import type {
  ProfilePhoneRow,
  ScalesClassScheduleEntry,
  ScalesClassScaleType,
} from '@/lib/scalesClassTypes';
import { resolveProfilePhoneForVolunteerName } from '@/lib/scalesClassUtils';
import { supabase } from '@/lib/supabase';

type ScaleTypeRow = {
  id?: string | null;
  codigo?: string | null;
  nome?: string | null;
};

type VigilanceScaleRow = {
  id?: string | null;
  tipo_escala_id?: string | null;
  tipo_escala_codigo?: string | null;
  tipo_escala_nome?: string | null;
  data_servico?: string | null;
  voluntario_id?: string | null;
  volunteer_name?: string | null;
};

export type ScalesClassLoadedData = {
  scaleTypes: ScalesClassScaleType[];
  scheduleEntries: ScalesClassScheduleEntry[];
};

export async function loadScalesClassData(
  profileFullName?: string | null
): Promise<ScalesClassLoadedData> {
  const [{ data, error }, { data: profilesData, error: profilesError }] = await Promise.all([
    supabase.rpc('listar_escalas'),
    withActiveMembershipProfileFilter(
      supabase.from('profiles').select('full_name, phone, family_id, codigo_membro')
    ),
  ]);

  if (error) {
    throw error;
  }

  if (profilesError) {
    throw profilesError;
  }

  const profiles = (profilesData as ProfilePhoneRow[] | null) ?? [];

  let parsedTypes: ScalesClassScaleType[];

  try {
    const permittedTypes = await fetchPermittedScaleTypes('view');
    parsedTypes = permittedTypes.map((entry) => ({
      id: entry.id,
      code: entry.code,
      name: entry.name,
    }));
  } catch (scaleTypesError) {
    if (
      scaleTypesError instanceof Error
      && scaleTypesError.message === SCALE_PERMITTED_RPC_MISSING
    ) {
      const { data: typesData, error: typesError } = await supabase.rpc('listar_tipos_escala');

      if (typesError) {
        throw typesError;
      }

      parsedTypes = ((typesData as ScaleTypeRow[] | null) ?? [])
        .map((entry) => {
          const entryId = entry.id?.trim();
          const code = entry.codigo?.trim();
          const name = entry.nome?.trim();

          if (!entryId || !code || !name) {
            return null;
          }

          return { id: entryId, code, name } satisfies ScalesClassScaleType;
        })
        .filter((entry): entry is ScalesClassScaleType => entry !== null)
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
    } else {
      throw scaleTypesError;
    }
  }

  const parsedEntries = ((data as VigilanceScaleRow[] | null) ?? [])
    .map((entry) => {
      const entryId = entry.id?.trim();
      const scaleId = entry.tipo_escala_id?.trim();
      const scaleCode = entry.tipo_escala_codigo?.trim();
      const scaleName = entry.tipo_escala_nome?.trim();
      const serviceDate = entry.data_servico?.trim();
      const volunteerId = entry.voluntario_id?.trim();
      const volunteerName = entry.volunteer_name?.trim();

      if (
        !entryId
        || !scaleId
        || !scaleCode
        || !scaleName
        || !serviceDate
        || !volunteerId
        || !volunteerName
      ) {
        return null;
      }

      return {
        id: entryId,
        scaleId,
        scaleCode,
        scaleName,
        serviceDate,
        volunteerId,
        volunteerName,
        volunteerPhone: resolveProfilePhoneForVolunteerName(volunteerName, profiles),
      } satisfies ScalesClassScheduleEntry;
    })
    .filter((entry): entry is ScalesClassScheduleEntry => entry !== null)
    .sort(
      (left, right) =>
        left.scaleName.localeCompare(right.scaleName, 'pt-BR')
        || left.serviceDate.localeCompare(right.serviceDate)
        || left.volunteerName.localeCompare(right.volunteerName, 'pt-BR')
    );

  if (parsedTypes.length === 0 && profileFullName?.trim()) {
    parsedTypes = derivePermittedScaleTypesFromSchedule(
      profileFullName,
      parsedEntries.map((entry) => ({
        scale_id: entry.scaleId,
        scale_code: entry.scaleCode,
        scale_name: entry.scaleName,
        volunteer_name: entry.volunteerName,
      }))
    );
  }

  return {
    scaleTypes: parsedTypes,
    scheduleEntries: parsedEntries,
  };
}
