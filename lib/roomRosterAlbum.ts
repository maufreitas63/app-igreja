import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import type { FamilyGuardianInfo, RoomInscribedChild } from '@/types/checkin';

type RosterPayload = {
  allowed?: boolean;
  message?: string | null;
  children?: unknown;
};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asStatus = (value: unknown): RoomInscribedChild['checkinStatus'] => {
  if (value === 'in_room' || value === 'released' || value === 'pending') {
    return value;
  }
  return 'pending';
};

const mapGuardian = (value: unknown): FamilyGuardianInfo | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const fullName = asText(row.fullName);
  if (!id || !fullName) {
    return null;
  }
  return {
    id,
    fullName,
    relationship: asText(row.relationship),
    phone: asText(row.phone),
  };
};

const mapChild = (value: unknown): RoomInscribedChild | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const fullName = asText(row.fullName);
  if (!id || !fullName) {
    return null;
  }
  const ageYears = Number(row.ageYears);
  const guardians = Array.isArray(row.guardians)
    ? row.guardians.map(mapGuardian).filter((item): item is FamilyGuardianInfo => item != null)
    : [];

  return {
    id,
    fullName,
    birthDate: asText(row.birthDate),
    ageYears: Number.isFinite(ageYears) && ageYears > 0 ? Math.floor(ageYears) : 0,
    selfieUrl: asText(row.selfieUrl) || null,
    medicalFoodAlerts: asText(row.medicalFoodAlerts) || null,
    additionalCareNotes: asText(row.additionalCareNotes) || null,
    specialNeeds: asText(row.specialNeeds) || null,
    specialNeedsNotes: asText(row.specialNeedsNotes) || null,
    familyId: asText(row.familyId),
    checkinStatus: asStatus(row.checkinStatus),
    checkinTime: asText(row.checkinTime) || null,
    guardians,
  };
};

export async function loadRoomRosterAlbum(eventId: string, roomKey: 'KIDS' | 'TEENS') {
  const { data, error } = await supabase.rpc('get_room_roster_album', {
    p_event_id: eventId,
    p_room_key: roomKey,
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível carregar o álbum da sala.');
  }

  const payload = (data ?? {}) as RosterPayload;
  const children = Array.isArray(payload.children)
    ? payload.children.map(mapChild).filter((item): item is RoomInscribedChild => item != null)
    : [];

  return {
    allowed: payload.allowed === true,
    message:
      asText(payload.message)
      || 'Sem permissão para ver o álbum de inscritos nesta instância.',
    children: payload.allowed === true ? children : [],
  };
}

export async function setRoomRegistrationEntry(registrationId: string, checked: boolean) {
  const actorProfileId = await resolveActorProfileId({ forceRefresh: false });
  const { data, error } = await supabase.rpc('set_event_registration_room_entry', {
    p_registration_id: registrationId,
    p_room_entry_checked: checked,
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível registrar a entrada.');
  }

  const result = (data ?? {}) as { success?: boolean; message?: string };
  if (!result.success) {
    throw new Error(result.message || 'Não foi possível registrar a entrada.');
  }

  return result.message ?? 'Entrada registrada.';
}

export async function releaseRoomRegistration(registrationId: string) {
  const actorProfileId = await resolveActorProfileId({ forceRefresh: false });
  const { data, error } = await supabase.rpc('set_event_registration_room_release', {
    p_registration_id: registrationId,
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível registrar a saída.');
  }

  const result = (data ?? {}) as { success?: boolean; message?: string };
  if (!result.success) {
    throw new Error(result.message || 'Não foi possível registrar a saída.');
  }

  return result.message ?? 'Saída registrada.';
}

export function formatRosterAge(birthDate: string, ageYears: number) {
  const iso = birthDate.trim();
  if (!iso) {
    return ageYears > 0 ? `${ageYears} ${ageYears === 1 ? 'ano' : 'anos'}` : 'Idade não informada';
  }

  const birth = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return ageYears > 0 ? `${ageYears} ${ageYears === 1 ? 'ano' : 'anos'}` : 'Idade não informada';
  }

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) {
    years = 0;
  }

  const yearLabel = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  const monthLabel = `${months} ${months === 1 ? 'mês' : 'meses'}`;
  if (years === 0) {
    return monthLabel;
  }
  if (months === 0) {
    return yearLabel;
  }
  return `${yearLabel} e ${monthLabel}`;
}

export function rosterInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase() || '?';
}
