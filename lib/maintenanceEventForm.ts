import {
  formatEventDateTimeLabel,
  formatEventWallClockIso,
  getEventWallClockParts,
  isEventDateBeforeToday,
} from '@/lib/eventDate';
import { KIDS_ROOM_DISPLAY_LABEL, TEENS_ROOM_DISPLAY_LABEL } from '@/lib/entityPrefixCore';
import { formatEventCapacityLabel } from '@/lib/eventCapacity';
import { formatBrazilDateShortInput, formatBrazilTimeInput } from '@/lib/inputMasks';

export type MaintenanceEventFormState = {
  name: string;
  eventDateInput: string;
  eventTimeInput: string;
  eventLocal: string;
  eventLocalAddress: string;
  eventLatitude: string;
  eventLongitude: string;
  maxCapacity: string;
  kidsRoom: boolean;
  teensRoom: boolean;
  parmOfertas: boolean;
  totemAtivo: boolean;
  requerQuorum: boolean;
  somenteMembros: boolean;
  isPublished: boolean;
};

export const emptyMaintenanceEventForm = (): MaintenanceEventFormState => ({
  name: '',
  eventDateInput: '',
  eventTimeInput: '',
  eventLocal: '',
  eventLocalAddress: '',
  eventLatitude: '',
  eventLongitude: '',
  maxCapacity: '',
  kidsRoom: false,
  teensRoom: false,
  parmOfertas: false,
  totemAtivo: false,
  requerQuorum: false,
  somenteMembros: false,
  isPublished: true,
});

const pad2 = (value: number) => String(value).padStart(2, '0');

const parseIsoEventParts = (isoValue: string | null | undefined) => {
  const wall = getEventWallClockParts(isoValue);
  if (!wall) {
    return null;
  }

  return {
    year: String(wall.year),
    month: pad2(wall.month),
    day: pad2(wall.day),
    hour: pad2(wall.hour),
    minute: pad2(wall.minute),
  };
};

export const formatEventDateOnlyForInput = (isoValue: string | null | undefined) => {
  const parts = parseIsoEventParts(isoValue);
  if (!parts) {
    return '';
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
};

export const formatEventTimeForInput = (isoValue: string | null | undefined) => {
  const parts = parseIsoEventParts(isoValue);
  if (!parts) {
    return '';
  }

  return `${parts.hour}:${parts.minute}`;
};

/** @deprecated Use formatEventDateOnlyForInput + formatEventTimeForInput */
export const formatEventDateForInput = (isoValue: string | null | undefined) => {
  const date = formatEventDateOnlyForInput(isoValue);
  const time = formatEventTimeForInput(isoValue);
  if (!date) {
    return '';
  }

  return time ? `${date} ${time}` : date;
};

export const formatEventDateOnlyMask = formatBrazilDateShortInput;

export const formatEventTimeInputMask = (value: string) =>
  formatBrazilTimeInput(value.replace(/[;:\s]/g, ''));

const parseDateTimeParts = (
  dayText: string,
  monthText: string,
  yearText: string,
  hourText: string,
  minuteText: string
) => {
  const day = Number.parseInt(dayText, 10);
  const month = Number.parseInt(monthText, 10);
  let year = Number.parseInt(yearText, 10);
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);

  if (yearText.length === 2) {
    year += year >= 70 ? 1900 : 2000;
  }

  if (
    [day, month, year, hour, minute].some(Number.isNaN)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
    || hour > 23
    || minute > 59
  ) {
    return null;
  }

  return { year, month, day, hour, minute };
};

export const parseMaintenanceEventDateTimeToIso = (
  dateInput: string,
  timeInput: string,
  defaultTime = '10:00'
) => {
  const dateTrimmed = dateInput.trim();
  const timeTrimmed = timeInput.trim();

  const dateMatch = dateTrimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!dateMatch) {
    return null;
  }

  const timeValue = timeTrimmed || defaultTime;
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) {
    return null;
  }

  const parts = parseDateTimeParts(
    dateMatch[1],
    dateMatch[2],
    dateMatch[3],
    timeMatch[1],
    timeMatch[2]
  );

  if (!parts) {
    return null;
  }

  return formatEventWallClockIso(parts);
};

export const isMaintenanceEventFormDateInPast = (form: MaintenanceEventFormState) => {
  const iso = parseMaintenanceEventDateTimeToIso(form.eventDateInput, form.eventTimeInput);
  return Boolean(iso && isEventDateBeforeToday(iso));
};

/** Aceita campo único legado DD/MM/AA ou DD/MM/AA HH:MM */
export const parseEventDateInputToIso = (value: string) => {
  const trimmed = value.trim();

  if (/^(\d{2})\/(\d{2})\/(\d{2,4})$/.test(trimmed)) {
    return parseMaintenanceEventDateTimeToIso(trimmed, '');
  }

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return parseMaintenanceEventDateTimeToIso(
    `${match[1]}/${match[2]}/${match[3]}`,
    `${match[4]}:${match[5]}`
  );
};

export const formFromMaintenanceEvent = (event: {
  name: string;
  event_date: string | null;
  event_local: string | null;
  latitude?: number | null;
  longitude?: number | null;
  max_capacity: number | null;
  parm_ofertas: boolean | null;
  kids_room: boolean | null;
  teens_room: boolean | null;
  totem_ativo?: boolean | null;
  requer_quorum?: boolean | null;
  somente_membros?: boolean | null;
  is_locked: boolean | null;
}): MaintenanceEventFormState => ({
  name: event.name ?? '',
  eventDateInput: formatEventDateOnlyForInput(event.event_date),
  eventTimeInput: formatEventTimeForInput(event.event_date),
  eventLocal: event.event_local ?? '',
  eventLocalAddress: '',
  eventLatitude:
    typeof event.latitude === 'number' && Number.isFinite(event.latitude)
      ? String(event.latitude)
      : '',
  eventLongitude:
    typeof event.longitude === 'number' && Number.isFinite(event.longitude)
      ? String(event.longitude)
      : '',
  maxCapacity:
    typeof event.max_capacity === 'number' && !Number.isNaN(event.max_capacity)
      ? String(event.max_capacity)
      : '',
  kidsRoom: event.kids_room === true,
  teensRoom: event.teens_room === true,
  parmOfertas: event.parm_ofertas === true,
  totemAtivo: event.totem_ativo === true,
  requerQuorum: event.requer_quorum === true,
  somenteMembros: event.somente_membros === true,
  isPublished: event.is_locked !== true,
});

export type MaintenanceEventPayload = ReturnType<typeof buildMaintenanceEventPayload>;

export type MaintenanceEventValidationResult =
  | { ok: true; payload: MaintenanceEventPayload }
  | { ok: false; message: string };

export type MaintenanceEventValidationOptions = {
  bypassPastDateRestriction?: boolean;
};

export const validateMaintenanceEventForm = (
  form: MaintenanceEventFormState,
  options?: MaintenanceEventValidationOptions
): MaintenanceEventValidationResult => {
  const payload = buildMaintenanceEventPayload(form, options);

  if (!payload.name) {
    return { ok: false, message: 'Informe o nome do evento.' };
  }

  if (
    !options?.bypassPastDateRestriction
    && form.isPublished
    && payload.event_date
    && isEventDateBeforeToday(payload.event_date)
  ) {
    const dateLabel = form.eventDateInput.trim() || payload.event_date.slice(0, 10);
    return {
      ok: false,
      message:
        `Não é possível publicar: a data ${dateLabel} é anterior a hoje. `
        + 'Escolha hoje ou uma data futura, ou desative Publicação para salvar como rascunho.',
    };
  }

  if (!payload.event_date) {
    const dateDigits = form.eventDateInput.replace(/\D/g, '');
    const timeDigits = form.eventTimeInput.replace(/\D/g, '');

    if (dateDigits.length < 6) {
      return { ok: false, message: 'Informe a data completa (DD/MM/AAAA).' };
    }

    if (timeDigits.length > 0 && timeDigits.length < 4) {
      return { ok: false, message: 'Informe o horário completo (HH:MM).' };
    }

    return {
      ok: false,
      message: 'Data ou horário inválidos. Ex.: data 27/05/26 e horário 10:00.',
    };
  }

  if (payload.max_capacity === null) {
    return {
      ok: false,
      message: 'Informe a capacidade (vagas). Ex.: 200 — o campo é obrigatório no banco.',
    };
  }

  if (Number.isNaN(payload.max_capacity) || payload.max_capacity < 0) {
    return { ok: false, message: 'Informe um número válido de vagas.' };
  }

  return { ok: true, payload };
};

export const buildMaintenanceEventReplicationPayload = (
  form: MaintenanceEventFormState,
  dayOffset: number
): MaintenanceEventValidationResult => {
  const payload = buildMaintenanceEventPayload(form);

  if (!payload.name) {
    return { ok: false, message: 'Informe o nome do evento.' };
  }

  if (!payload.event_date) {
    const dateDigits = form.eventDateInput.replace(/\D/g, '');
    const timeDigits = form.eventTimeInput.replace(/\D/g, '');

    if (dateDigits.length < 6) {
      return { ok: false, message: 'Informe a data completa (DD/MM/AAAA).' };
    }

    if (timeDigits.length > 0 && timeDigits.length < 4) {
      return { ok: false, message: 'Informe o horário completo (HH:MM).' };
    }

    return {
      ok: false,
      message: 'Data ou horário inválidos. Ex.: data 27/05/2026 e horário 10:00.',
    };
  }

  if (payload.max_capacity === null) {
    return {
      ok: false,
      message: 'Informe a capacidade (vagas). Ex.: 200 — o campo é obrigatório no banco.',
    };
  }

  if (Number.isNaN(payload.max_capacity) || payload.max_capacity < 0) {
    return { ok: false, message: 'Informe um número válido de vagas.' };
  }

  if (dayOffset < 1) {
    return { ok: false, message: 'O deslocamento em dias deve ser pelo menos 1.' };
  }

  const shiftedDate = shiftMaintenanceEventDateIso(payload.event_date, dayOffset);

  if (!shiftedDate) {
    return {
      ok: false,
      message: `Não foi possível calcular a data +${dayOffset} dia(s).`,
    };
  }

  return {
    ok: true,
    payload: {
      name: payload.name,
      event_date: shiftedDate,
      event_local: payload.event_local,
      max_capacity: payload.max_capacity,
      kids_room: payload.kids_room,
      teens_room: payload.teens_room,
      parm_ofertas: payload.parm_ofertas,
      totem_ativo: payload.totem_ativo,
      requer_quorum: payload.requer_quorum,
      somente_membros: payload.somente_membros,
      is_locked: true,
    },
  };
};

export const shiftMaintenanceEventDateIso = (
  isoValue: string | null | undefined,
  dayOffset: number
): string | null => {
  if (!isoValue || dayOffset === 0) {
    return isoValue ?? null;
  }

  const parts = getEventWallClockParts(isoValue);
  if (!parts) {
    return null;
  }

  const shiftedDate = new Date(parts.year, parts.month - 1, parts.day);
  shiftedDate.setDate(shiftedDate.getDate() + dayOffset);

  return formatEventWallClockIso({
    year: shiftedDate.getFullYear(),
    month: shiftedDate.getMonth() + 1,
    day: shiftedDate.getDate(),
    hour: parts.hour,
    minute: parts.minute,
  });
};

export const buildMaintenanceEventPayload = (
  form: MaintenanceEventFormState,
  options?: MaintenanceEventValidationOptions
) => {
  const name = form.name.trim();
  const eventLocal = form.eventLocal.trim();
  const maxCapacityDigits = form.maxCapacity.replace(/\D/g, '');
  const maxCapacity = maxCapacityDigits ? Number.parseInt(maxCapacityDigits, 10) : null;
  const eventDate = parseMaintenanceEventDateTimeToIso(form.eventDateInput, form.eventTimeInput);
  const isLocked = !form.isPublished;
  const latitudeRaw = form.eventLatitude.trim().replace(',', '.');
  const longitudeRaw = form.eventLongitude.trim().replace(',', '.');
  const latitude = latitudeRaw ? Number.parseFloat(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number.parseFloat(longitudeRaw) : null;
  const retroactivePublish = Boolean(
    options?.bypassPastDateRestriction
    && !isLocked
    && eventDate
    && isEventDateBeforeToday(eventDate)
  );

  return {
    name,
    event_date: eventDate,
    event_local: eventLocal || null,
    latitude: Number.isFinite(latitude ?? NaN) ? latitude : null,
    longitude: Number.isFinite(longitude ?? NaN) ? longitude : null,
    max_capacity: maxCapacity,
    kids_room: form.kidsRoom,
    teens_room: form.teensRoom,
    parm_ofertas: form.parmOfertas,
    totem_ativo: form.totemAtivo,
    requer_quorum: form.requerQuorum,
    somente_membros: form.somenteMembros,
    is_locked: isLocked,
    ...(retroactivePublish ? { retroactive_publish: true } : {}),
  };
};

export const summarizeMaintenanceEvent = (event: {
  name: string;
  event_date: string | null;
  event_local: string | null;
  max_capacity: number | null;
  parm_ofertas: boolean | null;
  kids_room: boolean | null;
  teens_room: boolean | null;
  totem_ativo?: boolean | null;
  requer_quorum?: boolean | null;
  somente_membros?: boolean | null;
  is_locked: boolean | null;
}) => {
  const flags = [
    event.kids_room ? KIDS_ROOM_DISPLAY_LABEL : null,
    event.teens_room ? TEENS_ROOM_DISPLAY_LABEL : null,
    event.somente_membros ? 'Somente membros' : null,
    event.totem_ativo ? 'Totem' : null,
    event.requer_quorum ? 'Quórum' : null,
  ].filter(Boolean);

  const dateLabel = formatEventDateTimeLabel(event.event_date) || 'Sem data';
  const localLabel = event.event_local?.trim() || 'Sem local';
  const capacityLabel = formatEventCapacityLabel(event.max_capacity);

  return {
    dateLabel,
    localLabel,
    capacityLabel,
    flagsLabel: flags.length ? flags.join(' · ') : 'Sem salas extras',
    isPublished: event.is_locked !== true,
  };
};
