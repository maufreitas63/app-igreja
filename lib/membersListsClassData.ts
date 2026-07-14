import {
  fetchMembersDirectoryFromProfiles,
  fetchInactiveMembersDirectoryFromProfiles,
  fetchVisitorsDirectoryFromProfiles,
  type MembersDirectoryEntry,
} from '@/lib/membersListApi';
import type { MembersListsClassEntry } from '@/lib/membersListsClassTypes';
import { dedupeMembersListsClassEntries } from '@/lib/membersListsClassUtils';

const mapDirectoryEntry = (entry: MembersDirectoryEntry): MembersListsClassEntry => ({
  id: entry.id,
  full_name: entry.full_name,
  short_name: entry.short_name,
  family_id: entry.family_id,
  relationship: entry.relationship,
  phone: entry.phone,
  cep: entry.cep,
  address_street: entry.address_street,
  address_number: entry.address_number,
  address_neighborhood: entry.address_neighborhood,
  address_city: entry.address_city,
  address_state: entry.address_state,
});

export async function loadMembersListsClassMembers(): Promise<MembersListsClassEntry[]> {
  const directoryEntries = await fetchMembersDirectoryFromProfiles();
  return dedupeMembersListsClassEntries(directoryEntries.map(mapDirectoryEntry));
}

export async function loadMembersListsClassInactiveMembers(): Promise<MembersListsClassEntry[]> {
  const directoryEntries = await fetchInactiveMembersDirectoryFromProfiles();
  return dedupeMembersListsClassEntries(directoryEntries.map(mapDirectoryEntry));
}

export async function loadMembersListsClassVisitors(): Promise<MembersListsClassEntry[]> {
  const directoryEntries = await fetchVisitorsDirectoryFromProfiles();
  return dedupeMembersListsClassEntries(directoryEntries.map(mapDirectoryEntry));
}
