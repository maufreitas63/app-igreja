/**
 * Agendamento de atendimento pastoral.
 * SQL: scripts/pastoral-slots-schema.sql
 */

import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import {
  buildCalendarCancelPageUrl,
  buildGoogleCalendarUrl,
  eventoAgendaFromChurchEvent,
} from '@/lib/calendarIcs';

export const PASTORAL_SLOTS_SQL_HINT =
  'Execute no Supabase: scripts/pastoral-slots-schema.sql';

export const PASTORAL_SLOT_STATUSES = ['disponivel', 'reservado', 'concluido'] as const;
export type PastoralSlotStatus = (typeof PASTORAL_SLOT_STATUSES)[number];

export const PASTORAL_ATTENDANCE_TYPES = ['presencial', 'online'] as const;
export type PastoralAttendanceType = (typeof PASTORAL_ATTENDANCE_TYPES)[number];

export const PASTORAL_SLOT_STATUS_LABEL: Record<PastoralSlotStatus, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  concluido: 'Concluído',
};

export const PASTORAL_ATTENDANCE_TYPE_LABEL: Record<PastoralAttendanceType, string> = {
  presencial: 'Presencial',
  online: 'Online',
};

export type PastoralAttendant = {
  id: string;
  full_name: string;
};

export type AvailablePastoralSlot = {
  id: string;
  pastor_id: string;
  pastor_name: string;
  pastor_phone: string | null;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_atendimento: PastoralAttendanceType;
  status: PastoralSlotStatus;
};

export type MyPastoralAppointment = {
  id: string;
  pastoral_request_id: string | null;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_atendimento: PastoralAttendanceType;
  status: PastoralSlotStatus;
  pastor_name: string;
  pastor_phone: string | null;
  request_status: string | null;
  destination_label: string | null;
  can_cancel: boolean;
};

export type PastoralAgendaSlot = {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status: PastoralSlotStatus;
  tipo_atendimento: PastoralAttendanceType;
  is_published: boolean;
  member_name: string | null;
  destination_label: string | null;
  motivo: string | null;
  can_checkin: boolean;
};

export type PastoralSlotNotice = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const throwIfMissing = (error: { message?: string }, name: string) => {
  if (isSupabaseRpcMissingError(error, name)) {
    throw new Error(PASTORAL_SLOTS_SQL_HINT);
  }
};

const rpcJson = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});

  if (error) {
    throwIfMissing(error, name);
    throw new Error(error.message || 'Falha no agendamento pastoral.');
  }

  return asRecord(data);
};

const parseTipo = (value: unknown): PastoralAttendanceType =>
  value === 'online' ? 'online' : 'presencial';

const parseStatus = (value: unknown): PastoralSlotStatus => {
  if (value === 'reservado' || value === 'concluido') {
    return value;
  }

  return 'disponivel';
};

export function formatPastoralSlotDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPastoralSlotTimeRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '—';
  }

  const day = startDate.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startTime}–${endTime}`;
}

export function startOfWeekIso(base = new Date()) {
  const date = new Date(base);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function addDaysIso(iso: string, days: number) {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export async function fetchPastoralAttendants(): Promise<PastoralAttendant[]> {
  const payload = await rpcJson('list_pastoral_attendants');
  const rows = Array.isArray(payload.attendants) ? payload.attendants : [];

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();
      const name = String(row.full_name ?? '').trim();

      if (!id || !name) {
        return null;
      }

      return { id, full_name: name };
    })
    .filter((row): row is PastoralAttendant => row !== null);
}

export async function fetchAvailablePastoralSlots(pastorId?: string | null) {
  const payload = await rpcJson('list_available_pastoral_slots', {
    p_pastor_id: pastorId || null,
  });

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Sem permissão para ver horários.'));
  }

  const rows = Array.isArray(payload.slots) ? payload.slots : [];

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();

      if (!id) {
        return null;
      }

      return {
        id,
        pastor_id: String(row.pastor_id ?? ''),
        pastor_name: String(row.pastor_name ?? 'Atendente'),
        pastor_phone: String(row.pastor_phone ?? '').trim() || null,
        data_hora_inicio: String(row.data_hora_inicio ?? ''),
        data_hora_fim: String(row.data_hora_fim ?? ''),
        tipo_atendimento: parseTipo(row.tipo_atendimento),
        status: parseStatus(row.status),
      } satisfies AvailablePastoralSlot;
    })
    .filter((row): row is AvailablePastoralSlot => row !== null);
}

export function buildPastoralAppointmentCalendarEvent(input: {
  slotId?: string | null;
  memberName: string;
  pastorName: string;
  startsAt: string;
  endsAt: string;
  tipo: PastoralAttendanceType;
  forAttendant?: boolean;
}) {
  const startsDate = input.startsAt ? new Date(input.startsAt) : null;
  const endsDate = input.endsAt ? new Date(input.endsAt) : null;

  if (!startsDate || Number.isNaN(startsDate.getTime())) {
    return null;
  }

  const memberName = input.memberName.trim() || 'Irmão';
  const pastorName = input.pastorName.trim() || 'Atendente';
  const tipoLabel = PASTORAL_ATTENDANCE_TYPE_LABEL[input.tipo];
  const counterpart = input.forAttendant ? memberName : pastorName;

  return eventoAgendaFromChurchEvent({
    id: input.slotId,
    titulo: `Atendimento pastoral · ${counterpart}`,
    local: input.tipo === 'online' ? 'Online' : 'Presencial',
    eventDate: startsDate,
    eventEndDate: endsDate && !Number.isNaN(endsDate.getTime()) ? endsDate : undefined,
    descricao: `${memberName} confirmou atendimento ${tipoLabel} com ${pastorName}.`,
  });
}

export function buildPastoralBookingWhatsAppMessage(input: {
  pastorName: string;
  memberName: string;
  startsAt: string;
  endsAt: string;
  tipo: PastoralAttendanceType;
  slotId?: string | null;
}) {
  const pastorFirst = input.pastorName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
  const memberName = input.memberName.trim() || 'Um irmão da igreja';
  const when = formatPastoralSlotTimeRange(input.startsAt, input.endsAt);
  const tipo = PASTORAL_ATTENDANCE_TYPE_LABEL[input.tipo];
  const evento = buildPastoralAppointmentCalendarEvent({
    ...input,
    forAttendant: true,
  });
  const calendarUrl = evento ? buildGoogleCalendarUrl(evento) : null;

  const lines = [
    pastorFirst ? `Olá, ${pastorFirst}!` : 'Olá!',
    '',
    `${memberName} reservou um horário que estava disponível na sua agenda pastoral.`,
    '',
    `Quando: ${when}`,
    `Tipo: ${tipo}`,
    '',
    'Esta mensagem confirma a reserva do horário.',
  ];

  if (calendarUrl) {
    lines.push('', 'Para adicionar este compromisso na sua agenda, toque no link:', calendarUrl);
  }

  return lines.join('\n');
}

export function buildPastoralCancelWhatsAppMessage(input: {
  pastorName: string;
  memberName: string;
  startsAt: string;
  endsAt: string;
  tipo: PastoralAttendanceType;
  reason: string;
  slotId?: string | null;
}) {
  const pastorFirst = input.pastorName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
  const memberName = input.memberName.trim() || 'Um irmão da igreja';
  const when = formatPastoralSlotTimeRange(input.startsAt, input.endsAt);
  const tipo = PASTORAL_ATTENDANCE_TYPE_LABEL[input.tipo];
  const reason = input.reason.trim();
  const evento = buildPastoralAppointmentCalendarEvent({
    pastorName: input.pastorName,
    memberName: input.memberName,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    tipo: input.tipo,
    slotId: input.slotId,
    forAttendant: true,
  });
  const cancelUrl = evento ? buildCalendarCancelPageUrl(evento) : null;

  const lines = [
    pastorFirst ? `Olá, ${pastorFirst}!` : 'Olá!',
    '',
    `${memberName} cancelou o horário que havia reservado na sua agenda pastoral.`,
    '',
    `Quando: ${when}`,
    `Tipo: ${tipo}`,
    `Justificativa: ${reason}`,
    '',
    'O horário voltou a ficar disponível na sua agenda.',
  ];

  if (cancelUrl) {
    lines.push(
      '',
      'Se o compromisso já estiver na sua agenda, toque no link para removê-lo:',
      cancelUrl
    );
  }

  return lines.join('\n');
}

export async function bookPastoralSlot(slotId: string, requestId?: string | null) {
  const payload = await rpcJson('book_pastoral_slot', {
    p_slot_id: slotId,
    p_request_id: requestId || null,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Falha ao agendar.'),
    pastorName: String(payload.pastor_name ?? '').trim() || null,
    pastorPhone: String(payload.pastor_phone ?? '').trim() || null,
    startsAt: String(payload.data_hora_inicio ?? '').trim() || null,
    endsAt: String(payload.data_hora_fim ?? '').trim() || null,
    tipo: parseTipo(payload.tipo_atendimento),
  };
}

export async function fetchMyPastoralAppointments(): Promise<MyPastoralAppointment[]> {
  const payload = await rpcJson('list_my_pastoral_appointments');
  const rows = Array.isArray(payload.appointments) ? payload.appointments : [];

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();

      if (!id) {
        return null;
      }

      const status = parseStatus(row.status);
      const startsAt = String(row.data_hora_inicio ?? '');
      const startsDate = startsAt ? new Date(startsAt) : null;
      const canCancelByTime =
        status === 'reservado'
        && startsDate
        && !Number.isNaN(startsDate.getTime())
        && startsDate.getTime() > Date.now();

      return {
        id,
        pastoral_request_id: row.pastoral_request_id ? String(row.pastoral_request_id) : null,
        data_hora_inicio: startsAt,
        data_hora_fim: String(row.data_hora_fim ?? ''),
        tipo_atendimento: parseTipo(row.tipo_atendimento),
        status,
        pastor_name: String(row.pastor_name ?? ''),
        pastor_phone: String(row.pastor_phone ?? '').trim() || null,
        request_status: row.request_status != null ? String(row.request_status) : null,
        destination_label: row.destination_label != null ? String(row.destination_label) : null,
        can_cancel: row.can_cancel === true || canCancelByTime,
      } satisfies MyPastoralAppointment;
    })
    .filter((row): row is MyPastoralAppointment => row !== null);
}

export async function cancelPastoralSlot(slotId: string, reason: string) {
  const payload = await rpcJson('cancel_pastoral_slot', {
    p_slot_id: slotId,
    p_reason: reason,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Falha ao cancelar.'),
    pastorName: String(payload.pastor_name ?? '').trim() || null,
    pastorPhone: String(payload.pastor_phone ?? '').trim() || null,
    startsAt: String(payload.data_hora_inicio ?? '').trim() || null,
    endsAt: String(payload.data_hora_fim ?? '').trim() || null,
    tipo: parseTipo(payload.tipo_atendimento),
  };
}

export async function fetchMyPastoralAgenda(fromIso: string, untilIso: string) {
  const payload = await rpcJson('list_my_pastoral_agenda', {
    p_from: fromIso,
    p_until: untilIso,
  });

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Sem permissão para a agenda.'));
  }

  const rows = Array.isArray(payload.slots) ? payload.slots : [];

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();

      if (!id) {
        return null;
      }

      return {
        id,
        data_hora_inicio: String(row.data_hora_inicio ?? ''),
        data_hora_fim: String(row.data_hora_fim ?? ''),
        status: parseStatus(row.status),
        tipo_atendimento: parseTipo(row.tipo_atendimento),
        is_published: row.is_published === true,
        member_name: row.member_name != null ? String(row.member_name) : null,
        destination_label: row.destination_label != null ? String(row.destination_label) : null,
        motivo: row.motivo != null ? String(row.motivo) : null,
        can_checkin: row.can_checkin === true,
      } satisfies PastoralAgendaSlot;
    })
    .filter((row): row is PastoralAgendaSlot => row !== null);
}

export async function savePastoralSlot(input: {
  id?: string | null;
  startsAt: string;
  endsAt: string;
  tipo: PastoralAttendanceType;
  isPublished: boolean;
}) {
  const payload = await rpcJson('upsert_pastoral_slot', {
    p_id: input.id ?? null,
    p_data_hora_inicio: input.startsAt,
    p_data_hora_fim: input.endsAt,
    p_tipo_atendimento: input.tipo,
    p_is_published: input.isPublished,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (payload.success === true ? 'Horário salvo.' : 'Falha ao salvar.')),
    id: payload.id ? String(payload.id) : null,
  };
}

export async function checkinPastoralSlot(slotId: string) {
  const payload = await rpcJson('checkin_pastoral_slot', { p_slot_id: slotId });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Falha no check-in.'),
  };
}

export async function deletePastoralSlot(slotId: string) {
  const payload = await rpcJson('delete_pastoral_slot', { p_slot_id: slotId });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Falha ao excluir.'),
  };
}

export async function fetchMyPastoralSlotNotices(): Promise<PastoralSlotNotice[]> {
  try {
    const payload = await rpcJson('list_my_pastoral_slot_notices');
    const rows = Array.isArray(payload.notices) ? payload.notices : [];

    return rows
      .map((item) => {
        const row = asRecord(item);
        const id = String(row.id ?? '').trim();
        const body = String(row.body ?? '').trim();

        if (!id || !body) {
          return null;
        }

        return {
          id,
          title: String(row.title ?? 'Atendimento pastoral'),
          body,
          created_at: String(row.created_at ?? ''),
          read_at: row.read_at != null ? String(row.read_at) : null,
        } satisfies PastoralSlotNotice;
      })
      .filter((row): row is PastoralSlotNotice => row !== null);
  } catch {
    return [];
  }
}

export async function markPastoralSlotNoticesRead() {
  try {
    await rpcJson('mark_pastoral_slot_notices_read');
  } catch {
    // Aviso já foi exibido; falha silenciosa no marcador.
  }
}
