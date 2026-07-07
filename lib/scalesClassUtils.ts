import type { ProfilePhoneRow } from '@/lib/scalesClassTypes';

export const normalizeParameterValue = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export const formatServiceDateLabel = (value: string | null | undefined) => {
  if (!value) {
    return 'Escala';
  }

  const normalizedValue = String(value).trim();
  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1].slice(-2)}`;
  }

  return normalizedValue;
};

export const getCurrentLocalIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const isParkingWelcomeScale = (scaleName: string, scaleCode: string) => {
  const normalizedName = normalizeParameterValue(scaleName);
  const normalizedCode = normalizeParameterValue(scaleCode);

  return (
    (normalizedName.includes('acolhimento') && normalizedName.includes('estacionamento'))
    || normalizedName.includes('acolhimentoestacionamento')
    || normalizedCode.includes('acolhimento_estacionamento')
    || normalizedCode.includes('acolhimentoestacionamento')
    || normalizedCode === 'vigilancia_estacionamento'
    || normalizedCode.includes('vigilancia_estacionamento')
    || (normalizedName.includes('vigilancia') && normalizedName.includes('estacionamento'))
  );
};

export const isIntercessionScale = (scaleName: string, scaleCode: string) => {
  const normalizedName = normalizeParameterValue(scaleName);
  const normalizedCode = normalizeParameterValue(scaleCode);

  return (
    normalizedName.includes('intercess')
    || normalizedCode.includes('intercess')
    || (normalizedName.includes('ministerio') && normalizedName.includes('intercess'))
  );
};

export const resolveProfilePhoneForVolunteerName = (
  volunteerName: string,
  profiles: ProfilePhoneRow[]
) => {
  const normalizedName = normalizeParameterValue(volunteerName);

  if (!normalizedName) {
    return null;
  }

  const byFullName = profiles.find((profile) => {
    const profileName = normalizeParameterValue(profile.full_name ?? '');
    return profileName === normalizedName && Boolean(profile.phone);
  });

  if (byFullName?.phone) {
    return String(byFullName.phone);
  }

  const byShortName = profiles.find((profile) => {
    if (!profile.full_name || !profile.phone) {
      return false;
    }

    const shortName = normalizeParameterValue(formatDisplayName(profile.full_name));
    return shortName === normalizedName;
  });

  return byShortName?.phone ? String(byShortName.phone) : null;
};
