-- =============================================================================
-- Multi-tenancy 14 — links sociais (Instagram / YouTube) por igreja
-- =============================================================================
-- Pré-requisitos: multi-tenant-11 (list_session_igrejas com logo_url).
-- Execute no SQL Editor do Supabase.
-- =============================================================================

begin;

alter table public.igrejas
  add column if not exists instagram_url text;

alter table public.igrejas
  add column if not exists youtube_url text;

comment on column public.igrejas.instagram_url is
  'URL pública do Instagram da instância (menu Redes Sociais).';

comment on column public.igrejas.youtube_url is
  'URL pública do YouTube da instância (menu Redes Sociais).';

-- Seed IBN com os links que estavam fixos no login
update public.igrejas
   set instagram_url = coalesce(nullif(trim(instagram_url), ''), 'https://www.instagram.com/igrejabatistanorte'),
       youtube_url = coalesce(nullif(trim(youtube_url), ''), 'https://www.youtube.com/@ibnorte')
 where upper(trim(code)) = 'IBN';

drop function if exists public.list_session_igrejas();

create or replace function public.list_session_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  logo_url text,
  instagram_url text,
  youtube_url text,
  is_primary boolean,
  is_linked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_is_super boolean := false;
begin
  if v_profile_id is null then
    return;
  end if;

  v_is_super := public.profile_has_super_admin_role(v_profile_id);

  if v_is_super then
    return query
    select
      i.id,
      i.code,
      i.name,
      nullif(trim(i.logo_url), '') as logo_url,
      nullif(trim(i.instagram_url), '') as instagram_url,
      nullif(trim(i.youtube_url), '') as youtube_url,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked
    from public.igrejas i
    left join public.profile_igreja_vinculos v
      on v.tenant_id = i.id
     and v.profile_id = v_profile_id
     and v.is_active = true
    where i.is_active = true
    order by coalesce(v.is_primary, false) desc, i.name asc;
    return;
  end if;

  return query
  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.logo_url), '') as logo_url,
    nullif(trim(i.instagram_url), '') as instagram_url,
    nullif(trim(i.youtube_url), '') as youtube_url,
    v.is_primary,
    true as is_linked
  from public.profile_igreja_vinculos v
  join public.igrejas i on i.id = v.tenant_id
  where v.profile_id = v_profile_id
    and v.is_active = true
    and i.is_active = true
  order by v.is_primary desc, i.name asc;
end;
$$;

grant execute on function public.list_session_igrejas() to anon, authenticated;

create or replace function public.set_igreja_social_links_admin(
  p_tenant_id uuid,
  p_instagram_url text,
  p_youtube_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_ig text := nullif(trim(coalesce(p_instagram_url, '')), '');
  v_yt text := nullif(trim(coalesce(p_youtube_url, '')), '');
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

  if v_ig is not null and v_ig !~* '^https?://' then
    return jsonb_build_object('success', false, 'message', 'URL do Instagram inválida (use https://...).');
  end if;

  if v_yt is not null and v_yt !~* '^https?://' then
    return jsonb_build_object('success', false, 'message', 'URL do YouTube inválida (use https://...).');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  update public.igrejas
     set instagram_url = v_ig,
         youtube_url = v_yt,
         updated_at = now()
   where id = p_tenant_id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'instagram_url', v_ig,
    'youtube_url', v_yt,
    'message', 'Links sociais atualizados.'
  );
end;
$$;

grant execute on function public.set_igreja_social_links_admin(uuid, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
