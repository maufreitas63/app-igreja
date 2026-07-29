-- Restaura current_session_profile_id com suporte a Modo Ghost.
-- Uma migration posterior sobrescreveu a função e passou a ignorar x-ghost-profile-id,
-- fazendo obter_perfil_sessao_efetiva / ACL retornarem sempre o operador real.

create or replace function public.current_ghost_profile_id_from_header()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_raw text;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      return null;
  end;

  if v_headers is null or v_headers = '' then
    return null;
  end if;

  -- PostgREST normaliza chaves em minúsculas.
  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-ghost-profile-id'), '')), '');

  if v_raw is null then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create or replace function public.resolve_valid_ghost_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_real uuid;
  v_ghost uuid;
begin
  v_real := public.current_real_session_profile_id();
  v_ghost := public.current_ghost_profile_id_from_header();

  if v_ghost is null or v_real is null then
    return null;
  end if;

  if not public.can_operate_ghost_mode(v_real) then
    return null;
  end if;

  if v_ghost = v_real then
    return null;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_ghost
       and p.membership_out is null
  ) then
    return null;
  end if;

  return v_ghost;
end;
$$;

-- Sessão efetiva = Ghost válido, senão sessão real (token / x-profile-id).
create or replace function public.current_session_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ghost uuid;
begin
  v_ghost := public.resolve_valid_ghost_profile_id();

  if v_ghost is not null then
    return v_ghost;
  end if;

  return public.current_real_session_profile_id();
end;
$$;

create or replace function public.is_ghost_mode_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.resolve_valid_ghost_profile_id() is not null;
$$;

create or replace function public.obter_perfil_sessao_efetiva()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is null then
    return null;
  end if;

  return (
    select to_jsonb(p.*)
      from public.profiles p
     where p.id = v_profile_id
  );
end;
$$;

grant execute on function public.current_ghost_profile_id_from_header() to anon, authenticated;
grant execute on function public.resolve_valid_ghost_profile_id() to anon, authenticated;
grant execute on function public.current_session_profile_id() to anon, authenticated;
grant execute on function public.is_ghost_mode_active() to anon, authenticated;
grant execute on function public.obter_perfil_sessao_efetiva() to anon, authenticated;
