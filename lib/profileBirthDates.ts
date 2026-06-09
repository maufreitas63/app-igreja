import { supabase } from '@/lib/supabase';

type MemberLike = {
  birth_date: string | null;
  full_name: string;
  phone: string | null;
};

const cleanPhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const normalizeName = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type ProfileBirthRow = {
  birth_date: string | null;
  full_name: string | null;
  phone: string | null;
};

type BirthDateLookup = {
  byPhone: Map<string, string | null>;
  byNormalizedPhone: Map<string, string | null>;
  byNormalizedName: Map<string, string | null>;
};

const buildBirthDateLookup = (profiles: ProfileBirthRow[]): BirthDateLookup => {
  const byPhone = new Map<string, string | null>();
  const byNormalizedPhone = new Map<string, string | null>();
  const byNormalizedName = new Map<string, string | null>();

  for (const profile of profiles) {
    const birthDate = profile.birth_date ?? null;
    const phone = profile.phone?.trim();

    if (phone) {
      byPhone.set(phone, birthDate);
      const digits = cleanPhone(phone);
      if (digits) {
        byNormalizedPhone.set(digits, birthDate);
      }
    }

    const fullName = profile.full_name?.trim();
    if (fullName) {
      byNormalizedName.set(normalizeName(fullName), birthDate);
    }
  }

  return { byPhone, byNormalizedPhone, byNormalizedName };
};

const resolveBirthDateFromLookup = (member: MemberLike, lookup: BirthDateLookup) => {
  const phone = member.phone?.trim();

  if (phone) {
    if (lookup.byPhone.has(phone)) {
      return lookup.byPhone.get(phone) ?? null;
    }

    const digits = cleanPhone(phone);
    if (digits && lookup.byNormalizedPhone.has(digits)) {
      return lookup.byNormalizedPhone.get(digits) ?? null;
    }
  }

  const normalizedName = member.full_name.trim();
  if (normalizedName && lookup.byNormalizedName.has(normalizeName(normalizedName))) {
    return lookup.byNormalizedName.get(normalizeName(normalizedName)) ?? null;
  }

  return undefined;
};

async function loadProfilesForBirthDateLookup(members: MemberLike[]) {
  const phones = [
    ...new Set(
      members
        .flatMap((member) => {
          const phone = member.phone?.trim();
          if (!phone) {
            return [];
          }

          const digits = cleanPhone(phone);
          return digits && digits !== phone ? [phone, digits] : [phone];
        })
        .filter(Boolean)
    ),
  ] as string[];

  const names = [
    ...new Set(members.map((member) => member.full_name.trim()).filter(Boolean)),
  ] as string[];

  const profileRows: ProfileBirthRow[] = [];

  if (phones.length) {
    const { data: phoneMatches, error: phoneError } = await supabase
      .from('profiles')
      .select('birth_date, full_name, phone')
      .in('phone', phones);

    if (phoneError) {
      console.warn('Não foi possível enriquecer birth_date por telefone:', phoneError.message);
    } else if (phoneMatches?.length) {
      profileRows.push(...phoneMatches);
    }
  }

  if (names.length) {
    const { data: nameMatches, error: nameError } = await supabase
      .from('profiles')
      .select('birth_date, full_name, phone')
      .in('full_name', names);

    if (nameError) {
      console.warn('Não foi possível enriquecer birth_date por nome:', nameError.message);
    } else if (nameMatches?.length) {
      profileRows.push(...nameMatches);
    }
  }

  return buildBirthDateLookup(profileRows);
}

export async function applyProfileBirthDates<T extends MemberLike>(members: T[]) {
  if (!members.length) {
    return members;
  }

  const lookup = await loadProfilesForBirthDateLookup(members);

  return members.map((member) => {
    const profileBirthDate = resolveBirthDateFromLookup(member, lookup);

    if (profileBirthDate === undefined) {
      return member;
    }

    return {
      ...member,
      birth_date: profileBirthDate,
    };
  });
}
