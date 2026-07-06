-- Parte 2/5 — emissão, validação e sessão atual (aguarde ~30s antes da parte 3)

create or replace function public.issue_profile_session(
  p_profile_id uuid,
  p_ttl interval default interval '30 days'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_profile_id) then
    raise exception 'Perfil não encontrado.';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.profile_sessions (profile_id, token, expires_at)
  values (p_profile_id, v_token, now() + coalesce(p_ttl, interval '30 days'));

  return v_token;
end;
$$;

create or replace function public.resolve_profile_session_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ps.profile_id
    from public.profile_sessions ps
   where ps.token = nullif(trim(coalesce(p_token, '')), '')
     and ps.revoked_at is null
     and ps.expires_at > now()
   limit 1;
$$;

create or replace function public.revoke_profile_session(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.profile_sessions ps
     set revoked_at = now()
   where ps.token = nullif(trim(coalesce(p_token, '')), '')
     and ps.revoked_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.current_session_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_token text;
  v_raw text;
  v_profile_id uuid;
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

  v_token := nullif(trim(coalesce((v_headers::json ->> 'x-session-token'), '')), '');

  if v_token is not null then
    v_profile_id := public.resolve_profile_session_token(v_token);

    if v_profile_id is not null then
      return v_profile_id;
    end if;

    return null;
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-profile-id'), '')), '');

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

grant execute on function public.issue_profile_session(uuid, interval) to anon, authenticated;
grant execute on function public.resolve_profile_session_token(text) to anon, authenticated;
grant execute on function public.revoke_profile_session(text) to anon, authenticated;
grant execute on function public.current_session_profile_id() to anon, authenticated;
