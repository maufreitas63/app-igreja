import { normalizeFamilyCode } from '@/lib/family';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { applyProfileBirthDates } from '../lib/profileBirthDates';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export type FamilyMember = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  relationship: string | null;
  family_id: string;
  accepted?: boolean | null;
  created_at?: string;
};

export const useFamilyMembers = (familyId: string) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!familyId) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const normalizedFamilyId = normalizeFamilyCode(familyId);

    const { data, error: fetchError } = await supabase
      .from('members')
      .select('*')
      .eq('family_id', normalizedFamilyId)
      .eq('accepted', MEMBER_ACCEPTED_VALUE)
      .order('full_name');

    if (fetchError) {
      setError(fetchError);
      setMembers([]);
    } else {
      const nextMembers = await applyProfileBirthDates((data as FamilyMember[]) ?? []);
      setMembers(nextMembers);
    }

    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { members, loading, error, refetch };
};
