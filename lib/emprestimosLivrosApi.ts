import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { mapProfileSearchRows, type ProfileSearchRow } from '@/lib/profileSearchRow';
import type { LivroRecord } from '@/lib/livrosApi';

export type EmprestimoLivroStatus = 'ativo' | 'devolvido' | 'atrasado' | 'reservado' | 'cancelado';

export type EmprestimoLivro = {
  id: string;
  livroId: string | null;
  titulo: string;
  userId: string | null;
  nomeRetirante: string;
  phone: string | null;
  retiranteDesligado: boolean;
  dataRetirada: string;
  dataPrevistaRetirada: string | null;
  dataPrevistaEntrega: string;
  dataDevolucaoReal: string | null;
  status: EmprestimoLivroStatus;
  diasRestantes: number;
};

export const EMPRESTIMO_RENOVACAO_DIAS = 10;

export type EmprestimoLivroNotice = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseStatus = (value: unknown): EmprestimoLivroStatus => {
  if (
    value === 'devolvido'
    || value === 'atrasado'
    || value === 'reservado'
    || value === 'cancelado'
  ) {
    return value;
  }
  return 'ativo';
};

const mapEmprestimo = (raw: unknown): EmprestimoLivro | null => {
  const row = asRecord(raw);
  const id = asText(row.id);
  const titulo = asText(row.titulo);
  if (!id || !titulo) {
    return null;
  }

  const dias = Number(row.dias_restantes);
  return {
    id,
    livroId: asText(row.livro_id) || null,
    titulo,
    userId: asText(row.user_id) || null,
    nomeRetirante: asText(row.nome_retirante) || 'Retirante',
    phone: asText(row.phone) || null,
    retiranteDesligado: row.retirante_desligado === true,
    dataRetirada: asText(row.data_retirada),
    dataPrevistaRetirada: asText(row.data_prevista_retirada) || null,
    dataPrevistaEntrega: asText(row.data_prevista_entrega),
    dataDevolucaoReal: asText(row.data_devolucao_real) || null,
    status: parseStatus(row.status),
    diasRestantes: Number.isFinite(dias) ? Math.trunc(dias) : 0,
  };
};

const rpcPayload = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});
  if (error) {
    if (isSupabaseRpcMissingError(error, name)) {
      throw new Error('SQL de empréstimos ausente. Execute scripts/emprestimos-livros.sql.');
    }
    throw new Error(error.message || 'Falha no empréstimo de livros.');
  }
  return asRecord(data);
};

const mapLivroRecord = (row: Record<string, unknown>): LivroRecord | null => {
  const id = asText(row.id);
  const titulo = asText(row.titulo);
  if (!id || !titulo) {
    return null;
  }
  return {
    id,
    tenant_id: asText(row.tenant_id),
    isbn: asText(row.isbn) || null,
    titulo,
    autor: asText(row.autor) || null,
    editora: asText(row.editora) || null,
    ano: asText(row.ano) || null,
    capa: asText(row.capa) || null,
    criado_em: asText(row.criado_em),
  };
};

export function todayIsoLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    return iso;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatEmprestimoDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function emprestimoCountdownLabel(item: EmprestimoLivro) {
  if (item.status === 'devolvido') {
    return 'Devolvido';
  }
  if (item.status === 'cancelado') {
    return 'Reserva cancelada';
  }
  if (item.status === 'reservado') {
    if (item.diasRestantes < 0) {
      const n = Math.abs(item.diasRestantes);
      return n === 1 ? '1 dia após a retirada prevista' : `${n} dias após a retirada prevista`;
    }
    if (item.diasRestantes === 0) {
      return 'Retirar hoje';
    }
    if (item.diasRestantes === 1) {
      return '1 dia até a retirada';
    }
    return `${item.diasRestantes} dias até a retirada`;
  }
  if (item.diasRestantes < 0) {
    const n = Math.abs(item.diasRestantes);
    return n === 1 ? '1 dia em atraso' : `${n} dias em atraso`;
  }
  if (item.diasRestantes === 0) {
    return 'Vence hoje';
  }
  if (item.diasRestantes === 1) {
    return '1 dia restante';
  }
  return `${item.diasRestantes} dias restantes`;
}

export const EMPRESTIMO_STATUS_LABEL: Record<EmprestimoLivroStatus, string> = {
  ativo: 'Ativo',
  atrasado: 'Atrasado',
  devolvido: 'Devolvido',
  reservado: 'Reservado',
  cancelado: 'Cancelado',
};

export async function listMyEmprestimosLivros(): Promise<EmprestimoLivro[]> {
  const payload = await rpcPayload('list_my_emprestimos_livros');
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows.map(mapEmprestimo).filter((row): row is EmprestimoLivro => Boolean(row));
}

export async function listEmprestimosLivrosStaff(
  scope: 'ativos' | 'historico'
): Promise<EmprestimoLivro[]> {
  const payload = await rpcPayload('list_emprestimos_livros_staff', { p_scope: scope });
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows.map(mapEmprestimo).filter((row): row is EmprestimoLivro => Boolean(row));
}

export async function searchProfilesForEmprestimo(query: string): Promise<ProfileSearchRow[]> {
  // Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  const payload = await rpcPayload('search_profiles_for_emprestimo', { p_search: query });
  return mapProfileSearchRows(payload.rows);
}

export async function createEmprestimoLivro(input: {
  livroId?: string | null;
  tituloExterno?: string | null;
  userId?: string | null;
  nomeExterno?: string | null;
}): Promise<{ success: boolean; message: string }> {
  const payload = await rpcPayload('create_emprestimo_livro', {
    p_livro_id: input.livroId ?? null,
    p_titulo_livro_externo: input.tituloExterno ?? null,
    p_user_id: input.userId ?? null,
    p_nome_retirante_externo: input.nomeExterno ?? null,
  });
  return {
    success: payload.success === true,
    message:
      asText(payload.message)
      || (payload.success === true ? 'Empréstimo registrado.' : 'Não foi possível registrar.'),
  };
}

export async function devolverEmprestimoLivro(id: string) {
  const payload = await rpcPayload('devolver_emprestimo_livro', { p_id: id });
  return {
    success: payload.success === true,
    message: asText(payload.message) || 'Devolução registrada.',
  };
}

export async function renovarEmprestimoLivro(id: string) {
  const payload = await rpcPayload('renovar_emprestimo_livro', { p_id: id });
  return {
    success: payload.success === true,
    message: asText(payload.message) || 'Prazo renovado por mais 10 dias.',
  };
}

export async function listLivrosDisponiveisReserva(): Promise<LivroRecord[]> {
  const payload = await rpcPayload('list_livros_disponiveis_reserva');
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows
    .map((row) => mapLivroRecord(asRecord(row)))
    .filter((row): row is LivroRecord => Boolean(row));
}

export async function reservarLivroAcervo(input: {
  livroId: string;
  dataRetirada: string;
  dataRetorno: string;
}): Promise<{ success: boolean; message: string }> {
  const payload = await rpcPayload('reservar_livro_acervo', {
    p_livro_id: input.livroId,
    p_data_retirada: input.dataRetirada,
    p_data_retorno: input.dataRetorno,
  });
  return {
    success: payload.success === true,
    message:
      asText(payload.message)
      || (payload.success === true ? 'Reserva registrada.' : 'Não foi possível reservar.'),
  };
}

export async function cancelarReservaLivro(id: string) {
  const payload = await rpcPayload('cancelar_reserva_livro', { p_id: id });
  return {
    success: payload.success === true,
    message: asText(payload.message) || 'Reserva cancelada.',
  };
}

export async function confirmarRetiradaReserva(id: string) {
  const payload = await rpcPayload('confirmar_retirada_reserva', { p_id: id });
  return {
    success: payload.success === true,
    message: asText(payload.message) || 'Retirada confirmada.',
  };
}

export async function fetchUnreadEmprestimoLivrosNotices(): Promise<EmprestimoLivroNotice[]> {
  try {
    const payload = await rpcPayload('list_unread_emprestimo_livros_notices');
    const rows = Array.isArray(payload.notices) ? payload.notices : [];
    return rows
      .map((entry) => {
        const row = asRecord(entry);
        const id = asText(row.id);
        if (!id) {
          return null;
        }
        return {
          id,
          title: asText(row.title) || 'Livro emprestado',
          body: asText(row.body),
          createdAt: asText(row.created_at),
        } satisfies EmprestimoLivroNotice;
      })
      .filter((row): row is EmprestimoLivroNotice => Boolean(row));
  } catch {
    return [];
  }
}

export async function markEmprestimoLivrosNoticesRead() {
  try {
    await supabase.rpc('mark_emprestimo_livros_notices_read');
  } catch {
    // Falha silenciosa: o aviso continua visível até a próxima leitura.
  }
}
