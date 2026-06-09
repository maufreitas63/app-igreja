/** Modo estrito: nega acesso quando RPCs de ACL ainda não foram aplicadas no Supabase. */
export const isAclStrictMode = () => process.env.EXPO_PUBLIC_ACL_STRICT === 'true';

export const ACL_UNAVAILABLE_MESSAGE =
  'Controle de acesso indisponível. Execute os scripts ACL no Supabase ou contate o administrador.';
