-- Patch: auditoria IA via anon key (Cloudflare Pages sem service role).
-- Execute no Supabase se access-control-ai-curator.sql já foi aplicado antes desta mudança.

create or replace function public.registrar_auditoria_ia_actor(
  p_actor_profile_id uuid,
  p_question text,
  p_ai_response text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'nao autorizado para esta funçao';
  end if;

  if not public.profile_is_ai_curator(p_actor_profile_id) then
    raise exception 'nao autorizado para esta funçao';
  end if;

  return public.insert_ai_audit_log(
    p_actor_profile_id,
    p_question,
    p_ai_response,
    public.profile_role_names_csv(p_actor_profile_id)
  );
end;
$$;

grant execute on function public.registrar_auditoria_ia_actor(uuid, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
