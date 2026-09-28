import { getAppParameterValue } from '@/lib/appParameters';
import {
  isConjugeRelationship,
  isRepresentanteLegalRelationship,
} from '@/lib/familyRelationshipOptions';
import { normalizeFamilyCode } from '@/lib/family';
import { formatFullName } from '@/lib/fullName';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import type { ManagedMember, ManageMembersData } from '@/lib/manageMembers/shared';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const FAMILY_DIRECTORY_SQL_HINT =
  'Execute no Supabase: scripts/list-tenant-family-directory.sql';

export type FamilyDirectoryOption = {
  code: string;
  label: string;
  /** Código + nomes de todos os integrantes, para a busca achar a família por qualquer pessoa. */
  searchText: string;
};

const asText = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const parseMember = (row: Record<string, unknown>): ManagedMember | null => {
  const id = asText(row.id);
  const familyId = normalizeFamilyCode(asText(row.family_id));
  const fullName = formatFullName(asText(row.full_name) ?? '');

  if (!id || !familyId || !fullName) {
    return null;
  }

  return {
    id,
    family_id: familyId,
    full_name: fullName,
    relationship: asText(row.relationship) ?? '',
    phone: asText(row.phone),
    birth_date: asText(row.birth_date),
    marriage_date: asText(row.marriage_date),
    accepted: row.accepted === true ? true : row.accepted === false ? false : null,
  };
};

export async function fetchTenantFamilyMembers(): Promise<ManagedMember[]> {
  const { data, error } = await supabase.rpc('list_tenant_family_directory');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_tenant_family_directory')) {
      throw new Error(FAMILY_DIRECTORY_SQL_HINT);
    }

    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => parseMember(row as Record<string, unknown>))
    .filter((row): row is ManagedMember => row !== null);
}

const namedPerson = (members: ManagedMember[], match: (relationship: string) => boolean) =>
  members.find((member) => match(member.relationship) && member.full_name.trim())?.full_name.trim()
  ?? '';

/** Vários integrantes: "IBN0001. Família de {representante ou cônjuge}". Um só: "IBN0001. {nome}". */
export function familyDirectoryOptionLabel(code: string, members: ManagedMember[]) {
  const person =
    namedPerson(members, isRepresentanteLegalRelationship)
    || namedPerson(members, isConjugeRelationship)
    || members.find((member) => member.full_name.trim())?.full_name.trim()
    || '';

  if (!person) {
    return code;
  }

  if (members.length <= 1) {
    return `${code}. ${person}`;
  }

  return `${code}. Família de ${person}`;
}

function familyDirectorySearchText(code: string, members: ManagedMember[]) {
  const names = members
    .map((member) => member.full_name.trim())
    .filter(Boolean);

  return [code, ...names].join(' ');
}

export function buildFamilyDirectoryOptions(members: ManagedMember[]): FamilyDirectoryOption[] {
  const byCode = new Map<string, ManagedMember[]>();

  for (const member of members) {
    const code = normalizeFamilyCode(member.family_id);
    if (!code) {
      continue;
    }

    const group = byCode.get(code) ?? [];
    group.push(member);
    byCode.set(code, group);
  }

  return [...byCode.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'pt-BR', { numeric: true }))
    .map(([code, group]) => ({
      code,
      label: familyDirectoryOptionLabel(code, group),
      searchText: familyDirectorySearchText(code, group),
    }));
}

const parseWholeNumber = (value: string | null) => {
  if (!value || !/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number.parseInt(value.trim(), 10);
};

const parseSim = (value: string | null) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') === 'sim';

/** Integrantes de um código da igreja atual, sem criar família nova para a sessão. */
export async function loadDirectoryFamilyData(familyCode: string): Promise<ManageMembersData> {
  const code = normalizeFamilyCode(familyCode);
  const [rows, sessionProfile, idadeKidsValue, idadeTeensValue, vidaTmpValue] = await Promise.all([
    fetchTenantFamilyMembers(),
    loadEffectiveSessionProfile(),
    getAppParameterValue('idade_kids'),
    getAppParameterValue('idade_teens'),
    getAppParameterValue('vida_tmp'),
  ]);

  return {
    familyId: code,
    members: rows.filter((member) => member.family_id === code),
    profileName: formatFullName(sessionProfile?.full_name),
    profilePhone: sessionProfile?.phone?.trim() || null,
    acceptorProfileId: sessionProfile?.id ?? null,
    idadeKids: parseWholeNumber(idadeKidsValue),
    idadeTeens: parseWholeNumber(idadeTeensValue),
    showVidaTmp: parseSim(vidaTmpValue),
  };
}
