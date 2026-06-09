/**

 * Fonte única de geração de escala em lote (C2).

 *

 * Regras:

 * - Percorre servos ativos por ordem_sequencial (crescente).

 * - Modo individual: cada servo em domingo distinto (após MAX(data_servico)).

 * - Modo equipe: até vagas_por_servico servos no mesmo domingo antes de avançar +7 dias.

 * - Gravação em lote via aplicar_ciclo_escala (RPC); manual via registrar_escala_manual.

 *

 * Não usar gerar_escala_por_codigo / gerar_escala_vigilancia no SQL (legado desativado).

 */

import {

  formatScaleServiceDateLabel,

  normalizeScaleServiceDateIso,

  toLocalScaleServiceDateIso,

  type MaintenanceScaleVolunteer,

} from '@/lib/maintenanceScales';



export type ScaleCycleMode = 'individual' | 'equipe';



export type ScaleCyclePreviewEntry = {

  serviceDate: string;

  volunteerId: string;

  volunteerName: string;

  sequenceOrder: number;

};



export type GerarCicloCompletoInput = {

  scaleTypeId: string;

  volunteers: MaintenanceScaleVolunteer[];

  /** Maior data_servico (MAX) do tipo em escalas_log. */

  maxServiceDate: string | null;

  /** Datas já escaladas para o tipo (domingos ou outros dias com registro). */

  scheduledDates: string[];

  /** Contagem de servos por data_servico (RPC get_scale_cycle_context). */

  occupancyByDate?: Record<string, number>;

  /** Máximo de servos por domingo neste tipo (tipos_escala.vagas_por_servico). */

  vagasPorServico?: number;

  /** individual | equipe (tipos_escala.modo_ciclo). */

  modoCiclo?: ScaleCycleMode;

  referenceDate?: Date;

};



export type GerarCicloCompletoResult = {

  success: boolean;

  entries: ScaleCyclePreviewEntry[];

  startSunday: string | null;

  message: string;

};



/** ~3 anos de domingos; evita loop infinito se o calendário estiver saturado. */

const MAX_SUNDAY_SCAN = 156;



export const parseScaleServiceDateLocal = (isoDate: string) => {

  const normalized = normalizeScaleServiceDateIso(isoDate);



  if (!normalized) {

    return null;

  }



  const [year, month, day] = normalized.split('-').map((part) => Number.parseInt(part, 10));



  return new Date(year, month - 1, day);

};



/** Próximo domingo em ou após a referência (inclui o próprio dia se for domingo). */

export const nextSundayOnOrAfter = (reference = new Date()) => {

  const cursor = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  const dayOfWeek = cursor.getDay();



  if (dayOfWeek !== 0) {

    cursor.setDate(cursor.getDate() + (7 - dayOfWeek));

  }



  return toLocalScaleServiceDateIso(cursor);

};



/** Próximo domingo após a maior data_servico registrada. */

export const nextSundayStrictlyAfterIso = (isoDate: string) => {

  const normalized = normalizeScaleServiceDateIso(isoDate);



  if (!normalized) {

    return nextSundayOnOrAfter(new Date());

  }



  const parsed = parseScaleServiceDateLocal(normalized);



  if (!parsed) {

    return nextSundayOnOrAfter(new Date());

  }



  if (parsed.getDay() === 0) {

    parsed.setDate(parsed.getDate() + 7);

    return toLocalScaleServiceDateIso(parsed);

  }



  parsed.setDate(parsed.getDate() + 1);



  return nextSundayOnOrAfter(parsed);

};



export const addDaysToScaleServiceDateIso = (isoDate: string, days: number) => {

  const parsed = parseScaleServiceDateLocal(isoDate);



  if (!parsed) {

    return normalizeScaleServiceDateIso(isoDate) ?? isoDate;

  }



  parsed.setDate(parsed.getDate() + days);



  return toLocalScaleServiceDateIso(parsed);

};



/** Voluntários ativos com `ordem_sequencial` definida, do menor ao maior número. */

export const sortVolunteersBySequence = (volunteers: MaintenanceScaleVolunteer[]) =>

  [...volunteers]

    .filter((volunteer) => volunteer.isActive && volunteer.sequenceOrder != null)

    .sort((left, right) => {

      const leftOrder = left.sequenceOrder as number;

      const rightOrder = right.sequenceOrder as number;



      if (leftOrder !== rightOrder) {

        return leftOrder - rightOrder;

      }



      return left.name.localeCompare(right.name, 'pt-BR');

    });



export const activeVolunteersMissingSequenceOrder = (volunteers: MaintenanceScaleVolunteer[]) =>

  volunteers.filter((volunteer) => volunteer.isActive && volunteer.sequenceOrder == null);



export const getNextSundayAfterMaxServiceDate = (

  maxServiceDate: string | null,

  referenceDate = new Date()

) => {

  if (!maxServiceDate) {

    return nextSundayOnOrAfter(referenceDate);

  }



  return nextSundayStrictlyAfterIso(maxServiceDate);

};



const coerceScheduledDates = (scheduledDates: unknown): string[] => {

  if (Array.isArray(scheduledDates)) {

    return scheduledDates.filter((value): value is string => typeof value === 'string');

  }



  if (scheduledDates instanceof Set) {

    return Array.from(scheduledDates).filter((value): value is string => typeof value === 'string');

  }



  return [];

};



const buildOccupancyMap = (

  occupancyByDate: Record<string, number> | undefined,

  scheduledDates: unknown

) => {

  const occupancy = new Map<string, number>();



  if (occupancyByDate && typeof occupancyByDate === 'object') {

    for (const [rawDate, rawCount] of Object.entries(occupancyByDate)) {

      const normalized = normalizeScaleServiceDateIso(rawDate);

      const count =

        typeof rawCount === 'number'

          ? rawCount

          : typeof rawCount === 'string'

            ? Number.parseInt(rawCount, 10)

            : 0;



      if (normalized && Number.isFinite(count) && count > 0) {

        occupancy.set(normalized, count);

      }

    }

  }



  for (const value of coerceScheduledDates(scheduledDates)) {

    const normalized = normalizeScaleServiceDateIso(value);



    if (!normalized || occupancy.has(normalized)) {

      continue;

    }



    occupancy.set(normalized, 1);

  }



  return occupancy;

};



const isSundayAvailableForIndividual = (

  isoDate: string,

  occupancy: Map<string, number>,

  planned: Set<string>

) => {

  const normalized = normalizeScaleServiceDateIso(isoDate);



  if (!normalized) {

    return false;

  }



  if ((occupancy.get(normalized) ?? 0) > 0) {

    return false;

  }



  return !planned.has(normalized);

};



const findNextOpenSundayIndividual = (

  startSunday: string,

  occupancy: Map<string, number>,

  planned: Set<string>

) => {

  let current = normalizeScaleServiceDateIso(startSunday) ?? startSunday;



  for (let attempt = 0; attempt < MAX_SUNDAY_SCAN; attempt += 1) {

    if (isSundayAvailableForIndividual(current, occupancy, planned)) {

      return current;

    }



    const next = addDaysToScaleServiceDateIso(current, 7);



    if (next === current) {

      break;

    }



    current = next;

  }



  return null;

};



const gerarCicloIndividual = (

  volunteers: MaintenanceScaleVolunteer[],

  maxServiceDate: string | null,

  occupancy: Map<string, number>,

  referenceDate: Date

): GerarCicloCompletoResult => {

  const plannedSundays = new Set<string>();

  let cursorSunday = getNextSundayAfterMaxServiceDate(maxServiceDate, referenceDate);

  const entries: ScaleCyclePreviewEntry[] = [];



  for (const volunteer of volunteers) {

    const serviceDate = findNextOpenSundayIndividual(cursorSunday, occupancy, plannedSundays);



    if (!serviceDate) {

      const maxLabel = maxServiceDate

        ? formatScaleServiceDateLabel(maxServiceDate)

        : 'nenhuma data em escalas_log';



      return {

        success: false,

        entries: [],

        startSunday: null,

        message:

          `Calendário saturado: não há domingo livre após ${formatScaleServiceDateLabel(cursorSunday)} `

          + `(verificadas ${MAX_SUNDAY_SCAN} semanas). Revise escalas futuras em escalas_log ou reduza servos no ciclo. `

          + `Maior data_servico desta escala: ${maxLabel}.`,

      };

    }



    const normalized = normalizeScaleServiceDateIso(serviceDate) ?? serviceDate;

    plannedSundays.add(normalized);



    entries.push({

      serviceDate: normalized,

      volunteerId: volunteer.id,

      volunteerName: volunteer.name,

      sequenceOrder: volunteer.sequenceOrder as number,

    });



    cursorSunday = addDaysToScaleServiceDateIso(normalized, 7);

  }



  const orderLabel = entries.map((entry) => entry.sequenceOrder).join(', ');



  return {

    success: true,

    entries,

    startSunday: entries[0]?.serviceDate ?? null,

    message: maxServiceDate

      ? `${entries.length} nova(s) data(s) (modo individual) na ordem ${orderLabel}, a partir de ${formatScaleServiceDateLabel(entries[0].serviceDate)} (após ${formatScaleServiceDateLabel(maxServiceDate)}).`

      : `${entries.length} nova(s) data(s) (modo individual) na ordem ${orderLabel}, a partir de ${formatScaleServiceDateLabel(entries[0].serviceDate)}.`,

  };

};



const gerarCicloEquipe = (

  volunteers: MaintenanceScaleVolunteer[],

  maxServiceDate: string | null,

  occupancy: Map<string, number>,

  vagasPorServico: number,

  referenceDate: Date

): GerarCicloCompletoResult => {

  const planned = new Map<string, number>();

  let cursorSunday = getNextSundayAfterMaxServiceDate(maxServiceDate, referenceDate);

  const entries: ScaleCyclePreviewEntry[] = [];



  const totalOnDate = (isoDate: string) => {

    const normalized = normalizeScaleServiceDateIso(isoDate) ?? isoDate;



    return (occupancy.get(normalized) ?? 0) + (planned.get(normalized) ?? 0);

  };



  const advanceCursorIfFull = (isoDate: string) => {

    const normalized = normalizeScaleServiceDateIso(isoDate) ?? isoDate;



    if (totalOnDate(normalized) >= vagasPorServico) {

      cursorSunday = addDaysToScaleServiceDateIso(normalized, 7);

    }

  };



  const ensureRoomOnCursor = () => {

    let current = normalizeScaleServiceDateIso(cursorSunday) ?? cursorSunday;



    for (let attempt = 0; attempt < MAX_SUNDAY_SCAN; attempt += 1) {

      if (totalOnDate(current) < vagasPorServico) {

        cursorSunday = current;

        return current;

      }



      const next = addDaysToScaleServiceDateIso(current, 7);



      if (next === current) {

        break;

      }



      current = next;

    }



    return null;

  };



  for (const volunteer of volunteers) {

    const serviceDate = ensureRoomOnCursor();



    if (!serviceDate) {

      const maxLabel = maxServiceDate

        ? formatScaleServiceDateLabel(maxServiceDate)

        : 'nenhuma data em escalas_log';



      return {

        success: false,

        entries: [],

        startSunday: null,

        message:

          `Calendário saturado: não há domingo com vaga após ${formatScaleServiceDateLabel(cursorSunday)} `

          + `(verificadas ${MAX_SUNDAY_SCAN} semanas, limite ${vagasPorServico} por domingo). `

          + `Maior data_servico desta escala: ${maxLabel}.`,

      };

    }



    const normalized = normalizeScaleServiceDateIso(serviceDate) ?? serviceDate;

    planned.set(normalized, (planned.get(normalized) ?? 0) + 1);



    entries.push({

      serviceDate: normalized,

      volunteerId: volunteer.id,

      volunteerName: volunteer.name,

      sequenceOrder: volunteer.sequenceOrder as number,

    });



    advanceCursorIfFull(normalized);

  }



  const orderLabel = entries.map((entry) => entry.sequenceOrder).join(', ');

  const distinctDates = new Set(entries.map((entry) => entry.serviceDate)).size;



  return {

    success: true,

    entries,

    startSunday: entries[0]?.serviceDate ?? null,

    message: maxServiceDate

      ? `${entries.length} escala(s) em ${distinctDates} domingo(s) (modo equipe, até ${vagasPorServico} por domingo), ordem ${orderLabel}, a partir de ${formatScaleServiceDateLabel(entries[0].serviceDate)} (após ${formatScaleServiceDateLabel(maxServiceDate)}).`

      : `${entries.length} escala(s) em ${distinctDates} domingo(s) (modo equipe, até ${vagasPorServico} por domingo), ordem ${orderLabel}, a partir de ${formatScaleServiceDateLabel(entries[0].serviceDate)}.`,

  };

};



export function gerarCicloCompleto(input: GerarCicloCompletoInput): GerarCicloCompletoResult {

  if (!input.scaleTypeId?.trim()) {

    return {

      success: false,

      entries: [],

      startSunday: null,

      message: 'Tipo de escala não informado para gerar o ciclo.',

    };

  }



  const referenceDate = input.referenceDate ?? new Date();

  const missingOrder = activeVolunteersMissingSequenceOrder(input.volunteers);



  if (missingOrder.length > 0) {

    return {

      success: false,

      entries: [],

      startSunday: null,

      message: `${missingOrder.length} servo(s) ativo(s) sem ordem_sequencial. Defina a ordem no card Servos antes de gerar o ciclo.`,

    };

  }



  const volunteers = sortVolunteersBySequence(input.volunteers);



  if (!volunteers.length) {

    return {

      success: false,

      entries: [],

      startSunday: null,

      message: 'Nenhum servo ativo com ordem_sequencial para gerar a escala em bloco.',

    };

  }



  const maxServiceDate = input.maxServiceDate

    ? normalizeScaleServiceDateIso(input.maxServiceDate) ?? input.maxServiceDate

    : null;



  const occupancy = buildOccupancyMap(input.occupancyByDate, input.scheduledDates);

  const vagasPorServico = Math.max(1, Math.min(input.vagasPorServico ?? 1, 50));

  const modoCiclo: ScaleCycleMode = input.modoCiclo === 'equipe' ? 'equipe' : 'individual';



  if (modoCiclo === 'equipe') {

    return gerarCicloEquipe(volunteers, maxServiceDate, occupancy, vagasPorServico, referenceDate);

  }



  return gerarCicloIndividual(volunteers, maxServiceDate, occupancy, referenceDate);

}


