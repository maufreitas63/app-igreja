import { formatEventDateTimeLabel } from '@/lib/eventDate';

export type MaintenanceEventFormState = {
  name: string;
  eventDateInput: string;
  eventTimeInput: string;
  eventLocal: string;
  maxCapacity: string;
  kidsRoom: boolean;
  teensRoom: boolean;
  parmOfertas: boolean;
  totemAtivo: boolean;
  requerQuorum: boolean;
  isPublished: boolean;
};

export const emptyMaintenanceEventForm = (): MaintenanceEventFormState => ({
  name: '',
  eventDateInput: '',
  eventTimeInput: '',
  eventLocal: '',
  maxCapacity: '',
  kidsRoom: false,
  teensRoom: false,
  parmOfertas: false,
  totemAtivo: false,
  requerQuorum: false,
  isPublished: true,
});

const pad2 = (value: number) => String(value).padStart(2, '0');

const parseIsoEventParts = (isoValue: string | null | undefined) => {
  if (!isoValue) {
    return null;
  }

  const match = isoValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = '00', minute = '00'] = match;
  return { year, month, day, hour, minute };
};

export const formatEventDateOnlyForInput = (isoValue: string | null | undefined) => {
  const parts = parseIsoEventParts(isoValue);
  if (!parts) {
    return '';
  }

  return `${parts.day}/${parts.month}/${parts.year.slice(-2)}`;
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

export const formatEventDateOnlyMask = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const formatEventTimeInputMask = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

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

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:00`;
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
  max_capacity: number | null;
  parm_ofertas: boolean | null;
  kids_room: boolean | null;
  teens_room: boolean | null;
  totem_ativo?: boolean | null;
  requer_quorum?: boolean | null;
  is_locked: boolean | null;
}): MaintenanceEventFormState => ({
  name: event.name ?? '',
  eventDateInput: formatEventDateOnlyForInput(event.event_date),
  eventTimeInput: formatEventTimeForInput(event.event_date),
  eventLocal: event.event_local ?? '',
  maxCapacity:
    typeof event.max_capacity === 'number' && !Number.isNaN(event.max_capacity)
      ? String(event.max_capacity)
      : '',
  kidsRoom: event.kids_room === true,
  teensRoom: event.teens_room === true,
  parmOfertas: event.parm_ofertas === true,
  totemAtivo: event.totem_ativo === true,
  requerQuorum: event.requer_quorum === true,
  isPublished: event.is_locked !== true,
});

export type MaintenanceEventPayload = ReturnType<typeof buildMaintenanceEventPayload>;

export type MaintenanceEventValidationResult =
  | { ok: true; payload: MaintenanceEventPayload }
  | { ok: false; message: string };

export const validateMaintenanceEventForm = (
  form: MaintenanceEventFormState
): MaintenanceEventValidationResult => {
  const payload = buildMaintenanceEventPayload(form);

  if (!payload.name) {
    return { ok: false, message: 'Informe o nome do evento.' };
  }

  if (!payload.event_date) {
    const dateDigits = form.eventDateInput.replace(/\D/g, '');
    const timeDigits = form.eventTimeInput.replace(/\D/g, '');

    if (dateDigits.length < 6) {
      return { ok: false, message: 'Informe a data completa (DD/MM/AA).' };
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

export const shiftMaintenanceEventDateIso = (
  isoValue: string | null | undefined,
  dayOffset: number
): string | null => {
  if (!isoValue || dayOffset === 0) {
    return isoValue ?? null;
  }

  const parts = parseIsoEventParts(isoValue);
  if (!parts) {
    return null;
  }

  const year = Number.parseInt(parts.year, 10);
  const month = Number.parseInt(parts.month, 10);
  const day = Number.parseInt(parts.day, 10);
  const hour = Number.parseInt(parts.hour, 10);
  const minute = Number.parseInt(parts.minute, 10);

  if ([year, month, day, hour, minute].some(Number.isNaN)) {
    return null;
  }

  const shifted = new Date(year, month - 1, day, hour, minute, 0);
  shifted.setDate(shifted.getDate() + dayOffset);

  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}-${pad2(shifted.getDate())}T${pad2(shifted.getHours())}:${pad2(shifted.getMinutes())}:00`;
};

export const buildMaintenanceEventPayload = (form: MaintenanceEventFormState) => {
  const name = form.name.trim();
  const eventLocal = form.eventLocal.trim();
  const maxCapacityDigits = form.maxCapacity.replace(/\D/g, '');
  const maxCapacity = maxCapacityDigits ? Number.parseInt(maxCapacityDigits, 10) : null;
  const eventDate = parseMaintenanceEventDateTimeToIso(form.eventDateInput, form.eventTimeInput);

  return {
    name,
    event_date: eventDate,
    event_local: eventLocal || null,
    max_capacity: maxCapacity,
    kids_room: form.kidsRoom,
    teens_room: form.teensRoom,
    parm_ofertas: form.parmOfertas,
    totem_ativo: form.totemAtivo,
    requer_quorum: form.requerQuorum,
    is_locked: !form.isPublished,
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
  is_locked: boolean | null;
}) => {
  const flags = [
    event.kids_room ? 'Kids' : null,
    event.teens_room ? 'Teens' : null,
    event.totem_ativo ? 'Totem' : null,
    event.requer_quorum ? 'Quórum' : null,
  ].filter(Boolean);

  const dateLabel = formatEventDateTimeLabel(event.event_date) || 'Sem data';
  const localLabel = event.event_local?.trim() || 'Sem local';
  const capacityLabel =
    typeof event.max_capacity === 'number' ? `${event.max_capacity} vagas` : 'Sem limite';

  return {
    dateLabel,
    localLabel,
    capacityLabel,
    flagsLabel: flags.length ? flags.join(' · ') : 'Sem salas extras',
    isPublished: event.is_locked !== true,
  };
};
