export type BirthdaysClassEntry = {
  full_name: string;
  birth_date: string;
  phone: string | null;
  day: number;
  month: number;
};

export type BirthdaysClassMonthOption = {
  value: string;
  label: string;
};

export const BIRTHDAYS_CLASS_MONTHS: readonly BirthdaysClassMonthOption[] = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
] as const;
