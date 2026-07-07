import { BIRTHDAYS_CLASS_MONTHS } from '@/lib/birthdaysClassTypes';

const BIRTHDAY_MONTH_LABEL_BY_VALUE = new Map(
  BIRTHDAYS_CLASS_MONTHS.map((month) => [month.value, month.label] as const)
);

export const parseBirthdayParts = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim();
  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);

    if (Number.isFinite(month) && Number.isFinite(day)) {
      return { month, day };
    }
  }

  const brMatch = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brMatch) {
    const day = Number.parseInt(brMatch[1], 10);
    const month = Number.parseInt(brMatch[2], 10);

    if (Number.isFinite(month) && Number.isFinite(day)) {
      return { month, day };
    }
  }

  return null;
};

export const formatBirthdayDayMonth = (day: number, month: number) =>
  `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;

export const getCurrentBirthdayMonth = () => String(new Date().getMonth() + 1);

export const resolveBirthdayMonthLabel = (monthValue: string) =>
  BIRTHDAY_MONTH_LABEL_BY_VALUE.get(monthValue) ?? 'Mês';
