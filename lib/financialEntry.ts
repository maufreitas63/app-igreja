export const FINANCIAL_BUDGET_VERSION_REALIZED = 'REALIZADO';
export const FINANCIAL_BUDGET_VERSION_PLANNED = 'PLANEJADO';

export type FinancialEntry = {
  id: string;
  transaction_date: string;
  account: string;
  amount: number;
  ministry: string;
  transaction_kind: string;
  movement: string;
  budget_version: string;
  comments?: string | null;
  receipt_url?: string | null;
};

const normalizeToken = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

export const isFinancialRealizado = (budgetVersion: string) =>
  normalizeToken(budgetVersion).includes('REALIZ');

export const isFinancialPlanejado = (budgetVersion: string) =>
  normalizeToken(budgetVersion).includes('PLANEJ');

export const filterRealizedFinancialEntries = (entries: FinancialEntry[]) =>
  entries.filter((entry) => isFinancialRealizado(entry.budget_version));

export const filterPlannedFinancialEntries = (entries: FinancialEntry[]) =>
  entries.filter((entry) => isFinancialPlanejado(entry.budget_version));

export const isFinancialMovementExtraordinario = (movement: string) =>
  normalizeToken(movement).includes('EXTRAORDIN');

export const isFinancialMovementOrdinario = (movement: string) => {
  const token = normalizeToken(movement);
  return token.includes('ORDIN') && !token.includes('EXTRAORDIN');
};

export const classifyFinancialMovement = (movement: string) => {
  if (isFinancialMovementExtraordinario(movement)) {
    return 'EXTRAORDINÁRIO' as const;
  }

  if (isFinancialMovementOrdinario(movement)) {
    return 'ORDINÁRIO' as const;
  }

  const label = movement.trim();
  return (label ? label.toUpperCase() : 'OUTROS') as const;
};

export const isFinancialEntreContas = (transactionKind: string) =>
  normalizeToken(transactionKind).includes('ENTRE CONTAS');

export const isFinancialEntrada = (transactionKind: string) => {
  const token = normalizeToken(transactionKind);
  return token === 'ENTRADAS' || token.startsWith('ENTRADA');
};

export const isFinancialSaida = (transactionKind: string) => {
  const token = normalizeToken(transactionKind);
  return token === 'SAIDAS' || token.startsWith('SAIDA');
};

/** Valor com sinal para totais (entradas +, saídas −, entre contas conforme o lançamento). */
export const signedFinancialAmount = (entry: FinancialEntry) => {
  const amount = Number(entry.amount) || 0;

  if (isFinancialEntrada(entry.transaction_kind)) {
    return amount;
  }

  if (isFinancialSaida(entry.transaction_kind)) {
    return amount > 0 ? -amount : amount;
  }

  return amount;
};

/** Rótulo da linha no boletim (ministério + conta, alinhado ao lançamento em `financials`). */
export const buildFinancialLineLabel = (entry: FinancialEntry) => {
  const ministry = entry.ministry.trim() || 'OUTROS';
  const account = entry.account.trim();

  if (account) {
    return `${ministry} (${account})`;
  }

  return ministry;
};

const FINANCIAL_COMMENT_FIELD_NAMES = [
  'comments',
  'Comments',
  'comment',
  'comentario',
  'comentarios',
  'observacao',
  'observacoes',
] as const;

/** Texto de observação de um lançamento já normalizado ou bruto do Supabase. */
export const getFinancialEntryComment = (entry: FinancialEntry): string | null => {
  const fromPick = pickFinancialEntryComment(entry as unknown as Record<string, unknown>);

  if (fromPick) {
    return fromPick;
  }

  const direct = entry.comments?.trim();

  if (direct && direct !== 'null' && direct !== 'undefined') {
    return direct;
  }

  return null;
};

export const pickFinancialEntryComment = (row: Record<string, unknown>) => {
  for (const field of FINANCIAL_COMMENT_FIELD_NAMES) {
    const raw = row[field];

    if (raw == null) {
      continue;
    }

    const text = String(raw).trim();

    if (text.length > 0 && text !== 'null' && text !== 'undefined') {
      return text;
    }
  }

  return null;
};

export type FinancialBulletinCommentDetail = {
  comment: string;
  amount: number;
  transactionDateLabel: string;
  receiptUrl?: string | null;
};

/** Rótulo curto da data do lançamento (DD/MM). */
export const formatFinancialEntryDayMonthLabel = (isoDate: string) => {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return '—';
  }

  const [, , month, day] = match;
  return `${day}/${month}`;
};

export const mergeFinancialComments = (
  existing: string | undefined,
  next: string | null | undefined
) => {
  const trimmed = next?.trim();

  if (!trimmed) {
    return existing;
  }

  if (!existing) {
    return trimmed;
  }

  if (existing.includes(trimmed)) {
    return existing;
  }

  return `${existing}\n\n${trimmed}`;
};

export type FinancialTransactionFlowKind = 'entrada' | 'saida' | 'entre_contas' | 'outros';

const FLOW_SECTION_TO_TRANSACTION_KIND: Record<string, FinancialTransactionFlowKind> = {
  entradas: 'entrada',
  saidas: 'saida',
  entreContas: 'entre_contas',
  outros: 'outros',
};

/** Tipo de transação (entradas/saídas/entre contas) do lançamento. */
export const matchesFinancialTransactionFlow = (
  entry: FinancialEntry,
  kind: FinancialTransactionFlowKind
) => {
  const isEntrada = isFinancialEntrada(entry.transaction_kind);
  const isSaida = isFinancialSaida(entry.transaction_kind);
  const isEntreContas = isFinancialEntreContas(entry.transaction_kind);

  if (kind === 'entrada') {
    return isEntrada;
  }

  if (kind === 'saida') {
    return isSaida;
  }

  if (kind === 'entre_contas') {
    return isEntreContas;
  }

  return !isEntrada && !isSaida && !isEntreContas;
};

export const financialEntryMovementBlockTitle = (entry: FinancialEntry) => {
  const classified = classifyFinancialMovement(entry.movement);

  return classified === 'EXTRAORDINÁRIO' ? 'EXTRAORDINÁRIO' : 'ORDINÁRIO';
};

export type ParsedBulletinRowKey = {
  blockTitle: string;
  flowSectionKey: string;
  lineLabel: string;
};

/** Extrai bloco, fluxo e rótulo de `block:…:flow:…:line:…`. */
export const parseBulletinRowKey = (key: string): ParsedBulletinRowKey | null => {
  const lineMarker = ':line:';
  const lineIndex = key.lastIndexOf(lineMarker);

  if (lineIndex < 0) {
    return null;
  }

  const lineLabel = key.slice(lineIndex + lineMarker.length);
  const prefix = key.slice(0, lineIndex);
  const match = prefix.match(/^block:(.+):flow:(.+)$/);

  if (!match) {
    return null;
  }

  return {
    blockTitle: match[1],
    flowSectionKey: match[2],
    lineLabel,
  };
};

export type FinancialRowCommentLookup = {
  key?: string;
  label: string;
  level: string;
  comment?: string | null;
};

/** Lançamento pertence à mesma linha do boletim (bloco + fluxo + rótulo exato). */
export const entryBelongsToBulletinRow = (
  entry: FinancialEntry,
  rowKey: string,
  rowLabel: string
) => {
  const label = rowLabel.trim();
  const entryLabel = buildFinancialLineLabel(entry);

  if (entryLabel !== label) {
    return false;
  }

  const parsed = parseBulletinRowKey(rowKey);

  if (!parsed) {
    return true;
  }

  if (financialEntryMovementBlockTitle(entry) !== parsed.blockTitle) {
    return false;
  }

  const flowKind = FLOW_SECTION_TO_TRANSACTION_KIND[parsed.flowSectionKey];

  if (!flowKind) {
    return false;
  }

  return matchesFinancialTransactionFlow(entry, flowKind);
};

const collectBulletinRowCommentDetails = (
  entries: FinancialEntry[],
  matchesEntry: (entry: FinancialEntry) => boolean
): FinancialBulletinCommentDetail[] => {
  const details: FinancialBulletinCommentDetail[] = [];

  for (const entry of entries) {
    if (!matchesEntry(entry)) {
      continue;
    }

    const comment = getFinancialEntryComment(entry);

    if (!comment) {
      continue;
    }

    const receiptUrl = entry.receipt_url?.trim() || null;

    details.push({
      comment,
      amount: signedFinancialAmount(entry),
      transactionDateLabel: formatFinancialEntryDayMonthLabel(entry.transaction_date),
      receiptUrl,
    });
  }

  return details;
};

/**
 * Comentário resumido para linha agregada no boletim (primeira observação encontrada).
 */
export const resolveAggregatedLineComment = (
  entries: FinancialEntry[],
  label: string
): string | null => {
  const details = collectBulletinRowCommentDetails(entries, (entry) => buildFinancialLineLabel(entry) === label);

  return details[0]?.comment ?? null;
};

/** Observações e valores dos lançamentos consolidados na mesma linha do boletim. */
export const findCommentDetailsForBulletinRow = (
  row: FinancialRowCommentLookup,
  entries: FinancialEntry[]
): FinancialBulletinCommentDetail[] => {
  if (row.level !== 'line') {
    return [];
  }

  const rowLabel = row.label.trim();
  const rowKey = row.key ?? '';

  return collectBulletinRowCommentDetails(entries, (entry) =>
    entryBelongsToBulletinRow(entry, rowKey, rowLabel)
  );
};

/** Observação resumida do lançamento que originou esta linha. */
export const findCommentForBulletinRow = (
  row: FinancialRowCommentLookup,
  entries: FinancialEntry[]
): string | null => findCommentDetailsForBulletinRow(row, entries)[0]?.comment ?? null;

/** Comprovante do lançamento que originou esta linha (um único arquivo por linha agregada). */
export const findReceiptForBulletinRow = (
  row: FinancialRowCommentLookup,
  entries: FinancialEntry[]
): string | null => {
  if (row.level !== 'line') {
    return null;
  }

  const rowLabel = row.label.trim();
  const rowKey = row.key ?? '';
  const receipts = new Set<string>();

  for (const entry of entries) {
    if (!entryBelongsToBulletinRow(entry, rowKey, rowLabel)) {
      continue;
    }

    const receiptUrl = entry.receipt_url?.trim();

    if (receiptUrl) {
      receipts.add(receiptUrl);
    }
  }

  if (receipts.size === 1) {
    return [...receipts][0];
  }

  return null;
};

export const normalizeFinancialEntryRow = (row: Record<string, unknown>): FinancialEntry | null => {
  const id = String(row.id ?? '').trim();

  if (!id) {
    return null;
  }

  return {
    id,
    transaction_date: String(row.transaction_date ?? ''),
    account: String(row.account ?? '').trim(),
    amount: Number(row.amount) || 0,
    ministry: String(row.ministry ?? '').trim(),
    transaction_kind: String(row.transaction_kind ?? '').trim(),
    movement: String(row.movement ?? '').trim(),
    budget_version: String(row.budget_version ?? '').trim(),
    comments: pickFinancialEntryComment(row),
    receipt_url:
      typeof row.receipt_url === 'string' && row.receipt_url.trim()
        ? row.receipt_url.trim()
        : null,
  };
};

/** Soma líquida de todos os lançamentos (todos os tipos de transação). */
export const computeFinancialBalance = (entries: FinancialEntry[]) =>
  entries.reduce((sum, entry) => sum + signedFinancialAmount(entry), 0);
