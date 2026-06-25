import type { MaintenanceReportRow } from '@/lib/maintenanceReportsApi';

export type ReportColumnAlign = 'left' | 'center' | 'right';

const COLUMN_LABELS: Record<string, string> = {
  nome: 'Nome',
  papel: 'Papel',
  dias_congregacao: 'Dias de congregação',
  status: 'Status',
  categoria: 'Categoria',
  tipo: 'Tipo',
  total: 'Total',
  bairro: 'Bairro',
  cidade: 'Cidade',
  perfis: 'Perfis',
  latitude_media: 'Latitude média',
  longitude_media: 'Longitude média',
  evento: 'Evento',
  data: 'Data',
  inscritos: 'Inscritos',
  confirmados: 'Confirmados',
  ausentes: 'Ausentes',
  checkins_recentes: 'Check-ins recentes',
  alerta: 'Alerta',
  solicitacoes: 'Solicitações',
  horas_medias_fluxo: 'Horas médias no fluxo',
  voluntario: 'Voluntário',
  tipo_escala: 'Tipo de escala',
  escalas_no_mes: 'Escalas no mês',
  sobrecarga: 'Sobrecarga',
  rota: 'Rota',
  rotulo: 'Rótulo',
  visitas: 'Visitas',
  faixa: 'Faixa etária',
  quantidade: 'Quantidade',
  familia: 'Família',
  integrantes: 'Integrantes',
  classificacao: 'Classificação',
  alertas: 'Alertas',
  origem: 'Origem',
  percentual: '%',
  data_evento: 'Data do evento',
  hora_checkin: 'Hora do check-in',
  rd: 'RD',
  criado_em: 'Criado em',
  atualizado_em: 'Atualizado em',
  dias_ate_conciliacao: 'Dias até conciliação',
  veiculos_cadastrados: 'Veículos cadastrados',
  estimativa_veiculos: 'Estimativa de veículos',
};

const SUMMARY_LABELS: Record<string, string> = {
  visitantes: 'Visitantes',
  congregados: 'Congregados ativos',
  congregados_desligados: 'Congregados desligados',
  membros: 'Membros ativos',
  membros_desligados: 'Membros desligados',
  ativos: 'Ativos (total)',
  inativos: 'Inativos',
  janela_meses: 'Janela (meses)',
  mes_referencia: 'Mês de referência',
  budget_version: 'Versão orçamentária',
  total_lancamentos: 'Total de lançamentos',
  rds_conciliados: 'RDs conciliados',
  bairros_distintos: 'Bairros distintos',
  perfis_mapeados: 'Perfis mapeados',
  meses_analisados: 'Meses analisados',
  eventos_com_inscricoes: 'Eventos com inscrições',
  perfis_em_alerta: 'Perfis em alerta',
  semestre_meses: 'Meses do semestre',
  total_solicitacoes: 'Total de solicitações',
  limite_sobrecarga: 'Limite de sobrecarga',
  servos_sobrecarregados: 'Servos sobrecarregados',
  tipos_com_poucos_voluntarios: 'Tipos com poucos voluntários',
  dias_analisados: 'Dias analisados',
  sessoes: 'Sessões',
  inscricoes_eventos: 'Inscrições em eventos',
  perfis_analisados: 'Perfis analisados',
  familias_distintas: 'Famílias distintas',
  media_integrantes: 'Média de integrantes',
  event_id: 'Evento',
  criancas_com_alerta: 'Crianças com alerta',
  total_confirmados: 'Total confirmados',
  eventos_quorum_encerrados: 'Eventos de quórum encerrados',
  presentes_confirmados: 'Presentes confirmados',
  media_dias_conciliacao: 'Média de dias até conciliação',
  pendentes: 'Pendentes',
  familias_inscritas: 'Famílias inscritas',
  estimativa_total_veiculos: 'Estimativa total de veículos',
};

const CURRENCY_COLUMNS = new Set(['total']);
const PERCENT_COLUMNS = new Set(['percentual']);
const INTEGER_COLUMNS = new Set([
  'dias_congregacao',
  'perfis',
  'inscritos',
  'confirmados',
  'ausentes',
  'checkins_recentes',
  'solicitacoes',
  'escalas_no_mes',
  'visitas',
  'quantidade',
  'integrantes',
  'veiculos_cadastrados',
  'estimativa_veiculos',
]);
const DECIMAL_COLUMNS = new Set([
  'latitude_media',
  'longitude_media',
  'horas_medias_fluxo',
  'dias_ate_conciliacao',
]);
const DATE_COLUMNS = new Set(['data', 'data_evento']);
const DATETIME_COLUMNS = new Set(['criado_em', 'atualizado_em', 'hora_checkin']);

const COLUMN_WIDTHS: Record<string, number> = {
  nome: 168,
  evento: 188,
  alertas: 200,
  familia: 120,
  categoria: 148,
  tipo: 108,
  total: 112,
  bairro: 140,
  cidade: 128,
  papel: 96,
  status: 96,
  origem: 132,
  rotulo: 160,
  rota: 140,
  rd: 108,
};

const RIGHT_ALIGN_COLUMNS = new Set([
  ...CURRENCY_COLUMNS,
  ...PERCENT_COLUMNS,
  ...INTEGER_COLUMNS,
  ...DECIMAL_COLUMNS,
]);

const CENTER_ALIGN_COLUMNS = new Set(['papel', 'status', 'sobrecarga', 'alerta', 'tipo', 'classificacao']);

const ROLE_LABELS: Record<string, string> = {
  visitante: 'Visitante',
  congregado: 'Congregado',
  member: 'Membro',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  reconciled: 'Conciliado',
  confirmado: 'Confirmado',
  pre_checkin: 'Pré-check-in',
};

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseDateValue = (value: unknown) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatReportColumnLabel = (column: string) =>
  COLUMN_LABELS[column] ?? column.replace(/_/g, ' ');

export const formatReportSummaryLabel = (key: string) =>
  SUMMARY_LABELS[key] ?? formatReportColumnLabel(key);

export const getReportColumnAlign = (column: string): ReportColumnAlign => {
  if (CENTER_ALIGN_COLUMNS.has(column)) {
    return 'center';
  }

  if (RIGHT_ALIGN_COLUMNS.has(column)) {
    return 'right';
  }

  return 'left';
};

export const getReportColumnWidth = (column: string) => COLUMN_WIDTHS[column] ?? 124;

export const formatReportDate = (value: unknown) => {
  const date = parseDateValue(value);

  if (!date) {
    return typeof value === 'string' && value.trim() ? value : '—';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatReportDateTime = (value: unknown) => {
  const date = parseDateValue(value);

  if (!date) {
    return typeof value === 'string' && value.trim() ? value : '—';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatReportMonthLabel = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value.trim())) {
    return String(value ?? '—');
  }

  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
};

export const formatReportCellValue = (column: string, value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }

  if (column === 'papel') {
    return ROLE_LABELS[String(value).toLowerCase()] ?? String(value);
  }

  if (column === 'status') {
    return STATUS_LABELS[String(value).toLowerCase()] ?? String(value);
  }

  if (column === 'budget_version') {
    return String(value).toUpperCase() === 'PLANEJADO' ? 'Planejado' : 'Realizado';
  }

  if (CURRENCY_COLUMNS.has(column)) {
    const numeric = parseNumeric(value);

    if (numeric !== null) {
      return numeric.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }

  if (PERCENT_COLUMNS.has(column)) {
    const numeric = parseNumeric(value);

    if (numeric !== null) {
      return `${numeric.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;
    }
  }

  if (INTEGER_COLUMNS.has(column)) {
    const numeric = parseNumeric(value);

    if (numeric !== null) {
      return numeric.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }
  }

  if (DECIMAL_COLUMNS.has(column)) {
    const numeric = parseNumeric(value);

    if (numeric !== null) {
      return numeric.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }

  if (DATE_COLUMNS.has(column)) {
    return formatReportDate(value);
  }

  if (DATETIME_COLUMNS.has(column)) {
    return formatReportDateTime(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

export const formatReportSummaryValue = (key: string, value: unknown) => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (key === 'mes_referencia') {
    return formatReportMonthLabel(value);
  }

  if (key === 'budget_version') {
    return formatReportCellValue('budget_version', value);
  }

  if (
    key.includes('media')
    || key.includes('total')
    || key.includes('dias')
    || INTEGER_COLUMNS.has(key)
    || DECIMAL_COLUMNS.has(key)
  ) {
    const numeric = parseNumeric(value);

    if (numeric !== null) {
      if (key.includes('media_dias') || key.includes('media_integrantes')) {
        return numeric.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
      }

      return numeric.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }

  return formatReportCellValue(key, value);
};

const hasCellValue = (value: unknown) => value !== null && value !== undefined && value !== '';

export const resolveVisibleReportColumns = (
  rows: MaintenanceReportRow[],
  declaredColumns: string[]
) => {
  const sourceColumns =
    declaredColumns.length > 0 ? declaredColumns : Object.keys(rows[0] ?? {});

  return sourceColumns.filter((column) =>
    rows.some((row) => hasCellValue(row[column]))
  );
};

export const formatMaintenanceEventOptionLabel = (name: string, eventDate: string | null) => {
  const trimmedName = name.trim() || 'Evento sem nome';
  const dateLabel = formatReportDate(eventDate);

  return dateLabel === '—' ? trimmedName : `${trimmedName} — ${dateLabel}`;
};
