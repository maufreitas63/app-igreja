import {

  parseScaleServiceDateLocal,

  type ScaleCycleMode,

  type ScaleCyclePreviewEntry,

} from '@/lib/maintenanceScaleCycle';

import { MAINTENANCE_SCALES_RPC_MISSING } from '@/lib/maintenanceScalesApi';

import { normalizeScaleServiceDateIso, parseRegisterScaleRpc } from '@/lib/maintenanceScales';

import { supabase } from '@/lib/supabase';

import { isSupabaseRpcMissing, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';



export type ScaleCycleContext = {

  maxServiceDate: string | null;

  scheduledDates: string[];

  occupancyByDate: Record<string, number>;

  vagasPorServico: number;

  modoCiclo: ScaleCycleMode;

};



const toRowArray = (data: unknown) => {

  if (Array.isArray(data)) {

    return data;

  }



  if (data && typeof data === 'object') {

    return [data as Record<string, unknown>];

  }



  return [];

};



const parseOccupancyByDate = (raw: unknown): Record<string, number> => {

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {

    return {};

  }



  const occupancy: Record<string, number> = {};



  for (const [rawDate, rawCount] of Object.entries(raw as Record<string, unknown>)) {

    const normalized = normalizeScaleServiceDateIso(rawDate);

    const count =

      typeof rawCount === 'number'

        ? rawCount

        : typeof rawCount === 'string'

          ? Number.parseInt(rawCount, 10)

          : 0;



    if (normalized && Number.isFinite(count) && count > 0) {

      occupancy[normalized] = count;

    }

  }



  return occupancy;

};



const parseScaleCycleContextRpc = (data: unknown): ScaleCycleContext => {

  const row = (data && typeof data === 'object' ? data : null) as Record<string, unknown> | null;



  if (!row || row.success === false) {

    throw new Error(String(row?.message ?? 'Não foi possível carregar o contexto do ciclo.'));

  }



  const maxRaw = row.max_service_date;

  const maxServiceDate =

    maxRaw === null || maxRaw === undefined

      ? null

      : normalizeScaleServiceDateIso(String(maxRaw));



  const scheduledRaw = row.scheduled_dates;

  const scheduledDateSet = new Set<string>();



  if (Array.isArray(scheduledRaw)) {

    for (const value of scheduledRaw) {

      const normalized = normalizeScaleServiceDateIso(String(value ?? ''));



      if (normalized) {

        scheduledDateSet.add(normalized);

      }

    }

  }



  const occupancyByDate = parseOccupancyByDate(row.occupancy_by_date);



  for (const date of scheduledDateSet) {

    if (occupancyByDate[date] == null) {

      occupancyByDate[date] = 1;

    }

  }



  const vagasRaw = row.vagas_por_servico;

  const vagasPorServico =

    typeof vagasRaw === 'number'

      ? Math.max(1, Math.min(vagasRaw, 50))

      : typeof vagasRaw === 'string'

        ? Math.max(1, Math.min(Number.parseInt(vagasRaw, 10) || 1, 50))

        : 1;



  const modoRaw = String(row.modo_ciclo ?? 'individual').toLowerCase();

  const modoCiclo: ScaleCycleMode = modoRaw === 'equipe' ? 'equipe' : 'individual';



  return {

    maxServiceDate,

    scheduledDates: Array.from(scheduledDateSet).sort(),

    occupancyByDate,

    vagasPorServico,

    modoCiclo,

  };

};



async function fetchScaleCycleContextFromTable(scaleTypeId: string): Promise<ScaleCycleContext> {

  const { data, error } = await supabase

    .from('escalas_log')

    .select('data_servico')

    .eq('tipo_escala_id', scaleTypeId);



  if (error) {

    throw error;

  }



  const rows = toRowArray(data);

  const scheduledDateSet = new Set<string>();

  const occupancyByDate: Record<string, number> = {};

  let maxServiceDate: string | null = null;

  let maxTimestamp = Number.NEGATIVE_INFINITY;



  for (const row of rows) {

    const normalized = normalizeScaleServiceDateIso(String(row.data_servico ?? ''));



    if (!normalized) {

      continue;

    }



    scheduledDateSet.add(normalized);

    occupancyByDate[normalized] = (occupancyByDate[normalized] ?? 0) + 1;



    const timestamp = parseScaleServiceDateLocal(normalized)?.getTime() ?? Number.NEGATIVE_INFINITY;



    if (timestamp > maxTimestamp) {

      maxTimestamp = timestamp;

      maxServiceDate = normalized;

    }

  }



  const { data: typeRow, error: typeError } = await supabase

    .from('tipos_escala')

    .select('vagas_por_servico, modo_ciclo')

    .eq('id', scaleTypeId)

    .maybeSingle();



  if (typeError) {

    throw typeError;

  }



  const vagasRaw = typeRow?.vagas_por_servico;

  const vagasPorServico =

    typeof vagasRaw === 'number'

      ? Math.max(1, Math.min(vagasRaw, 50))

      : 1;



  const modoRaw = String(typeRow?.modo_ciclo ?? 'individual').toLowerCase();



  return {

    maxServiceDate,

    scheduledDates: Array.from(scheduledDateSet).sort(),

    occupancyByDate,

    vagasPorServico,

    modoCiclo: modoRaw === 'equipe' ? 'equipe' : 'individual',

  };

}



export async function fetchScaleCycleContext(scaleTypeId: string): Promise<ScaleCycleContext> {

  const { data, error } = await supabase.rpc('get_scale_cycle_context', {

    p_tipo_escala_id: scaleTypeId,

  });



  if (error) {

    if (isSupabaseRpcMissingError(error, 'get_scale_cycle_context')) {

      return fetchScaleCycleContextFromTable(scaleTypeId);

    }



    throw error;

  }



  return parseScaleCycleContextRpc(data);

}



export async function applyCicloCompleto(scaleTypeId: string, entries: ScaleCyclePreviewEntry[]) {

  if (!entries.length) {

    return { success: false as const, message: 'Nenhuma escala para gravar.' };

  }



  const payload = entries.map((entry) => {

    const serviceDate = normalizeScaleServiceDateIso(entry.serviceDate);



    if (!serviceDate) {

      throw new Error(`Data inválida para ${entry.volunteerName}.`);

    }



    return {

      voluntario_id: entry.volunteerId,

      data_servico: serviceDate,

    };

  });



  const { data, error } = await supabase.rpc('aplicar_ciclo_escala', {

    p_tipo_escala_id: scaleTypeId,

    p_entries: payload,

  });



  if (error) {

    const message = (error.message ?? '').toLowerCase();



    if (isSupabaseRpcMissing(message, 'aplicar_ciclo_escala')) {

      const schemaError = new Error(MAINTENANCE_SCALES_RPC_MISSING);

      schemaError.name = 'MaintenanceScalesRpcMissing';

      throw schemaError;

    }



    throw error;

  }



  const parsed = parseRegisterScaleRpc(data);

  const insertedCountRaw =

    data && typeof data === 'object' && 'inserted_count' in (data as Record<string, unknown>)

      ? (data as Record<string, unknown>).inserted_count

      : null;

  const insertedCount =

    typeof insertedCountRaw === 'number'

      ? insertedCountRaw

      : typeof insertedCountRaw === 'string'

        ? Number.parseInt(insertedCountRaw, 10)

        : parsed.success

          ? entries.length

          : 0;



  if (!parsed.success) {

    return {

      success: false as const,

      message: parsed.message ?? 'Não foi possível gravar o ciclo.',

      insertedCount: 0,

    };

  }



  return {

    success: true as const,

    message: parsed.message ?? `${insertedCount} escala(s) gravada(s) em escalas_log.`,

    insertedCount,

  };

}


