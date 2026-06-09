import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type FamilyRecord = {
  id: string;
  name: string;
};

type FamilyMemberRecord = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  is_responsavel: boolean | null;
};

export const useFamilyData = (userId: string | undefined) => {
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [members, setMembers] = useState<FamilyMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setFamily(null);
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('family_group_id')
          .eq('auth_user_id', userId)
          .single();

        if (profileError) {
          throw profileError;
        }

        if (!profile?.family_group_id) {
          setFamily(null);
          setMembers([]);
          return;
        }

        const { data: familyData, error: familyError } = await supabase
          .from('families')
          .select(`
            id,
            name,
            members (
              id,
              nome,
              data_nascimento,
              is_responsavel
            )
          `)
          .eq('id', profile.family_group_id)
          .single();

        if (familyError) {
          throw familyError;
        }

        if (!familyData) {
          setFamily(null);
          setMembers([]);
          return;
        }

        setFamily({ id: familyData.id, name: familyData.name });
        setMembers((familyData.members as FamilyMemberRecord[] | null) ?? []);
      } catch (err) {
        console.error('Erro ao carregar dados da família:', err);
        setFamily(null);
        setMembers([]);
        setError('Não foi possível carregar os dados da família.');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [userId]);

  return { family, members, loading, error };
};
