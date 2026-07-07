import type { MembersListsClassEntry } from '@/lib/membersListsClassTypes';

const cleanPhoneDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

export const normalizeMembersListsSearchQuery = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const dedupeMembersListsClassEntries = (entries: MembersListsClassEntry[]) => {
  const byPerson = new Map<string, MembersListsClassEntry>();

  for (const entry of entries) {
    const key = `${normalizeMembersListsSearchQuery(entry.full_name)}|${normalizeMembersListsSearchQuery(entry.family_id)}`;
    const current = byPerson.get(key);

    if (!current) {
      byPerson.set(key, entry);
      continue;
    }

    const currentHasPhone = Boolean(cleanPhoneDigits(current.phone));
    const nextHasPhone = Boolean(cleanPhoneDigits(entry.phone));

    if (!currentHasPhone && nextHasPhone) {
      byPerson.set(key, entry);
      continue;
    }

    const currentHasRelationship = Boolean((current.relationship ?? '').trim());
    const nextHasRelationship = Boolean((entry.relationship ?? '').trim());

    if (!currentHasRelationship && nextHasRelationship) {
      byPerson.set(key, entry);
    }
  }

  return Array.from(byPerson.values()).sort((left, right) =>
    left.full_name.localeCompare(right.full_name, 'pt-BR')
  );
};

export const filterMembersListsClassEntries = (
  entries: MembersListsClassEntry[],
  searchQuery: string
) => {
  const query = normalizeMembersListsSearchQuery(searchQuery);

  if (!query) {
    return entries;
  }

  return entries.filter((entry) => {
    const fullName = normalizeMembersListsSearchQuery(entry.full_name);
    const shortName = normalizeMembersListsSearchQuery(entry.short_name);

    return fullName.includes(query) || shortName.includes(query);
  });
};
