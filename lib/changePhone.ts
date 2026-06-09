import { supabase } from '@/lib/supabase';

export type ChangePhoneEverywhereResult = {
  success: boolean;
  message?: string;
  old_phone?: string;
  new_phone?: string;
  updated_rows?: number;
  changes?: Array<{
    table?: string;
    column?: string;
    updated_rows?: number;
  }>;
};

export async function changePhoneEverywhere(oldPhone: string, newPhone: string) {
  const trimmedOld = oldPhone.trim();
  const trimmedNew = newPhone.trim();

  if (!trimmedOld) {
    throw new Error('Telefone atual não encontrado no perfil.');
  }

  if (!trimmedNew) {
    throw new Error('Informe o novo número de celular.');
  }

  const { data, error } = await supabase.rpc('change_phone_everywhere', {
    p_old_phone: trimmedOld,
    p_new_phone: trimmedNew,
  });

  if (error) {
    if (
      error.code === 'PGRST202'
      || error.message.toLowerCase().includes('change_phone_everywhere')
    ) {
      throw new Error(
        'O banco ainda não foi atualizado para trocar o telefone em todas as tabelas. Execute o script scripts/change-phone-everywhere.sql no Supabase.'
      );
    }

    throw error;
  }

  const result = (data ?? {}) as ChangePhoneEverywhereResult;

  if (result.success === false) {
    throw new Error(result.message ?? 'Não foi possível atualizar o telefone em todas as tabelas.');
  }

  return result;
}
