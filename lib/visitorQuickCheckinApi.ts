import { normalizePhoneDigits } from '@/lib/phoneDigits';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const VISITOR_QUICK_CHECKIN_SQL_HINT =
  'Execute no Supabase: scripts/visitor-quick-checkin.sql';

export const ACCESS_VISITOR_QUICK_CHECKIN = 'dashboard.card.visitor_quick_checkin' as const;

export type VisitorQuickChildInput = {
  profile_id?: string | null;
  full_name: string;
  birth_date?: string | null;
  age_years?: string | null;
  medical_food_alerts?: string | null;
  special_needs?: string | null;
  additional_care_notes?: string | null;
};

export type VisitorQuickLookupStatus =
  | 'member_blocked'
  | 'recurring_visitor'
  | 'new_visitor'
  | 'invalid_phone';

export type VisitorQuickGuardian = {
  id?: string;
  full_name?: string | null;
  phone?: string | null;
  family_id?: string | null;
  role_code?: string | null;
  lgpd_accepted?: boolean | null;
};

export type VisitorQuickChild = {
  profile_id?: string | null;
  full_name: string;
  birth_date?: string | null;
  medical_food_alerts?: string | null;
  special_needs?: string | null;
  additional_care_notes?: string | null;
  lgpd_accepted?: boolean | null;
  kids_status?: string | null;
  registration_id?: string | null;
};

export type VisitorQuickEvent = {
  id: string;
  name?: string | null;
  event_date?: string | null;
  visitor_checkin_code?: string | null;
};

export type VisitorQuickLookupResult = {
  success: boolean;
  status: VisitorQuickLookupStatus | string;
  message: string;
  guardian?: VisitorQuickGuardian | null;
  children?: VisitorQuickChild[];
  event?: VisitorQuickEvent | null;
};

export type VisitorQuickSubmitResult = {
  success: boolean;
  status?: string;
  message: string;
  family_id?: string | null;
  check_in_qr?: string | null;
  guardian?: VisitorQuickGuardian | null;
  children?: VisitorQuickChild[];
  event?: VisitorQuickEvent | null;
  whatsapp?: {
    phone?: string | null;
    family_id?: string | null;
    event_name?: string | null;
  } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseGuardian(raw: unknown): VisitorQuickGuardian | null {
  const row = asRecord(raw);
  if (!row) return null;
  return {
    id: asText(row.id) ?? undefined,
    full_name: asText(row.full_name),
    phone: asText(row.phone),
    family_id: asText(row.family_id),
    role_code: asText(row.role_code),
    lgpd_accepted: row.lgpd_accepted === true,
  };
}

function parseChildren(raw: unknown): VisitorQuickChild[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const fullName = asText(row.full_name);
      if (!fullName) return null;
      return {
        profile_id: asText(row.profile_id),
        full_name: fullName,
        birth_date: asText(row.birth_date),
        medical_food_alerts: asText(row.medical_food_alerts),
        special_needs: asText(row.special_needs),
        additional_care_notes: asText(row.additional_care_notes),
        lgpd_accepted: row.lgpd_accepted === true,
        kids_status: asText(row.kids_status),
        registration_id: asText(row.registration_id),
      } satisfies VisitorQuickChild;
    })
    .filter((item): item is VisitorQuickChild => Boolean(item));
}

function parseEvent(raw: unknown): VisitorQuickEvent | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asText(row.id);
  if (!id) return null;
  return {
    id,
    name: asText(row.name),
    event_date: asText(row.event_date),
    visitor_checkin_code: asText(row.visitor_checkin_code),
  };
}

function mapRpcError(error: { message?: string }, rpcName: string): Error {
  if (isSupabaseRpcMissingError(error, rpcName)) {
    return new Error(VISITOR_QUICK_CHECKIN_SQL_HINT);
  }
  return new Error(error.message || 'Falha no cadastro rápido de visitantes.');
}

export async function lookupVisitorQuickCheckin(
  phone: string,
  eventCode: string
): Promise<VisitorQuickLookupResult> {
  const digits = normalizePhoneDigits(phone);
  const code = String(eventCode ?? '').replace(/\D/g, '').slice(0, 4);

  const { data, error } = await supabase.rpc('lookup_visitor_quick_checkin', {
    p_phone: digits,
    p_event_code: code,
  });

  if (error) {
    throw mapRpcError(error, 'lookup_visitor_quick_checkin');
  }

  const row = asRecord(data) ?? {};
  return {
    success: row.success === true,
    status: asText(row.status) ?? 'invalid_phone',
    message: asText(row.message) ?? 'Não foi possível consultar o celular.',
    guardian: parseGuardian(row.guardian),
    children: parseChildren(row.children),
    event: parseEvent(row.event),
  };
}

export async function submitVisitorQuickCheckin(input: {
  phone: string;
  eventCode: string;
  guardianName: string;
  lgpdAccepted: boolean;
  children: VisitorQuickChildInput[];
}): Promise<VisitorQuickSubmitResult> {
  const payload = {
    phone: normalizePhoneDigits(input.phone),
    event_code: String(input.eventCode ?? '').replace(/\D/g, '').slice(0, 4),
    guardian_name: input.guardianName.trim(),
    lgpd_accepted: input.lgpdAccepted,
    children: input.children.map((child) => ({
      profile_id: child.profile_id ?? null,
      full_name: child.full_name.trim(),
      birth_date: child.birth_date?.trim() || null,
      age_years: child.age_years?.trim() || null,
      medical_food_alerts: child.medical_food_alerts?.trim() || null,
      special_needs: child.special_needs?.trim() || null,
      additional_care_notes: child.additional_care_notes?.trim() || null,
    })),
  };

  const { data, error } = await supabase.rpc('submit_visitor_quick_checkin', {
    p_payload: payload,
  });

  if (error) {
    throw mapRpcError(error, 'submit_visitor_quick_checkin');
  }

  const row = asRecord(data) ?? {};
  const whatsapp = asRecord(row.whatsapp);

  return {
    success: row.success === true,
    status: asText(row.status) ?? undefined,
    message: asText(row.message) ?? 'Não foi possível concluir o check-in.',
    family_id: asText(row.family_id),
    check_in_qr: asText(row.check_in_qr) ?? asText(row.family_id),
    guardian: parseGuardian(row.guardian),
    children: parseChildren(row.children),
    event: parseEvent(row.event),
    whatsapp: whatsapp
      ? {
          phone: asText(whatsapp.phone),
          family_id: asText(whatsapp.family_id),
          event_name: asText(whatsapp.event_name),
        }
      : null,
  };
}

/** Mensagem de boas-vindas com código do crachá/QR para o WhatsApp do visitante. */
export function buildVisitorQuickCheckinWhatsAppMessage(options: {
  guardianName?: string | null;
  familyId: string;
  eventName?: string | null;
}) {
  const greetingName = String(options.guardianName ?? '').trim() || 'família';
  const eventLabel = String(options.eventName ?? '').trim() || 'o culto de hoje';
  return [
    `Olá, ${greetingName}! Seja bem-vindo(a) 🙌`,
    `Seu check-in no Espaço Infantil para ${eventLabel} está confirmado.`,
    `Crachá digital / QR Code da família: *${options.familyId}*`,
    'Apresente este código (ou o QR no app) na retirada segura da criança.',
    'Que Deus abençoe a sua visita!',
  ].join('\n\n');
}
