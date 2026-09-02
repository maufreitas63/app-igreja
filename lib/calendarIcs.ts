import { appAlert } from '@/lib/appAlert';
import {
  APP_EVENT_TIMEZONE,
  parseEventDateParts,
} from '@/lib/eventDate';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Duração padrão quando o evento no Supabase não tem horário de término. */
export const DEFAULT_ICS_DURATION_MINUTES = 120;

export interface EventoAgenda {
  titulo: string;
  descricao?: string;
  local: string;
  dataInicio: Date;
  dataFim: Date;
  uid?: string;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

const pickIntlPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  Number.parseInt(parts.find((part) => part.type === type)?.value ?? '', 10);

const ICS_LOCAL_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_EVENT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Formata o instante no fuso da igreja (America/Sao_Paulo) para DTSTART/DTEND com TZID. */
export function formatIcsLocalDateTime(instant: Date): string {
  const parts = ICS_LOCAL_FORMATTER.formatToParts(instant);
  const year = pickIntlPart(parts, 'year');
  const month = pickIntlPart(parts, 'month');
  const day = pickIntlPart(parts, 'day');
  let hour = pickIntlPart(parts, 'hour');
  const minute = pickIntlPart(parts, 'minute');
  let second = pickIntlPart(parts, 'second');

  if (hour === 24) {
    hour = 0;
  }
  if (Number.isNaN(second)) {
    second = 0;
  }

  return `${year}${pad2(month)}${pad2(day)}T${pad2(hour)}${pad2(minute)}${pad2(second)}`;
}

export function formatIcsUtcDateTime(instant: Date): string {
  return [
    instant.getUTCFullYear(),
    pad2(instant.getUTCMonth() + 1),
    pad2(instant.getUTCDate()),
    'T',
    pad2(instant.getUTCHours()),
    pad2(instant.getUTCMinutes()),
    pad2(instant.getUTCSeconds()),
    'Z',
  ].join('');
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let bytes = encoder.encode(line);

  if (bytes.length <= 75) {
    return line;
  }

  const chunks: string[] = [];
  let first = true;

  while (bytes.length > 0) {
    const limit = first ? 75 : 74;
    let cut = Math.min(limit, bytes.length);

    while (cut > 0 && cut < bytes.length && (bytes[cut] & 0b11000000) === 0b10000000) {
      cut -= 1;
    }

    if (cut <= 0) {
      cut = Math.min(limit, bytes.length);
    }

    const piece = decoder.decode(bytes.slice(0, cut));
    chunks.push(first ? piece : ` ${piece}`);
    bytes = bytes.slice(cut);
    first = false;
  }

  return chunks.join('\r\n');
}

function icsLine(key: string, value: string): string {
  return foldIcsLine(`${key}:${escapeIcsText(value)}`);
}

export function buildIcsFileName(titulo: string): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();

  return `${slug || 'evento'}.ics`;
}

/**
 * Monta um VCALENDAR RFC 5545 com TZID America/Sao_Paulo.
 * Google Calendar, Apple Calendar e Outlook interpretam o VTIMEZONE e
 * mostram o horário local do aparelho sem atrasar/adiantar o culto.
 */
export function buildIcsCalendar(evento: EventoAgenda): string {
  const uid =
    (evento.uid?.trim() || `conecta-${evento.dataInicio.getTime()}@app-igreja`)
      .replace(/[\r\n]/g, '');
  const stamp = formatIcsUtcDateTime(new Date());
  const startLocal = formatIcsLocalDateTime(evento.dataInicio);
  const endLocal = formatIcsLocalDateTime(evento.dataFim);
  const summary = evento.titulo.trim() || 'Evento';
  const location = evento.local.trim();
  const description = (evento.descricao ?? '').trim();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Conecta//Agenda da Familia//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${APP_EVENT_TIMEZONE}`,
    'BEGIN:VTIMEZONE',
    `TZID:${APP_EVENT_TIMEZONE}`,
    `X-LIC-LOCATION:${APP_EVENT_TIMEZONE}`,
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:BRT',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    icsLine('UID', uid),
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${APP_EVENT_TIMEZONE}:${startLocal}`,
    `DTEND;TZID=${APP_EVENT_TIMEZONE}:${endLocal}`,
    icsLine('SUMMARY', summary),
    location ? icsLine('LOCATION', location) : null,
    description ? icsLine('DESCRIPTION', description) : null,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => Boolean(line));

  return `${lines.join('\r\n')}\r\n`;
}

export function buildIcsBlob(evento: EventoAgenda): Blob {
  return new Blob([buildIcsCalendar(evento)], {
    type: 'text/calendar;charset=utf-8',
  });
}

/**
 * Converte um evento da tabela `events` (Supabase) em EventoAgenda.
 * `event_date` é horário de parede da igreja (America/Sao_Paulo).
 */
export function eventoAgendaFromChurchEvent(input: {
  id?: string | null;
  titulo: string;
  descricao?: string;
  local?: string | null;
  eventDate: string | Date | null | undefined;
  dataFim?: Date;
  durationMinutes?: number;
}): EventoAgenda | null {
  const titulo = input.titulo.trim();
  if (!titulo) {
    return null;
  }

  let dataInicio: Date | null = null;

  if (input.eventDate instanceof Date && !Number.isNaN(input.eventDate.getTime())) {
    dataInicio = input.eventDate;
  } else if (typeof input.eventDate === 'string') {
    dataInicio = parseEventDateParts(input.eventDate)?.date ?? null;
  }

  if (!dataInicio) {
    return null;
  }

  const durationMs =
    (input.durationMinutes && input.durationMinutes > 0
      ? input.durationMinutes
      : DEFAULT_ICS_DURATION_MINUTES) * 60_000;

  const dataFim =
    input.dataFim && !Number.isNaN(input.dataFim.getTime())
      ? input.dataFim
      : new Date(dataInicio.getTime() + durationMs);

  return {
    titulo,
    descricao: input.descricao?.trim() || undefined,
    local: (input.local ?? '').trim(),
    dataInicio,
    dataFim,
    uid: input.id?.trim() ? `event-${input.id.trim()}@conecta` : undefined,
  };
}

function downloadIcsInBrowser(ics: string, fileName: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Download de calendário indisponível neste ambiente.');
  }

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '');

  if (isiOS) {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

async function shareIcsNative(ics: string, fileName: string): Promise<void> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Armazenamento temporário indisponível neste dispositivo.');
  }

  const fileUri = `${cacheDir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, ics, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento de arquivos não está disponível neste dispositivo.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/calendar',
    UTI: 'com.apple.ical.ics',
    dialogTitle: 'Adicionar à agenda',
  });
}

export async function downloadEventoAgendaIcs(evento: EventoAgenda): Promise<void> {
  const ics = buildIcsCalendar(evento);
  const fileName = buildIcsFileName(evento.titulo);

  if (Platform.OS === 'web') {
    downloadIcsInBrowser(ics, fileName);
    return;
  }

  await shareIcsNative(ics, fileName);
}

/** Confirmação de participação: baixa o .ics e mostra o modal combinado. */
export async function offerConfirmedEventToCalendar(input: {
  id?: string | null;
  titulo: string;
  local?: string | null;
  eventDate: string | Date | null | undefined;
}): Promise<void> {
  const titulo = input.titulo.trim() || 'Evento';
  const evento = eventoAgendaFromChurchEvent({
    id: input.id,
    titulo,
    local: input.local,
    eventDate: input.eventDate,
    descricao: `Compromisso confirmado no Conecta: ${titulo}.`,
  });

  try {
    if (evento) {
      await downloadEventoAgendaIcs(evento);
    }
  } catch (error) {
    console.warn('Download do calendário (.ics):', error);
  }

  await appAlert(
    'Compromisso enviado para minha agenda',
    evento
      ? 'O arquivo de calendário (.ics) foi gerado. Abra-o no Google Agenda, Apple Calendar ou Outlook.'
      : 'Sua participação foi confirmada. A data do evento ainda não está disponível para o calendário.'
  );
}
