import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { getStoredTenantId } from '@/lib/tenantSession';
import { buildFinancialReferencia } from '@/lib/treasuryReceiptBatchPath';

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
  exclusoesSolicitadas: PettyCashDeletionRequest[];
};

export type PettyCashDeletionRequest = {
  id: string;
  descricao: string;
  valor: number;
  dataMovimento: string;
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
  exclusaoSolicitada: boolean;
  criado_por: string;
  created_at: string;
};

export type PettyCashResponsible = {
  id: string;
  nome: string;
};

export type PettyCashReceiptOption = {
  id: string;
  caixaNome: string;
  descricao: string;
  valor: number;
  dataMovimento: string;
  comprovanteUrl: string;
  arquivo: string;
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

const mapDeletionRequest = (value: unknown): PettyCashDeletionRequest => {
  const row = (value ?? {}) as Record<string, unknown>;

  return {
    id: asText(row.id),
    descricao: asText(row.descricao),
    valor: asNumber(row.valor),
    dataMovimento: asText(row.data_movimento).slice(0, 10),
  };
};

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
    exclusoesSolicitadas: Array.isArray(row.exclusoes_solicitadas)
      ? row.exclusoes_solicitadas.map(mapDeletionRequest)
      : [],
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
    exclusaoSolicitada: row.exclusao_solicitada === true,
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

export async function deletePettyCashBox(caixaId: string) {
  const data = await callRpc<Record<string, unknown>>('petty_cash_excluir_caixa', {
    p_caixa_id: caixaId,
  });
  const paths = data?.comprovantes;

  return Array.isArray(paths) ? paths.map(asText).filter((path) => path.length > 0) : [];
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

export async function updatePettyCashExpenseRequest(input: {
  movimentoId: string;
  valor: number;
  descricao: string;
  dataIso: string;
}) {
  await callRpc('petty_cash_editar_despesa', {
    p_movimento_id: input.movimentoId,
    p_valor: input.valor,
    p_descricao: input.descricao,
    p_data: input.dataIso,
  });
}

export async function requestPettyCashExpenseDeletion(movimentoId: string) {
  await callRpc('petty_cash_solicitar_exclusao', { p_movimento_id: movimentoId });
}

export async function decidePettyCashExpenseDeletion(
  movimentoId: string,
  decisao: 'confirmada' | 'mantida'
) {
  const data = await callRpc<Record<string, unknown>>('petty_cash_decidir_exclusao', {
    p_movimento_id: movimentoId,
    p_decisao: decisao,
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

const imageInputToJpegBase64 = async (imageInput: string) => {
  if (typeof document !== 'undefined') {
    const base64 = await new Promise<string>((resolve, reject) => {
      const image = new window.Image();

      image.onload = () => {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
          reject(new Error('Não foi possível ler a imagem do comprovante.'));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Não foi possível gerar o JPEG do comprovante.'));
          return;
        }

        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
      };

      image.onerror = () => {
        reject(new Error('Não foi possível converter o comprovante para JPEG.'));
      };

      image.src = imageInput;
    });

    return base64;
  }

  const parsed = await parseImageInput(imageInput);

  if (parsed.contentType === 'image/jpeg' || parsed.fileExtension === 'jpg') {
    return parsed.base64;
  }

  throw new Error('Abra o pequeno caixa no navegador para salvar o comprovante em JPEG.');
};

export function formatPettyCashReceiptFileName(isoDate: string, amount: number, position?: number) {
  const canonical = buildFinancialReferencia(isoDate, amount);

  if (!canonical) {
    return '';
  }

  if (!position || position <= 1) {
    return canonical;
  }

  return canonical.replace(/\.jpg$/i, ` ${position}.jpg`);
}

const pettyCashReceiptFileName = (isoDate: string, amount: number, position?: number) => {
  const canonical = formatPettyCashReceiptFileName(isoDate, amount, position);

  if (!canonical) {
    throw new Error('Informe a data da despesa para nomear o comprovante.');
  }

  return canonical.replace(/ /g, '_').replace(/,/g, '-');
};

export async function uploadPettyCashReceipt(
  caixaId: string,
  imageInput: string,
  isoDate: string,
  amount: number
) {
  const base64 = await imageInputToJpegBase64(imageInput);
  const tenantId = (await getStoredTenantId())?.trim();

  if (!tenantId) {
    throw new Error('Selecione a igreja novamente para anexar o comprovante.');
  }

  // O id do caixa também é UUID. O prefixo genérico o trataria como igreja e omitiria o tenant.
  const folder = `${tenantId}/${caixaId}`;
  const { data: existing } = await supabase.storage.from(PETTY_CASH_BUCKET).list(folder, { limit: 1000 });
  const names = new Set((existing ?? []).map((file) => file.name));
  let fileName = pettyCashReceiptFileName(isoDate, amount);
  let position = 2;

  while (names.has(fileName)) {
    fileName = pettyCashReceiptFileName(isoDate, amount, position);
    position += 1;
  }

  const storagePath = `${folder}/${fileName}`;
  const { error } = await supabase.storage.from(PETTY_CASH_BUCKET).upload(storagePath, decode(base64), {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível enviar o comprovante.');
  }

  return storagePath;
}

export async function removePettyCashReceipt(storagePath: string) {
  const { error } = await supabase.storage.from(PETTY_CASH_BUCKET).remove([storagePath]);

  if (error) {
    throw new Error(error.message || 'Não foi possível apagar o comprovante.');
  }
}

export async function listPettyCashReceiptsForEntry() {
  const data = await callRpc<unknown[]>('petty_cash_listar_comprovantes');

  return (Array.isArray(data) ? data : []).map((item) => {
    const row = item as Record<string, unknown>;

    return {
      id: asText(row.id),
      caixaNome: asText(row.caixaNome),
      descricao: asText(row.descricao),
      valor: asNumber(row.valor),
      dataMovimento: asText(row.dataMovimento),
      comprovanteUrl: asText(row.comprovanteUrl),
      arquivo: asText(row.arquivo),
    } satisfies PettyCashReceiptOption;
  });
}

export async function downloadPettyCashReceiptDataUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(PETTY_CASH_BUCKET).download(storagePath);

  if (error || !data) {
    throw new Error(error?.message || 'Não foi possível abrir o comprovante do pequeno caixa.');
  }

  if (typeof FileReader === 'undefined') {
    throw new Error('A leitura do comprovante não está disponível neste aparelho.');
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Não foi possível ler o comprovante do pequeno caixa.'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('Não foi possível ler o comprovante do pequeno caixa.'));
    };

    reader.readAsDataURL(data);
  });
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
