export type FinancialMonthKey = {
  year: number;
  month: number;
};

export const FINANCIAL_MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const formatFinancialMonthKey = ({ year, month }: FinancialMonthKey) =>
  `${year}-${String(month).padStart(2, '0')}`;

export const formatFinancialMonthLabel = ({ year, month }: FinancialMonthKey) => {
  const monthName = FINANCIAL_MONTH_LABELS[month - 1] ?? `Mês ${month}`;
  return `${monthName} ${year}`;
};

export const parseFinancialMonthKey = (value: string): FinancialMonthKey | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

export const parseFinancialMonthFromDate = (transactionDate: string): FinancialMonthKey | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(transactionDate);

  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

export const getFinancialMonthDateRange = ({ year, month }: FinancialMonthKey) => {
  const lastDay = new Date(year, month, 0).getDate();

  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
};

export const compareFinancialMonthKeys = (
  left: FinancialMonthKey,
  right: FinancialMonthKey
) => {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
};

export const getCalendarMonthKey = (referenceDate = new Date()): FinancialMonthKey => ({
  year: referenceDate.getFullYear(),
  month: referenceDate.getMonth() + 1,
});

/** Últimos `count` meses de calendário terminando em `endMonth` (ordem cronológica). */
export const getTrailingFinancialMonths = (
  endMonth: FinancialMonthKey,
  count: number
): FinancialMonthKey[] => {
  const months: FinancialMonthKey[] = [];
  let current = endMonth;

  for (let index = 0; index < count; index += 1) {
    months.unshift(current);
    current = getPreviousFinancialMonth(current);
  }

  return months;
};

/** Mês imediatamente anterior a `month` no calendário. */
export const getPreviousFinancialMonth = (month: FinancialMonthKey): FinancialMonthKey => {
  if (month.month === 1) {
    return { year: month.year - 1, month: 12 };
  }

  return { year: month.year, month: month.month - 1 };
};

export const getNextFinancialMonth = (month: FinancialMonthKey): FinancialMonthKey => {
  if (month.month === 12) {
    return { year: month.year + 1, month: 1 };
  }

  return { year: month.year, month: month.month + 1 };
};

/** Meses para manutenção/carga: passado amplo + mês atual + meses futuros próximos. */
export const buildFinancialMaintenanceMonthOptions = (
  referenceDate = new Date(),
  options?: { monthsBack?: number; monthsForward?: number }
) => {
  const monthsBack = options?.monthsBack ?? 72;
  const monthsForward = options?.monthsForward ?? 12;
  const anchor = getCalendarMonthKey(referenceDate);
  const keys = new Set<string>();
  const result: FinancialMonthKey[] = [];

  let cursor = anchor;

  for (let index = 0; index < monthsForward; index += 1) {
    cursor = getNextFinancialMonth(cursor);
  }

  for (let index = 0; index < monthsBack + monthsForward + 1; index += 1) {
    const key = formatFinancialMonthKey(cursor);

    if (!keys.has(key)) {
      keys.add(key);
      result.push(cursor);
    }

    cursor = getPreviousFinancialMonth(cursor);
  }

  return result.sort((left, right) => compareFinancialMonthKeys(right, left));
};

export const buildFinancialMaintenanceYearOptions = (
  referenceDate = new Date(),
  options?: { yearsBack?: number; yearsForward?: number }
) => {
  const yearsBack = options?.yearsBack ?? 10;
  const yearsForward = options?.yearsForward ?? 2;
  const currentYear = referenceDate.getFullYear();
  const years: number[] = [];

  for (let year = currentYear + yearsForward; year >= currentYear - yearsBack; year -= 1) {
    years.push(year);
  }

  return years;
};

/** Rótulo curto para cabeçalhos de coluna (ex.: Jan/26). */
export const formatFinancialMonthShortLabel = ({ year, month }: FinancialMonthKey) => {
  const shortYear = String(year).slice(-2);
  const monthName = FINANCIAL_MONTH_LABELS[month - 1]?.slice(0, 3) ?? String(month).padStart(2, '0');
  return `${monthName}/${shortYear}`;
};

/** Mês civil anterior ao mês corrente (ex.: em jun/2026 → maio/2026). */
export const getPreviousCalendarMonth = (referenceDate = new Date()): FinancialMonthKey => {
  const current = getCalendarMonthKey(referenceDate);

  if (current.month === 1) {
    return { year: current.year - 1, month: 12 };
  }

  return { year: current.year, month: current.month - 1 };
};

/** Inclui o mês corrente; exclui meses futuros. */
export const isFinancialMonthOnOrBeforeCurrentCalendarMonth = (
  month: FinancialMonthKey,
  referenceDate = new Date()
) => compareFinancialMonthKeys(month, getCalendarMonthKey(referenceDate)) <= 0;

/** Oculta mês atual e meses futuros da lista de seleção. */
export const isFinancialMonthBeforeCurrentCalendarMonth = (
  month: FinancialMonthKey,
  referenceDate = new Date()
) => compareFinancialMonthKeys(month, getCalendarMonthKey(referenceDate)) < 0;

export const filterSelectableFinancialMonths = (
  months: FinancialMonthKey[],
  referenceDate = new Date()
) =>
  months.filter((month) => isFinancialMonthBeforeCurrentCalendarMonth(month, referenceDate));

export const resolveDefaultFinancialMonth = (
  months: FinancialMonthKey[],
  referenceDate = new Date()
): FinancialMonthKey | null => {
  if (!months.length) {
    return null;
  }

  const preferred = getPreviousCalendarMonth(referenceDate);
  const preferredKey = formatFinancialMonthKey(preferred);
  const preferredMonth = months.find((month) => formatFinancialMonthKey(month) === preferredKey);

  if (preferredMonth) {
    return preferredMonth;
  }

  return months[0];
};

export const mergeFinancialMonthLists = (...lists: FinancialMonthKey[][]): FinancialMonthKey[] => {
  const byKey = new Map<string, FinancialMonthKey>();

  for (const list of lists) {
    for (const month of list) {
      byKey.set(formatFinancialMonthKey(month), month);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    if (left.year !== right.year) {
      return right.year - left.year;
    }

    return right.month - left.month;
  });
};

export const listFinancialMonthsFromDates = (dates: string[]): FinancialMonthKey[] => {
  const keys = new Set<string>();

  for (const date of dates) {
    const monthKey = parseFinancialMonthFromDate(date);
    if (!monthKey) {
      continue;
    }

    keys.add(formatFinancialMonthKey(monthKey));
  }

  return Array.from(keys)
    .map((value) => parseFinancialMonthKey(value))
    .filter((value): value is FinancialMonthKey => value !== null)
    .sort((left, right) => {
      if (left.year !== right.year) {
        return right.year - left.year;
      }

      return right.month - left.month;
    });
};

export const formatFinancialBrl = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
