import { getAppParameterValue } from '@/lib/appParameters';

export type KidsTeensStatus = 'KIDS' | 'TEENS';

export type KidsTeensAgeLimits = {
  idadeKids: number | null;
  idadeTeens: number | null;
};

const parseAgeLimit = (value: string | null) => {
  if (!value || !/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number.parseInt(value.trim(), 10);
};

export const getAgeFromBirthDate = (birthDate: string | null | undefined) => {
  if (!birthDate) {
    return null;
  }

  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if ([year, month, day].some(Number.isNaN)) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
};

export const resolveKidsTeensStatusFromBirthDate = (
  birthDate: string | null | undefined,
  limits: KidsTeensAgeLimits
): KidsTeensStatus | undefined => {
  const age = getAgeFromBirthDate(birthDate);
  const { idadeKids, idadeTeens } = limits;

  if (age === null) {
    return undefined;
  }

  if (idadeKids !== null && age <= idadeKids) {
    return 'KIDS';
  }

  if (idadeKids !== null && idadeTeens !== null && age > idadeKids && age <= idadeTeens) {
    return 'TEENS';
  }

  return undefined;
};

export async function loadKidsTeensAgeLimits(): Promise<KidsTeensAgeLimits> {
  const [idadeKidsValue, idadeTeensValue] = await Promise.all([
    getAppParameterValue('idade_kids'),
    getAppParameterValue('idade_teens'),
  ]);

  return {
    idadeKids: parseAgeLimit(idadeKidsValue),
    idadeTeens: parseAgeLimit(idadeTeensValue),
  };
}
