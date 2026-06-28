import { getStoredSessionToken } from '@/lib/userSession';

/** Sessão autenticada exige token emitido por `verificar_login` / cadastro — telefone sozinho não basta. */
export async function hasStoredMemberSessionToken(): Promise<boolean> {
  const token = (await getStoredSessionToken())?.trim();
  return Boolean(token);
}
