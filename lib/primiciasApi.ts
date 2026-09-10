/**
 * Campanha Prímicias — doações em espécie.
 * SQL: scripts/primicias-schema.sql, scripts/primicias-event-history.sql
 */

import { getEventCalendarDate, getTodayCalendarDateInAppTimezone } from '@/lib/eventDate';
import { formatShortName } from '@/lib/formatShortName';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PRIMICIAS_SQL_HINT =
  'A campanha Prímicias ainda não está disponível neste ambiente.';

export const PRIMICIAS_EVENT_TITLE = 'Contribuição para Prímicias';
export const PRIMICIAS_RESET_DAYS = 10;

export const PRIMICIAS_CATEGORIES = ['alimenticios', 'limpeza_higiene', 'criancas'] as const;
export type PrimiciasCategory = (typeof PRIMICIAS_CATEGORIES)[number];

export const PRIMICIAS_CATEGORY_LABEL: Record<PrimiciasCategory, string> = {
  alimenticios: 'Itens alimentícios',
  limpeza_higiene: 'Kit limpeza e higiene',
  criancas: 'Itens para crianças',
};

export type PrimiciasPledge = {
  profileId: string;
  name: string;
  isMine: boolean;
  createdAt: string;
};

export type PrimiciasItem = {
  id: string;
  category: PrimiciasCategory;
  quantity: number;
  unit: string;
  productName: string;
  weight: string;
  catalogKey: string | null;
  sortOrder: number;
  pledges: PrimiciasPledge[];
};

export type PrimiciasOccurrence = {
  id: string;
  eventId: string;
  eventDate: string;
  startsAt: string;
  eventEndDate: string | null;
  eventLocal: string;
  resetOn: string;
  title: string;
};

export type PrimiciasListResult = {
  items: PrimiciasItem[];
  canManage: boolean;
  occurrence: PrimiciasOccurrence | null;
};

export type PrimiciasHistoryDonor = {
  profileId: string | null;
  name: string;
  items: Array<Pick<PrimiciasItem, 'quantity' | 'unit' | 'productName' | 'weight'>>;
};

export type PrimiciasHistoryDay = {
  eventDate: string;
  occurrenceId: string;
  donors: PrimiciasHistoryDonor[];
};

export type PrimiciasEventCommitment = {
  profileId: string;
  name: string;
  items: Array<Pick<PrimiciasItem, 'quantity' | 'unit' | 'productName' | 'weight'>>;
};

const throwIfMissing = (error: { message?: string; code?: string }, fn: string) => {
  if (isSupabaseRpcMissingError(error, fn)) {
    throw new Error(PRIMICIAS_SQL_HINT);
  }
  throw error;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const parseCategory = (value: unknown): PrimiciasCategory | null => {
  const category = String(value ?? '').trim();
  return PRIMICIAS_CATEGORIES.includes(category as PrimiciasCategory)
    ? (category as PrimiciasCategory)
    : null;
};

export function formatPrimiciasItemLine(item: Pick<PrimiciasItem, 'quantity' | 'unit' | 'productName' | 'weight'>) {
  return `${item.quantity} / ${item.unit} / ${item.productName} / ${item.weight}`;
}

export function formatPrimiciasIsoDate(value: string | null | undefined) {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? '').trim();
}

const shiftIsoDate = (yyyyMmDd: string, days: number) => {
  const [year, month, day] = yyyyMmDd.split('-').map((part) => Number.parseInt(part, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

/** Mantém o evento na agenda da família até D+10. */
export function isPrimiciasEventVisibleOnAgenda(
  name: string | null | undefined,
  eventDate: string | null | undefined
) {
  if ((name ?? '').trim() !== PRIMICIAS_EVENT_TITLE) {
    return false;
  }

  const day = getEventCalendarDate(eventDate);
  if (!day) {
    return false;
  }

  const today = getTodayCalendarDateInAppTimezone();
  if (day >= today) {
    return true;
  }

  return shiftIsoDate(day, PRIMICIAS_RESET_DAYS) >= today;
}

const parsePledge = (value: unknown): PrimiciasPledge | null => {
  const row = asRecord(value);
  const profileId = String(row.profile_id ?? '').trim();

  if (!profileId) {
    return null;
  }

  return {
    profileId,
    name: formatShortName(String(row.name ?? '').trim() || 'Membro'),
    isMine: row.is_mine === true,
    createdAt: String(row.created_at ?? ''),
  };
};

const parseItem = (value: unknown): PrimiciasItem | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();
  const category = parseCategory(row.category);
  const quantity = Number(row.quantity);
  const unit = String(row.unit ?? '').trim();
  const productName = String(row.product_name ?? '').trim();
  const weight = String(row.weight ?? '').trim();

  if (!id || !category || !Number.isFinite(quantity) || quantity < 1 || !unit || !productName || !weight) {
    return null;
  }

  const pledges = Array.isArray(row.pledges)
    ? row.pledges.map(parsePledge).filter((entry): entry is PrimiciasPledge => entry !== null)
    : [];

  return {
    id,
    category,
    quantity,
    unit,
    productName,
    weight,
    catalogKey: row.catalog_key ? String(row.catalog_key) : null,
    sortOrder: Number(row.sort_order ?? 0),
    pledges,
  };
};

const parseSnapshotItem = (
  value: unknown
): Pick<PrimiciasItem, 'quantity' | 'unit' | 'productName' | 'weight'> | null => {
  const row = asRecord(value);
  const quantity = Number(row.quantity);
  const unit = String(row.unit ?? '').trim();
  const productName = String(row.product_name ?? '').trim();
  const weight = String(row.weight ?? '').trim();

  if (!Number.isFinite(quantity) || quantity < 1 || !unit || !productName || !weight) {
    return null;
  }

  return { quantity, unit, productName, weight };
};

const parseOccurrence = (value: unknown): PrimiciasOccurrence | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();
  const eventId = String(row.event_id ?? '').trim();
  const eventDate = String(row.event_date ?? '').trim();
  const startsAt = String(row.starts_at ?? '').trim();

  if (!id || !eventId || !eventDate) {
    return null;
  }

  return {
    id,
    eventId,
    eventDate: eventDate.slice(0, 10),
    startsAt: startsAt || `${eventDate.slice(0, 10)}T09:00:00-03:00`,
    eventEndDate: String(row.event_end_date ?? '').trim() || null,
    eventLocal: String(row.event_local ?? '').trim() || 'Campanha Prímicias',
    resetOn: String(row.reset_on ?? '').slice(0, 10),
    title: String(row.title ?? PRIMICIAS_EVENT_TITLE).trim() || PRIMICIAS_EVENT_TITLE,
  };
};

async function rpcPayload(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args ?? {});

  if (error) {
    throwIfMissing(error, fn);
  }

  return asRecord(data);
}

export async function listPrimiciasItems(): Promise<PrimiciasListResult> {
  const payload = await rpcPayload('list_primicias_items');

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar os itens.'));
  }

  const rows = Array.isArray(payload.items) ? payload.items : [];

  return {
    items: rows.map(parseItem).filter((entry): entry is PrimiciasItem => entry !== null),
    canManage: payload.can_manage === true,
    occurrence: parseOccurrence(payload.occurrence),
  };
}

export async function togglePrimiciasPledge(itemId: string) {
  const payload = await rpcPayload('toggle_primicias_pledge', { p_item_id: itemId });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível registrar o compromisso.'));
  }

  return {
    pledged: payload.pledged === true,
    message: String(payload.message ?? ''),
  };
}

export async function createPrimiciasItem(input: {
  category: PrimiciasCategory;
  quantity: number;
  unit: string;
  productName: string;
  weight: string;
}) {
  const payload = await rpcPayload('create_primicias_item', {
    p_category: input.category,
    p_quantity: input.quantity,
    p_unit: input.unit.trim(),
    p_product_name: input.productName.trim(),
    p_weight: input.weight.trim(),
  });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível cadastrar o item.'));
  }

  return String(payload.message ?? 'Item cadastrado.');
}

export async function deletePrimiciasItem(itemId: string) {
  const payload = await rpcPayload('delete_primicias_item', { p_item_id: itemId });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível excluir o item.'));
  }

  return String(payload.message ?? 'Item excluído.');
}

export async function savePrimiciasEventDate(eventDate: string) {
  const payload = await rpcPayload('save_primicias_event_date', { p_event_date: eventDate });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível gravar a data.'));
  }

  return String(payload.message ?? 'Data gravada.');
}

export async function listPrimiciasHistory(): Promise<PrimiciasHistoryDay[]> {
  const payload = await rpcPayload('list_primicias_history');

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar o histórico.'));
  }

  const rows = Array.isArray(payload.history) ? payload.history : [];

  return rows
    .map((entry) => {
      const row = asRecord(entry);
      const eventDate = String(row.event_date ?? '').trim().slice(0, 10);
      const occurrenceId = String(row.occurrence_id ?? '').trim();

      if (!eventDate || !occurrenceId) {
        return null;
      }

      const donors = Array.isArray(row.donors)
        ? row.donors
            .map((donorValue) => {
              const donor = asRecord(donorValue);
              const name = String(donor.name ?? '').trim() || 'Membro';
              const items = Array.isArray(donor.items)
                ? donor.items
                    .map(parseSnapshotItem)
                    .filter(
                      (item): item is Pick<PrimiciasItem, 'quantity' | 'unit' | 'productName' | 'weight'> =>
                        item !== null
                    )
                : [];

              return {
                profileId: donor.profile_id ? String(donor.profile_id) : null,
                name: formatShortName(name),
                items,
              } satisfies PrimiciasHistoryDonor;
            })
            .filter((donor) => donor.items.length > 0)
        : [];

      return { eventDate, occurrenceId, donors } satisfies PrimiciasHistoryDay;
    })
    .filter((entry): entry is PrimiciasHistoryDay => entry !== null);
}

export async function listPrimiciasEventCommitments(eventId: string): Promise<{
  isPrimicias: boolean;
  title: string;
  commitments: PrimiciasEventCommitment[];
}> {
  if (!eventId.trim()) {
    return { isPrimicias: false, title: PRIMICIAS_EVENT_TITLE, commitments: [] };
  }

  try {
    const payload = await rpcPayload('list_primicias_event_commitments', { p_event_id: eventId });

    if (payload.success !== true) {
      return { isPrimicias: false, title: PRIMICIAS_EVENT_TITLE, commitments: [] };
    }

    const rows = Array.isArray(payload.commitments) ? payload.commitments : [];

    return {
      isPrimicias: payload.is_primicias === true,
      title: String(payload.title ?? PRIMICIAS_EVENT_TITLE).trim() || PRIMICIAS_EVENT_TITLE,
      commitments: rows
        .map((entry) => {
          const row = asRecord(entry);
          const profileId = String(row.profile_id ?? '').trim();
          const name = String(row.name ?? '').trim() || 'Membro';
          const items = Array.isArray(row.items)
            ? row.items
                .map(parseSnapshotItem)
                .filter(
                  (item): item is Pick<PrimiciasItem, 'quantity' | 'unit' | 'productName' | 'weight'> =>
                    item !== null
                )
            : [];

          if (!profileId || items.length === 0) {
            return null;
          }

          return { profileId, name, items } satisfies PrimiciasEventCommitment;
        })
        .filter((entry): entry is PrimiciasEventCommitment => entry !== null),
    };
  } catch {
    return { isPrimicias: false, title: PRIMICIAS_EVENT_TITLE, commitments: [] };
  }
}
