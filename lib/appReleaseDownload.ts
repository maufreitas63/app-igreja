import { supabase } from '@/lib/supabase';

export type AppReleaseUnlockResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; error: string };

export async function unlockAppReleaseDownload(
  password: string
): Promise<AppReleaseUnlockResult> {
  const trimmed = password.trim();

  if (!trimmed) {
    return { ok: false, error: 'Informe a senha enviada junto com o link.' };
  }

  const { data, error } = await supabase.rpc('unlock_app_release', {
    p_password: trimmed,
  });

  if (error) {
    return { ok: false, error: 'Não foi possível validar a senha. Tente de novo.' };
  }

  const payload = data as {
    ok?: boolean;
    url?: string;
    file_name?: string;
    error?: string;
  } | null;

  if (!payload?.ok || !payload.url) {
    return {
      ok: false,
      error: payload?.error?.trim() || 'Senha inválida.',
    };
  }

  return {
    ok: true,
    url: payload.url,
    fileName: payload.file_name?.trim() || 'Comunidade-Digital.apk',
  };
}
