-- Patch: IA no Cloudflare sem service role + chave Gemini no Supabase.
-- Execute no Supabase se access-control-ai-curator.sql já foi aplicado antes.

create table if not exists public.ai_server_config (
  config_key text primary key,
  config_value text not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_server_config enable row level security;

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

create or replace function public.obter_chave_gemini_ia_curador(p_actor_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_actor_profile_id is null then
    raise exception 'nao autorizado para esta funçao';
  end if;

  if not public.profile_is_ai_curator(p_actor_profile_id) then
    raise exception 'nao autorizado para esta funçao';
  end if;

  select c.config_value
    into v_key
    from public.ai_server_config c
   where c.config_key = 'gemini_api_key';

  if nullif(trim(coalesce(v_key, '')), '') is null then
    raise exception
      'Chave Gemini não configurada. Execute scripts/configurar-gemini-api-key.sql no Supabase ou defina GEMINI_API_KEY no Cloudflare Pages.';
  end if;

  return trim(v_key);
end;
$$;

create or replace function public.salvar_chave_gemini_ia_admin(
  p_actor_profile_id uuid,
  p_api_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_ai_audit_logs_admin(p_actor_profile_id);

  if nullif(trim(coalesce(p_api_key, '')), '') is null then
    raise exception 'Informe a chave da API Gemini.';
  end if;

  insert into public.ai_server_config (config_key, config_value)
  values ('gemini_api_key', trim(p_api_key))
  on conflict (config_key) do update
    set config_value = excluded.config_value,
        updated_at = now();
end;
$$;

grant execute on function public.registrar_auditoria_ia_actor(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.obter_chave_gemini_ia_curador(uuid) to anon, authenticated, service_role;
grant execute on function public.salvar_chave_gemini_ia_admin(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
