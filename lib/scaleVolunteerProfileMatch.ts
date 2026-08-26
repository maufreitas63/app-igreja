/** Compara nome do perfil com nome cadastrado em voluntarios_escala (mesma lógica do SQL). */

export const normalizePersonName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const profileShortDisplayName = (fullName: string) => {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return normalizePersonName(trimmed);
  }

  return normalizePersonName(`${parts[0]} ${parts[parts.length - 1]}`);
};

export function profileNameMatchesVolunteerName(
  profileFullName: string | null | undefined,
  volunteerName: string | null | undefined
): boolean {
  const profile = profileFullName?.trim();
  const volunteer = volunteerName?.trim();

  if (!profile || !volunteer) {
    return false;
  }

  const normalizedProfile = normalizePersonName(profile);
  const normalizedVolunteer = normalizePersonName(volunteer);

  return (
    normalizedProfile === normalizedVolunteer
    || profileShortDisplayName(profile) === normalizedVolunteer
  );
}

export type ScaleTypeListEntry = {
  id: string;
  code: string;
  name: string;
};

export type ScaleScheduleEntry = {
  scale_id: string;
  scale_code: string;
  scale_name: string;
  volunteer_name: string;
};

/** Fallback quando o RPC de ACL ainda não foi aplicado no Supabase. */
export function derivePermittedScaleTypesFromSchedule(
  profileFullName: string | null | undefined,
  scheduleEntries: ScaleScheduleEntry[]
): ScaleTypeListEntry[] {
  const seen = new Set<string>();
  const result: ScaleTypeListEntry[] = [];

  for (const entry of scheduleEntries) {
    if (!profileNameMatchesVolunteerName(profileFullName, entry.volunteer_name)) {
      continue;
    }

    if (seen.has(entry.scale_code)) {
      continue;
    }

    seen.add(entry.scale_code);
    result.push({
      id: entry.scale_id,
      code: entry.scale_code,
      name: entry.scale_name,
    });
  }

  return result.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}
