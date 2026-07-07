import { withActiveMembershipProfileFilter } from '@/lib/activeMemberProfile';
import type { BirthdaysClassEntry } from '@/lib/birthdaysClassTypes';
import { parseBirthdayParts } from '@/lib/birthdaysClassUtils';
import { formatFullName } from '@/lib/fullName';
import { supabase } from '@/lib/supabase';

export async function loadBirthdaysClassData(): Promise<BirthdaysClassEntry[]> {
  const { data, error } = await withActiveMembershipProfileFilter(
    supabase.from('profiles').select('full_name, birth_date, phone')
  )
    .not('birth_date', 'is', null)
    .order('full_name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((entry) => {
      const parts = parseBirthdayParts(entry.birth_date);
      const fullName = formatFullName(entry.full_name);

      if (!parts || !fullName) {
        return null;
      }

      return {
        full_name: fullName,
        birth_date: String(entry.birth_date),
        phone: entry.phone ? String(entry.phone) : null,
        day: parts.day,
        month: parts.month,
      } satisfies BirthdaysClassEntry;
    })
    .filter((entry): entry is BirthdaysClassEntry => entry !== null)
    .sort(
      (left, right) =>
        left.month - right.month ||
        left.day - right.day ||
        left.full_name.localeCompare(right.full_name, 'pt-BR')
    );
}
