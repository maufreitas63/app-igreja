import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const VISITOR_FOLLOWUP_SQL_HINT =
  'A régua de acolhimento ainda não está disponível neste ambiente.';

export type VisitorFollowupTaskTipo =
  | 'whatsapp_dia_1'
  | 'convite_celula_dia_4'
  | 'ligacao_pastor_dia_8';

export type VisitorFollowupTask = {
  id: string;
  visitorId: string;
  visitorName: string;
  phone: string | null;
  tipoTarefa: VisitorFollowupTaskTipo;
  dataProgramada: string;
  status: string;
  descricao: string;
  followupStatus: string;
  dataAprovacao: string | null;
  resultado?: string | null;
};

export const VISITOR_FOLLOWUP_TASK_LABEL: Record<VisitorFollowupTaskTipo, string> = {
  whatsapp_dia_1: 'WhatsApp — dia 1',
  convite_celula_dia_4: 'Convite à célula — dia 4',
  ligacao_pastor_dia_8: 'Ligação pastoral — dia 8',
};

const parseTask = (
  row: Record<string, unknown>,
  kind: 'task' | 'alert'
): VisitorFollowupTask | null => {
  const id = String(row.id ?? '').trim();
  const visitorId = String(row.visitor_id ?? '').trim();
  const tipo = String(row.tipo_tarefa ?? '').trim() as VisitorFollowupTaskTipo;

  if (!id || !visitorId) {
    return null;
  }

  if (
    tipo !== 'whatsapp_dia_1'
    && tipo !== 'convite_celula_dia_4'
    && tipo !== 'ligacao_pastor_dia_8'
  ) {
    return null;
  }

  return {
    id,
    visitorId,
    visitorName: String(row.visitor_name ?? 'Visitante').trim() || 'Visitante',
    phone: row.phone ? String(row.phone) : null,
    tipoTarefa: tipo,
    dataProgramada: String(row.data_programada ?? ''),
    status: String(row.status ?? ''),
    descricao: String(row.descricao ?? ''),
    followupStatus: String(row.followup_status ?? ''),
    dataAprovacao: row.data_aprovacao ? String(row.data_aprovacao) : null,
    resultado: kind === 'alert' && row.resultado ? String(row.resultado) : null,
  };
};

const throwIfRpcMissing = (error: { message?: string; code?: string }, fn: string) => {
  if (isSupabaseRpcMissingError(error, fn)) {
    throw new Error(VISITOR_FOLLOWUP_SQL_HINT);
  }

  throw error;
};

export async function listWelcomeVisitorFollowupTasks() {
  const { data, error } = await supabase.rpc('list_welcome_visitor_followup_tasks');

  if (error) {
    throwIfRpcMissing(error, 'list_welcome_visitor_followup_tasks');
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível listar as tarefas de acolhimento.'));
  }

  const rows = Array.isArray(record.tasks) ? record.tasks : [];

  return rows
    .map((entry) => parseTask(entry as Record<string, unknown>, 'task'))
    .filter((entry): entry is VisitorFollowupTask => entry !== null);
}

export async function listPastorVisitorFollowupAlerts() {
  const { data, error } = await supabase.rpc('list_pastor_visitor_followup_alerts');

  if (error) {
    throwIfRpcMissing(error, 'list_pastor_visitor_followup_alerts');
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível listar os alertas pastorais.'));
  }

  const rows = Array.isArray(record.alerts) ? record.alerts : [];

  return rows
    .map((entry) => parseTask(entry as Record<string, unknown>, 'alert'))
    .filter((entry): entry is VisitorFollowupTask => entry !== null);
}

export async function completeVisitorFollowupTask(taskId: string) {
  const { data, error } = await supabase.rpc('complete_visitor_followup_task', {
    p_task_id: taskId,
  });

  if (error) {
    throwIfRpcMissing(error, 'complete_visitor_followup_task');
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível concluir a tarefa.'));
  }
}

export function formatVisitorFollowupDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}
