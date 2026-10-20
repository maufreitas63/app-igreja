import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { withActiveTenantStoragePrefix } from '@/lib/tenantStoragePath';

export const PETTY_CASH_MAINTENANCE_SCREEN = 'maintenance.finance.petty_cash';
export const PETTY_CASH_CONTROL_SCREEN = 'financial.petty_cash';
export const PETTY_CASH_BUCKET = 'petty-cash-docs';
export const PETTY_CASH_BASE_VALUE = 1000;

const SIGNED_URL_TTL_SECONDS = 60;

export type PettyCashStatus = 'ativo' | 'inativo';
export type PettyCashMovementType = 'despesa' | 'reposicao';
export type PettyCashApproval = 'pendente' | 'aprovado' | 'rejeitado';

export type PettyCashBox = {
  id: string;
  nome_caixa: string;
  responsavel_id: string;
  responsavel_nome: string;
  valor_base: number;
  dia_fechamento: number;
  saldo_inicial: number;
  total_despesas: number;
  saldo_atual: number;
  saldo_remanescente: number;
  valor_recomposicao: number;
  status: PettyCashStatus;
  despesas_pendentes: number;
  reposicao_pendente: boolean;
  prazo: string;
  dias_para_prazo: number;
  prestacao_atrasada: boolean;
  prestacao_proxima: boolean;
  reenvio_pendente: boolean;
};

export type PettyCashMovement = {
  id: string;
  tipo: PettyCashMovementType;
  valor: number;
  descricao: string;
  data_movimento: string;
  comprovante_url: string;
  status_aprovacao: PettyCashApproval;
  motivo_decisao: string;
  criado_por: string;
  created_at: string;
};

export type PettyCashResponsible = {
  id: string;
  nome: string;
};

export type PettyCashList = {
  prazo: string;
  caixas: PettyCashBox[];
};

const asNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asText = (value: unknown) => (value == null ? '' : String(value));

const rpcErrorMessage = (error: { message?: string } | null) => {
  const raw = error?.message?.trim() || 'Não foi possível concluir a operação.';
  const line = raw.split('\n')[0] ?? raw;
  return line.replace(/^ERROR:\s*/i, '').replace(/^P0001:\s*/i, '');
};

async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    throw new Error(rpcErrorMessage(error));
  }

  return data as T;
}

const mapBox = (value: unknown): PettyCashBox => {
  const row = (value ?? {}) as Record<string, unknown>;

  return {
    id: asText(row.id),
    nome_caixa: asText(row.nome_caixa),
    responsavel_id: asText(row.responsavel_id),
    responsavel_nome: asText(row.responsavel_nome),
    valor_base: asNumber(row.valor_base),
    dia_fechamento: asNumber(row.dia_fechamento) || 25,
    saldo_inicial: asNumber(row.saldo_inicial),
    total_despesas: asNumber(row.total_despesas),
    saldo_atual: asNumber(row.saldo_atual),
    saldo_remanescente: asNumber(row.saldo_remanescente),
    valor_recomposicao: asNumber(row.valor_recomposicao),
    status: row.status === 'inativo' ? 'inativo' : 'ativo',
    despesas_pendentes: asNumber(row.despesas_pendentes),
    reposicao_pendente: row.reposicao_pendente === true,
    prazo: asText(row.prazo).slice(0, 10),
    dias_para_prazo: asNumber(row.dias_para_prazo),
    prestacao_atrasada: row.prestacao_atrasada === true,
    prestacao_proxima: row.prestacao_proxima === true,
    reenvio_pendente: row.reenvio_pendente === true,
  };
};

const mapList = (value: unknown): PettyCashList => {
  const row = (value ?? {}) as Record<string, unknown>;
  const caixas = Array.isArray(row.caixas) ? row.caixas.map(mapBox) : [];

  return {
    prazo: asText(row.prazo).slice(0, 10),
    caixas,
  };
};

const mapMovement = (value: unknown): PettyCashMovement => {
  const row = (value ?? {}) as Record<string, unknown>;

  return {
    id: asText(row.id),
    tipo: row.tipo === 'reposicao' ? 'reposicao' : 'despesa',
    valor: asNumber(row.valor),
    descricao: asText(row.descricao),
    data_movimento: asText(row.data_movimento).slice(0, 10),
    comprovante_url: asText(row.comprovante_url),
    status_aprovacao:
      row.status_aprovacao === 'aprovado' || row.status_aprovacao === 'rejeitado'
        ? row.status_aprovacao
        : 'pendente',
    motivo_decisao: asText(row.motivo_decisao),
    criado_por: asText(row.criado_por),
    created_at: asText(row.created_at),
  };
};

export function formatPettyCashBrl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPettyCashDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');

  if (!year || !month || !day) {
    return iso;
  }

  return `${day}/${month}/${year}`;
}

export function parsePettyCashAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

export function parsePettyCashBrDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export type PettyCashAlert = {
  tone: 'late' | 'soon' | 'resend';
  text: string;
};

export function pettyCashAlertLines(box: PettyCashBox): PettyCashAlert[] {
  const lines: PettyCashAlert[] = [];
  const when = box.prazo ? formatPettyCashDate(box.prazo) : '—';

  if (box.prestacao_atrasada) {
    lines.push({
      tone: 'late',
      text: `${box.nome_caixa}: prestação em atraso. O fechamento era ${when}.`,
    });
  } else if (box.prestacao_proxima) {
    const days = box.dias_para_prazo;
    lines.push({
      tone: 'soon',
      text:
        days <= 0
          ? `${box.nome_caixa}: a prestação vence hoje (${when}).`
          : `${box.nome_caixa}: a prestação vence em ${days} dia(s), em ${when}.`,
    });
  }

  if (box.reenvio_pendente) {
    lines.push({
      tone: 'resend',
      text: `${box.nome_caixa}: há lançamento rejeitado. Corrija e envie de novo.`,
    });
  }

  return lines;
}

export function todayPettyCashBrDate() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export async function fetchPettyCashMaintenanceList() {
  return mapList(await callRpc('petty_cash_listar_caixas'));
}

export async function fetchMyPettyCashBoxes() {
  return mapList(await callRpc('petty_cash_meus_caixas'));
}

export async function fetchPettyCashResponsibles() {
  const data = await callRpc<unknown[]>('petty_cash_listar_responsaveis');
  const rows = Array.isArray(data) ? data : [];

  return rows.map((value) => {
    const row = (value ?? {}) as Record<string, unknown>;
    return { id: asText(row.id), nome: asText(row.nome) } satisfies PettyCashResponsible;
  });
}

export async function fetchPettyCashMovements(caixaId: string) {
  const data = await callRpc<unknown[]>('petty_cash_movimentos', { p_caixa_id: caixaId });
  const rows = Array.isArray(data) ? data : [];
  return rows.map(mapMovement);
}

export async function savePettyCashBox(input: {
  id?: string | null;
  nome: string;
  responsavelId: string;
  status: PettyCashStatus;
  valorBase: number;
  diaFechamento: number;
}) {
  const data = await callRpc('petty_cash_salvar_caixa', {
    p_id: input.id ?? null,
    p_nome: input.nome,
    p_responsavel_id: input.responsavelId,
    p_status: input.status,
    p_valor_base: input.valorBase,
    p_dia_fechamento: input.diaFechamento,
  });

  return mapBox(data);
}

export async function registerPettyCashMovement(input: {
  caixaId: string;
  tipo: PettyCashMovementType;
  valor: number;
  descricao: string;
  dataIso: string;
  comprovantePath: string;
}) {
  await callRpc('petty_cash_registrar_movimento', {
    p_caixa_id: input.caixaId,
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_descricao: input.descricao,
    p_data: input.dataIso,
    p_comprovante_path: input.comprovantePath,
  });
}

export async function deletePettyCashExpense(movimentoId: string) {
  const data = await callRpc<Record<string, unknown>>('petty_cash_excluir_despesa', {
    p_movimento_id: movimentoId,
  });

  return asText(data?.comprovante);
}

export async function decidePettyCashMovement(
  movimentoId: string,
  decisao: 'aprovado' | 'rejeitado',
  motivo?: string
) {
  const data = await callRpc('petty_cash_decidir', {
    p_movimento_id: movimentoId,
    p_decisao: decisao,
    p_motivo: motivo ?? null,
  });

  return mapBox(data);
}

const parseImageInput = async (imageInput: string) => {
  let base64: string | null = null;
  let contentType = 'image/jpeg';
  let fileExtension = 'jpg';

  if (imageInput.startsWith('data:')) {
    const base64SeparatorIndex = imageInput.indexOf('base64,');
    const mimeMatch = imageInput.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);

    if (mimeMatch?.[1]) {
      contentType = mimeMatch[1];

      if (contentType.includes('png')) {
        fileExtension = 'png';
      } else if (contentType.includes('webp')) {
        fileExtension = 'webp';
      }
    }

    if (base64SeparatorIndex >= 0) {
      base64 = imageInput.slice(base64SeparatorIndex + 'base64,'.length);
    }
  } else {
    base64 = await FileSystem.readAsStringAsync(imageInput, { encoding: 'base64' });
  }

  if (!base64) {
    throw new Error('Não foi possível processar a imagem do comprovante.');
  }

  return { base64, contentType, fileExtension };
};

export async function uploadPettyCashReceipt(caixaId: string, imageInput: string) {
  const { base64, contentType, fileExtension } = await parseImageInput(imageInput);
  const relative = `${caixaId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${fileExtension}`;
  const storagePath = await withActiveTenantStoragePrefix(relative);

  const { error } = await supabase.storage.from(PETTY_CASH_BUCKET).upload(storagePath, decode(base64), {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível enviar o comprovante.');
  }

  return storagePath;
}

export async function removePettyCashReceipt(storagePath: string) {
  await supabase.storage.from(PETTY_CASH_BUCKET).remove([storagePath]);
}

export async function openPettyCashReceipt(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(PETTY_CASH_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Não foi possível abrir o comprovante.');
  }

  return data.signedUrl;
}
