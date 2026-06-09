import { APP_EVENT_TIMEZONE, parseEventDateParts } from '@/lib/eventDate';
import type { QuorumRegistryRow } from '@/lib/quorumRegistry';

const CHECKIN_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_EVENT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});

/** Hora exibida na lista de presença (confirmação no totem ou registro na audiência). */
export function resolveQuorumCheckinInstant(row: QuorumRegistryRow) {
  const normalized = row.checkin_status.trim().toLowerCase();
  if (normalized === 'confirmado' && row.confirmed_at) {
    return row.confirmed_at;
  }

  return row.registered_at;
}

export function formatQuorumCheckinTime(row: QuorumRegistryRow) {
  const instant = resolveQuorumCheckinInstant(row);
  const parsed = new Date(instant);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return CHECKIN_TIME_FORMATTER.format(parsed);
}

const MONTH_NAMES_PT_BR = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Rótulo longo de data do evento para o cabeçalho do documento. */
export function formatEventDateDocumentLabel(value: string | null | undefined) {
  const parts = parseEventDateParts(value);
  if (!parts) {
    return '[Data do evento]';
  }

  const month = MONTH_NAMES_PT_BR[parts.month - 1] ?? String(parts.month);
  return `${parts.day} de ${month} de ${parts.year}`;
}

export function formatEventTimeRangeLabel(value: string | null | undefined) {
  const parts = parseEventDateParts(value);
  if (!parts) {
    return '[Horário]';
  }

  return `${parts.hour}:${parts.minute}`;
}
