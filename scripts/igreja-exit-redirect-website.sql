-- =============================================================================
-- Site oficial: normaliza URL sem https:// + checkbox "ao sair redireciona"
-- =============================================================================
-- Aplica: npx supabase db query --linked -f scripts/igreja-exit-redirect-website.sql
-- =============================================================================

alter table public.igrejas
  add column if not exists exit_redirect_website boolean not null default false;

comment on column public.igrejas.exit_redirect_website is
  'Se true, ao encerrar sessão o app redireciona para website_url da instância.';

create or replace function public.normalize_optional_https_url(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  v_url text := nullif(trim(coalesce(p_url, '')), '');
begin
  if v_url is null then
    return null;
  end if;

  if v_url ~* '^https?://' then
    return v_url;
  end if;

  if left(v_url, 2) = '//' then
    return 'https:' || v_url;
  end if;

  return 'https://' || v_url;
end;
$$;

create or replace function public.set_igreja_social_links_admin(
  p_tenant_id uuid,
  p_website_url text,
  p_instagram_url text,
  p_youtube_url text,
  p_exit_redirect_website boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_web text := public.normalize_optional_https_url(p_website_url);
  v_ig text := public.normalize_optional_https_url(p_instagram_url);
  v_yt text := public.normalize_optional_https_url(p_youtube_url);
  v_exit boolean;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;

  if p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não informada.');
  end if;

  if v_web is not null and v_web !~* '^https?://[^\s/]+' then
    return jsonb_build_object('success', false, 'message', 'URL do site oficial inválida (use https://...).');
  end if;

  if v_ig is not null and v_ig !~* '^https?://[^\s/]+' then
    return jsonb_build_object('success', false, 'message', 'URL do Instagram inválida (use https://...).');
  end if;

  if v_yt is not null and v_yt !~* '^https?://[^\s/]+' then
    return jsonb_build_object('success', false, 'message', 'URL do YouTube inválida (use https://...).');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  select coalesce(p_exit_redirect_website, i.exit_redirect_website, false)
    into v_exit
    from public.igrejas i
   where i.id = p_tenant_id;

  update public.igrejas
     set website_url = v_web,
         instagram_url = v_ig,
         youtube_url = v_yt,
         exit_redirect_website = coalesce(v_exit, false),
         updated_at = now()
   where id = p_tenant_id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'website_url', v_web,
    'instagram_url', v_ig,
    'youtube_url', v_yt,
    'exit_redirect_website', coalesce(v_exit, false),
    'message', 'Links atualizados.'
  );
end;
$$;

grant execute on function public.set_igreja_social_links_admin(uuid, text, text, text, boolean)
  to authenticated;
grant execute on function public.set_igreja_social_links_admin(uuid, text, text, text)
  to authenticated;

create or replace function public.list_igreja_exit_redirect_admin()
returns table (
  tenant_id uuid,
  exit_redirect_website boolean,
  website_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.profile_has_super_admin_role(v_actor) then
    return;
  end if;

  return query
  select
    i.id,
    coalesce(i.exit_redirect_website, false),
    nullif(trim(i.website_url), '')
  from public.igrejas i
  order by i.name asc;
end;
$$;

grant execute on function public.list_igreja_exit_redirect_admin() to authenticated;

create or replace function public.get_session_exit_website_redirect()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_enabled boolean := false;
  v_url text := null;
begin
  if v_tenant is null then
    return jsonb_build_object('enabled', false, 'website_url', null);
  end if;

  select coalesce(i.exit_redirect_website, false), nullif(trim(i.website_url), '')
    into v_enabled, v_url
    from public.igrejas i
   where i.id = v_tenant;

  if not coalesce(v_enabled, false) or v_url is null then
    return jsonb_build_object('enabled', false, 'website_url', null);
  end if;

  v_url := public.normalize_optional_https_url(v_url);

  return jsonb_build_object(
    'enabled', true,
    'website_url', v_url
  );
end;
$$;

grant execute on function public.get_session_exit_website_redirect() to anon, authenticated;

notify pgrst, 'reload schema';
