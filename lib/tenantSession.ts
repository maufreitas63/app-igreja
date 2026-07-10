import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearEntityPrefixCache } from '@/lib/entityPrefix';
import { clearAppParameterCache } from '@/lib/appParameters';
import { supabase } from '@/lib/supabase';

export const USER_TENANT_ID_STORAGE_KEY = 'user_tenant_id';

export type SessionIgreja = {
  id: string;
  code: string;
  name: string;
  is_primary: boolean;
  is_linked: boolean;
};

export async function getStoredTenantId(): Promise<string | null> {
  const raw = (await AsyncStorage.getItem(USER_TENANT_ID_STORAGE_KEY))?.trim();
  return raw || null;
}

export async function persistTenantId(tenantId: string | null | undefined) {
  const id = tenantId?.trim();
  if (id) {
    await AsyncStorage.setItem(USER_TENANT_ID_STORAGE_KEY, id);
    return;
  }
  await AsyncStorage.removeItem(USER_TENANT_ID_STORAGE_KEY);
}

export async function clearTenantId() {
  await AsyncStorage.removeItem(USER_TENANT_ID_STORAGE_KEY);
}

export async function listSessionIgrejas(): Promise<SessionIgreja[]> {
  const { data, error } = await supabase.rpc('list_session_igrejas');
  if (error) {
    throw error;
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) => {
      const id = typeof row?.id === 'string' ? row.id.trim() : '';
      if (!id) return null;
      return {
        id,
        code: String(row?.code ?? '').trim(),
        name: String(row?.name ?? '').trim(),
        is_primary: Boolean(row?.is_primary),
        is_linked: Boolean(row?.is_linked),
      } satisfies SessionIgreja;
    })
    .filter((row): row is SessionIgreja => row != null);
}

/** Precisa escolher igreja? (>1 disponível) */
export async function shouldPromptTenantSelection(): Promise<boolean> {
  const churches = await listSessionIgrejas();
  return churches.length > 1;
}

export async function activateSessionTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
  const id = tenantId.trim();
  if (!id) {
    return { success: false, message: 'Igreja não informada.' };
  }

  const { data, error } = await supabase.rpc('set_session_active_tenant', {
    p_tenant_id: id,
  });

  if (error) {
    return { success: false, message: error.message || 'Falha ao ativar igreja.' };
  }

  const success = data?.success === true;
  if (success) {
    await persistTenantId(id);
    clearEntityPrefixCache();
    clearAppParameterCache();
  }

  return {
    success,
    message: typeof data?.message === 'string' ? data.message : success ? 'Ok' : 'Falha.',
  };
}

export async function onboardIgrejaAdmin(code: string, name: string) {
  const { data, error } = await supabase.rpc('onboard_igreja_admin', {
    p_code: code.trim(),
    p_name: name.trim(),
  });

  if (error) {
    throw error;
  }

  return data as {
    success?: boolean;
    message?: string;
    tenant_id?: string;
    code?: string;
    name?: string;
  };
}

export const buildSelecionarIgrejaRoute = (phone: string) => ({
  pathname: '/selecionar-igreja' as const,
  params: {
    phone: encodeURIComponent(phone),
  },
});
