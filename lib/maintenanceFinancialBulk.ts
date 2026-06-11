import { getFinancialMonthDateRange, type FinancialMonthKey } from '@/lib/financialMonth';

export type FinancialBulkRow = {
  sourceRow: number;
  transactionDate: string;
  account: string;
  amount: number;
  ministry: string;
  transactionKind: string;
  movement: string;
  budgetVersion: string;
  comments?: string | null;
};

export type FinancialBulkParseError = {
  line: number;
  message: string;
};

export type FinancialBulkParseResult = {
  validRows: FinancialBulkRow[];
  errors: FinancialBulkParseError[];
  loadMonthLabel: string;
};

/** Layout da tesouraria: comentário opcional na 7ª coluna; valor sempre na última. */
export const FINANCIAL_BULK_CSV_FORMAT_HINT =
  'CSV (;) — DATA;CONTA;MINISTÉRIO;TRANSAÇÃO;MOVIMENTO;VERSÃO;COMENTÁRIOS (opcional);VALOR. Data DD/MM/AA ou DD/MM/AAAA; valor com ponto (.) se houver decimais. Ex.: 04/05/2026;AP.MPAGO;PROJETOS;ENTRE CONTAS;ORDINÁRIO;REALIZADO;observação do lançamento;1348';

type BulkColumnLayout = 'standard' | 'legacy_comments_last' | 'valor_third';

const isDateHeaderLine = (value: string) => /^(data|date)$/i.test(value.trim());

/** Linha vazia exportada do Excel (data zerada + colunas em branco). */
const isExcelPlaceholderBulkRow = (parts: string[]) => {
  const dateRaw = parts[0]?.trim() ?? '';

  if (!/^0{1,2}\/0{1,2}\/1900$/.test(dateRaw)) {
    return false;
  }

  return parts.slice(1).every((part) => !part.trim());
};

const isCommentHeaderLine = (value: string) =>
  /^(comentarios?|comments?|observacoes?|observação)$/i.test(value.trim());

const normalizeBulkComment = (value: string | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed || isCommentHeaderLine(trimmed)) {
    return null;
  }

  return trimmed;
};

/** Converte DD/MM/AA ou DD/MM/AAAA para ISO (AAAA-MM-DD). */
export const parseFinancialBulkDate = (value: string) => {
  const trimmed = value.trim();

  const fourYearMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (fourYearMatch) {
    const day = Number.parseInt(fourYearMatch[1], 10);
    const month = Number.parseInt(fourYearMatch[2], 10);
    const year = Number.parseInt(fourYearMatch[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!Number.isNaN(Date.parse(`${iso}T12:00:00Z`))) {
      return iso;
    }

    return null;
  }

  const shortYearMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(trimmed);

  if (!shortYearMatch) {
    return null;
  }

  const day = Number.parseInt(shortYearMatch[1], 10);
  const month = Number.parseInt(shortYearMatch[2], 10);
  const yearShort = Number.parseInt(shortYearMatch[3], 10);
  const year = yearShort >= 70 ? 1900 + yearShort : 2000 + yearShort;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (Number.isNaN(Date.parse(`${iso}T12:00:00Z`))) {
    return null;
  }

  return iso;
};

/** Valor com separador decimal "." (ex.: 12086.19 ou inteiro 1348). Vírgula não é aceita. */
export const parseFinancialBulkAmount = (value: string) => {
  const normalized = value.trim().replace(/\s/g, '');

  if (!normalized || normalized.includes(',')) {
    return null;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : null;
};

const detectColumnLayout = (parts: string[]): BulkColumnLayout => {
  if (parts.length >= 8) {
    const seventhIsAmount = parseFinancialBulkAmount(parts[6]) !== null;
    const eighthIsAmount = parseFinancialBulkAmount(parts[7]) !== null;

    if (eighthIsAmount && !seventhIsAmount) {
      return 'standard';
    }

    if (seventhIsAmount && !eighthIsAmount) {
      return 'legacy_comments_last';
    }
  }

  if (parts.length === 7) {
    if (parseFinancialBulkAmount(parts[6]) !== null) {
      return 'standard';
    }

    if (parseFinancialBulkAmount(parts[2]) !== null) {
      return 'valor_third';
    }
  }

  return 'standard';
};

const mapCsvParts = (parts: string[], layout: BulkColumnLayout) => {
  if (layout === 'valor_third') {
    const [dateRaw, account, amountRaw, ministry, transactionKind, movement, budgetVersion] = parts;

    return {
      dateRaw,
      account,
      amountRaw,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      comments: parts[7],
    };
  }

  if (layout === 'legacy_comments_last') {
    const [dateRaw, account, ministry, transactionKind, movement, budgetVersion, amountRaw] = parts;

    return {
      dateRaw,
      account,
      amountRaw,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      comments: parts[7],
    };
  }

  const [dateRaw, account, ministry, transactionKind, movement, budgetVersion] = parts;
  const amountRaw = parts[parts.length - 1];
  const comments = parts.length >= 8 ? parts[6] : undefined;

  return {
    dateRaw,
    account,
    amountRaw,
    ministry,
    transactionKind,
    movement,
    budgetVersion,
    comments,
  };
};

export const isFinancialDateInLoadMonth = (transactionDateIso: string, loadMonth: FinancialMonthKey) => {
  const { startDate, endDate } = getFinancialMonthDateRange(loadMonth);

  return transactionDateIso >= startDate && transactionDateIso <= endDate;
};

export const formatFinancialBulkDateLabel = (isoDate: string) => {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return isoDate;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

export const parseFinancialBulkCsv = (
  rawText: string,
  loadMonth: FinancialMonthKey
): FinancialBulkParseResult => {
  const validRows: FinancialBulkRow[] = [];
  const errors: FinancialBulkParseError[] = [];
  const lines = rawText.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    const parts = line.split(';').map((part) => part.trim());

    if (isExcelPlaceholderBulkRow(parts)) {
      continue;
    }

    if (parts.length < 7) {
      errors.push({
        line: lineNumber,
        message:
          'Informe ao menos 7 colunas: DATA;CONTA;MINISTÉRIO;TRANSAÇÃO;MOVIMENTO;VERSÃO;VALOR (COMENTÁRIOS opcional na 7ª quando houver 8 colunas).',
      });
      continue;
    }

    if (parts.length > 8) {
      errors.push({
        line: lineNumber,
        message: 'Use no máximo 8 colunas (COMENTÁRIOS na 7ª e VALOR na 8ª).',
      });
      continue;
    }

    const layout = detectColumnLayout(parts);
    const {
      dateRaw,
      account,
      amountRaw,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      comments: commentsRaw,
    } = mapCsvParts(parts, layout);

    if (isDateHeaderLine(dateRaw)) {
      continue;
    }

    const transactionDate = parseFinancialBulkDate(dateRaw);
    const amount = parseFinancialBulkAmount(amountRaw);

    if (!transactionDate) {
      errors.push({
        line: lineNumber,
        message: 'Data inválida (use DD/MM/AA ou DD/MM/AAAA, ex.: 04/05/2026).',
      });
      continue;
    }

    if (!isFinancialDateInLoadMonth(transactionDate, loadMonth)) {
      errors.push({
        line: lineNumber,
        message: 'Data fora do mês/ano selecionado para a carga.',
      });
      continue;
    }

    if (amount === null) {
      errors.push({
        line: lineNumber,
        message: 'Valor inválido (use ponto como decimal, ex.: 1348 ou 12086.19).',
      });
      continue;
    }

    if (!account || !ministry || !transactionKind || !movement || !budgetVersion) {
      errors.push({
        line: lineNumber,
        message: 'Conta, ministério, transação, movimento e versão são obrigatórios.',
      });
      continue;
    }

    validRows.push({
      sourceRow: lineNumber,
      transactionDate,
      account,
      amount,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      comments: normalizeBulkComment(commentsRaw),
    });
  }

  const { month, year } = loadMonth;

  return {
    validRows,
    errors,
    loadMonthLabel: `${String(month).padStart(2, '0')}/${year}`,
  };
};

export const financialBulkRowsToRpcPayload = (rows: FinancialBulkRow[]) =>
  rows.map((row) => ({
    transaction_date: row.transactionDate,
    account: row.account,
    amount: row.amount,
    ministry: row.ministry,
    transaction_kind: row.transactionKind,
    movement: row.movement,
    budget_version: row.budgetVersion,
    source_row: row.sourceRow,
    comments: row.comments ?? null,
  }));
