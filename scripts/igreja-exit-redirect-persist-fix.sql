-- =============================================================================
-- Corrige persistência de exit_redirect_website (overload PostgREST)
-- =============================================================================
-- Havia duas assinaturas de set_igreja_social_links_admin; o save usava a de
-- 4 args e ignorava o switch «Ao sair». Fica uma única função com o 5º parâmetro.
-- Aplica: npx supabase db query --linked -f scripts/igreja-exit-redirect-persist-fix.sql
-- =============================================================================

drop function if exists public.set_igreja_social_links_admin(uuid, text, text, text);
drop function if exists public.set_igreja_social_links_admin(uuid, text, text, text, boolean);

create function public.set_igreja_social_links_admin(
  p_tenant_id uuid,
  p_website_url text,
  p_instagram_url text,
  p_youtube_url text,
  p_exit_redirect_website boolean default false
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
  v_exit boolean := coalesce(p_exit_redirect_website, false);
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

  -- Switch ligado sem URL: não grava redirect (comportamento pedido).
  if v_exit and v_web is null then
    v_exit := false;
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  update public.igrejas
     set website_url = v_web,
         instagram_url = v_ig,
         youtube_url = v_yt,
         exit_redirect_website = v_exit,
         updated_at = now()
   where id = p_tenant_id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'website_url', v_web,
    'instagram_url', v_ig,
    'youtube_url', v_yt,
    'exit_redirect_website', v_exit,
    'message', 'Links atualizados.'
  );
end;
$$;

grant execute on function public.set_igreja_social_links_admin(uuid, text, text, text, boolean)
  to authenticated;

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
    return jsonb_build_object(
      'enabled', false,
      'website_url', null,
      'tenant_id', null
    );
  end if;

  select coalesce(i.exit_redirect_website, false), nullif(trim(i.website_url), '')
    into v_enabled, v_url
    from public.igrejas i
   where i.id = v_tenant;

  v_url := public.normalize_optional_https_url(v_url);

  if not coalesce(v_enabled, false) or v_url is null then
    return jsonb_build_object(
      'enabled', false,
      'website_url', null,
      'tenant_id', v_tenant
    );
  end if;

  return jsonb_build_object(
    'enabled', true,
    'website_url', v_url,
    'tenant_id', v_tenant
  );
end;
$$;

grant execute on function public.get_session_exit_website_redirect() to anon, authenticated;

notify pgrst, 'reload schema';
