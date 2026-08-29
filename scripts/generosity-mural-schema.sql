-- =============================================================================
-- Mural de Generosidade Coletiva — multi-tenant
-- =============================================================================
-- Doações e pedidos de empréstimo, sempre com moderação prévia.
-- Contatos não são expostos no feed; o interesse gera aviso interno.
-- tenant_id sempre da sessão (require_session_tenant_id).
-- Aplica: npx supabase db query --linked -f scripts/generosity-mural-schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.generosity_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null
    check (tipo in ('doacao', 'pedido')),
  categoria text not null
    check (categoria in ('moveis', 'saude_equipamentos', 'vestuario', 'livros', 'outros')),
  titulo text not null,
  descricao text not null default '',
  foto_url text null,
  status text not null default 'pendente'
    check (status in ('pendente', 'ativo', 'concluido', 'rejeitado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  moderated_at timestamptz null,
  moderated_by uuid null references public.profiles (id) on delete set null,
  constraint generosity_posts_titulo_check check (length(trim(titulo)) >= 2),
  constraint generosity_posts_descricao_check check (length(trim(descricao)) >= 4)
);

create index if not exists generosity_posts_tenant_status_idx
  on public.generosity_posts (tenant_id, status, created_at desc);

create index if not exists generosity_posts_author_idx
  on public.generosity_posts (tenant_id, user_id, created_at desc);

comment on table public.generosity_posts is
  'Anúncios do mural de generosidade. Isolado por tenant_id. Nada vai ao ar sem moderação.';
comment on column public.generosity_posts.user_id is
  'Autor = profiles.id da sessão efetiva.';
comment on column public.generosity_posts.foto_url is
  'Caminho no bucket generosity-media ({tenant_id}/{post_id}/arquivo).';

create table if not exists public.generosity_interests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  post_id uuid not null references public.generosity_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz null,
  constraint generosity_interests_unique unique (post_id, user_id)
);

create index if not exists generosity_interests_post_idx
  on public.generosity_interests (tenant_id, post_id, status);

comment on table public.generosity_interests is
  'Interesse em doar/atender. Sem telefone no feed; ponte pela liderança.';

create table if not exists public.generosity_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid null references public.generosity_posts (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists generosity_notices_unread_idx
  on public.generosity_notices (tenant_id, profile_id, created_at desc)
  where read_at is null;

alter table public.generosity_posts enable row level security;
alter table public.generosity_interests enable row level security;
alter table public.generosity_notices enable row level security;

drop policy if exists generosity_posts_deny_direct on public.generosity_posts;
create policy generosity_posts_deny_direct
  on public.generosity_posts for all using (false) with check (false);

drop policy if exists generosity_interests_deny_direct on public.generosity_interests;
create policy generosity_interests_deny_direct
  on public.generosity_interests for all using (false) with check (false);

drop policy if exists generosity_notices_deny_direct on public.generosity_notices;
create policy generosity_notices_deny_direct
  on public.generosity_notices for all using (false) with check (false);

revoke all on public.generosity_posts from anon, authenticated, public;
revoke all on public.generosity_interests from anon, authenticated, public;
revoke all on public.generosity_notices from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2) Helpers de sessão
-- ---------------------------------------------------------------------------

create or replace function public.session_can_view_generosity_mural()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_me) then
    return true;
  end if;
  return public.profile_has_access(v_me, 'screen', 'dashboard.card.generosity', 'view')
      or public.profile_has_access(v_me, 'screen', '/mural-generosidade', 'view');
end;
$$;

create or replace function public.session_can_moderate_generosity()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_me) then
    return true;
  end if;
  return public.profile_has_access(v_me, 'screen', 'maintenance.card.generosity_moderation', 'view')
      or public.profile_has_access(v_me, 'screen', 'maintenance.card.generosity_moderation', 'update')
      or public.profile_has_role_code(v_me, 'pastoral');
end;
$$;

create or replace function public.generosity_first_name(p_full_name text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(split_part(trim(coalesce(p_full_name, '')), ' ', 1), ''), 'Irmão');
$$;

-- ---------------------------------------------------------------------------
-- 3) Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generosity-media',
  'generosity-media',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_generosity_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_path_tenant text;
begin
  if v_tenant is null or v_me is null or coalesce(trim(p_name), '') = '' then
    return false;
  end if;

  v_path_tenant := split_part(p_name, '/', 1);
  if v_path_tenant is distinct from v_tenant::text then
    return false;
  end if;

  if public.session_can_moderate_generosity() then
    return true;
  end if;

  if not public.session_can_view_generosity_mural() then
    return false;
  end if;

  return exists (
    select 1
      from public.generosity_posts p
     where p.tenant_id = v_tenant
       and p.foto_url = p_name
       and (
         p.status = 'ativo'
         or p.user_id = v_me
       )
  );
end;
$$;

create or replace function public.can_write_generosity_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_path_tenant text;
  v_post_id uuid;
begin
  if v_tenant is null or v_me is null or coalesce(trim(p_name), '') = '' then
    return false;
  end if;

  v_path_tenant := split_part(p_name, '/', 1);
  if v_path_tenant is distinct from v_tenant::text then
    return false;
  end if;

  begin
    v_post_id := nullif(split_part(p_name, '/', 2), '')::uuid;
  exception
    when others then
      return false;
  end;

  if v_post_id is null then
    return false;
  end if;

  if public.session_can_moderate_generosity() then
    return exists (
      select 1 from public.generosity_posts p
       where p.id = v_post_id and p.tenant_id = v_tenant
    );
  end if;

  return exists (
    select 1
      from public.generosity_posts p
     where p.id = v_post_id
       and p.tenant_id = v_tenant
       and p.user_id = v_me
       and p.status in ('pendente', 'ativo')
  );
end;
$$;

drop policy if exists generosity_media_select on storage.objects;
create policy generosity_media_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'generosity-media'
    and public.can_read_generosity_storage_object(name)
  );

drop policy if exists generosity_media_insert on storage.objects;
create policy generosity_media_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'generosity-media'
    and public.can_write_generosity_storage_object(name)
  );

drop policy if exists generosity_media_update on storage.objects;
create policy generosity_media_update
  on storage.objects
  for update
  to anon, authenticated
  using (
    bucket_id = 'generosity-media'
    and public.can_write_generosity_storage_object(name)
  )
  with check (
    bucket_id = 'generosity-media'
    and public.can_write_generosity_storage_object(name)
  );

drop policy if exists generosity_media_delete on storage.objects;
create policy generosity_media_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'generosity-media'
    and public.can_write_generosity_storage_object(name)
  );

-- ---------------------------------------------------------------------------
-- 4) RPCs do membro
-- ---------------------------------------------------------------------------

create or replace function public.list_generosity_posts(p_tipo text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_tipo text := nullif(lower(trim(coalesce(p_tipo, ''))), '');
begin
  if v_me is null or not public.session_can_view_generosity_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para o mural.');
  end if;

  if v_tipo is not null and v_tipo not in ('doacao', 'pedido') then
    v_tipo := null;
  end if;

  return jsonb_build_object(
    'success', true,
    'posts',
    coalesce(
      (
        select jsonb_agg(q.item order by q.created_at desc)
        from (
          select
            jsonb_build_object(
              'id', p.id,
              'tipo', p.tipo,
              'categoria', p.categoria,
              'titulo', p.titulo,
              'descricao', p.descricao,
              'foto_url', p.foto_url,
              'status', p.status,
              'created_at', p.created_at,
              'is_mine', (p.user_id = v_me),
              'my_interest', i.status
            ) as item,
            p.created_at
          from public.generosity_posts p
          left join public.generosity_interests i
            on i.post_id = p.id
           and i.user_id = v_me
           and i.tenant_id = v_tenant
         where p.tenant_id = v_tenant
           and p.status = 'ativo'
           and (v_tipo is null or p.tipo = v_tipo)
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.create_generosity_post(
  p_tipo text,
  p_categoria text,
  p_titulo text,
  p_descricao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_tipo text := lower(trim(coalesce(p_tipo, '')));
  v_cat text := lower(trim(coalesce(p_categoria, '')));
  v_titulo text := trim(coalesce(p_titulo, ''));
  v_desc text := trim(coalesce(p_descricao, ''));
  v_id uuid;
begin
  if v_me is null or not public.session_can_view_generosity_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para publicar.');
  end if;

  if v_tipo not in ('doacao', 'pedido') then
    return jsonb_build_object('success', false, 'message', 'Informe se é doação ou pedido.');
  end if;

  if v_cat not in ('moveis', 'saude_equipamentos', 'vestuario', 'livros', 'outros') then
    return jsonb_build_object('success', false, 'message', 'Selecione uma categoria.');
  end if;

  if length(v_titulo) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe um título.');
  end if;

  if length(v_desc) < 4 then
    return jsonb_build_object('success', false, 'message', 'Descreva o item com um pouco mais de detalhe.');
  end if;

  insert into public.generosity_posts (
    tenant_id, user_id, tipo, categoria, titulo, descricao, status
  ) values (
    v_tenant, v_me, v_tipo, v_cat, v_titulo, v_desc, 'pendente'
  )
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'message', 'Enviado para moderação. A liderança avalia antes de publicar.'
  );
end;
$$;

create or replace function public.set_generosity_post_photo(p_post_id uuid, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_path text := nullif(trim(coalesce(p_path, '')), '');
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if p_post_id is null or v_path is null then
    return jsonb_build_object('success', false, 'message', 'Foto inválida.');
  end if;

  if split_part(v_path, '/', 1) is distinct from v_tenant::text
     or split_part(v_path, '/', 2) is distinct from p_post_id::text then
    return jsonb_build_object('success', false, 'message', 'Caminho da foto não pertence a este anúncio.');
  end if;

  update public.generosity_posts
     set foto_url = v_path,
         updated_at = now()
   where id = p_post_id
     and tenant_id = v_tenant
     and user_id = v_me
     and status in ('pendente', 'ativo');

  if not found then
    return jsonb_build_object('success', false, 'message', 'Não foi possível anexar a foto.');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.express_generosity_interest(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_post public.generosity_posts%rowtype;
  v_label text;
begin
  if v_me is null or not public.session_can_view_generosity_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  select * into v_post
    from public.generosity_posts p
   where p.id = p_post_id and p.tenant_id = v_tenant;

  if not found or v_post.status is distinct from 'ativo' then
    return jsonb_build_object('success', false, 'message', 'Este anúncio não está disponível.');
  end if;

  if v_post.user_id = v_me then
    return jsonb_build_object('success', false, 'message', 'Este anúncio é seu.');
  end if;

  if exists (
    select 1
      from public.generosity_interests i
     where i.post_id = v_post.id
       and i.user_id = v_me
       and i.tenant_id = v_tenant
  ) then
    return jsonb_build_object(
      'success', true,
      'message', 'Seu interesse já estava registrado. A liderança fará a ponte.'
    );
  end if;

  insert into public.generosity_interests (tenant_id, post_id, user_id, status)
  values (v_tenant, v_post.id, v_me, 'pendente');

  v_label := case when v_post.tipo = 'doacao' then 'doação' else 'pedido' end;

  insert into public.generosity_notices (tenant_id, profile_id, post_id, title, body)
  values (
    v_tenant,
    v_post.user_id,
    v_post.id,
    'Interesse no mural',
    'Alguém da comunidade demonstrou interesse no seu anúncio de '
      || v_label || ': "' || v_post.titulo
      || '". A liderança fará a ponte sem expor telefones no mural.'
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Interesse registrado. A liderança faz o contato com segurança, sem expor seu telefone.'
  );
end;
$$;

create or replace function public.list_my_generosity_posts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null or not public.session_can_view_generosity_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  return jsonb_build_object(
    'success', true,
    'posts',
    coalesce(
      (
        select jsonb_agg(q.item order by q.created_at desc)
        from (
          select
            jsonb_build_object(
              'id', p.id,
              'tipo', p.tipo,
              'categoria', p.categoria,
              'titulo', p.titulo,
              'descricao', p.descricao,
              'foto_url', p.foto_url,
              'status', p.status,
              'created_at', p.created_at,
              'interests_count', (
                select count(*)::int
                  from public.generosity_interests i
                 where i.post_id = p.id and i.tenant_id = v_tenant
              )
            ) as item,
            p.created_at
          from public.generosity_posts p
         where p.tenant_id = v_tenant
           and p.user_id = v_me
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.complete_generosity_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  update public.generosity_posts
     set status = 'concluido',
         updated_at = now()
   where id = p_post_id
     and tenant_id = v_tenant
     and status in ('ativo', 'pendente')
     and (
       user_id = v_me
       or public.session_can_moderate_generosity()
     );

  if not found then
    return jsonb_build_object('success', false, 'message', 'Não foi possível encerrar este anúncio.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Anúncio marcado como resolvido.');
end;
$$;

create or replace function public.list_unread_generosity_notices()
returns table (
  id uuid,
  post_id uuid,
  title text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return;
  end if;

  return query
  select n.id, n.post_id, n.title, n.body, n.created_at
    from public.generosity_notices n
   where n.tenant_id = v_tenant
     and n.profile_id = v_me
     and n.read_at is null
   order by n.created_at desc
   limit 30;
end;
$$;

create or replace function public.mark_generosity_notices_read()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('success', false);
  end if;

  update public.generosity_notices
     set read_at = now()
   where tenant_id = v_tenant
     and profile_id = v_me
     and read_at is null;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPCs de moderação
-- ---------------------------------------------------------------------------

create or replace function public.list_generosity_moderation_queue(p_status text default 'pendente')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_status text := lower(trim(coalesce(p_status, 'pendente')));
begin
  if not public.session_can_moderate_generosity() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para moderar o mural.');
  end if;

  if v_status not in ('pendente', 'ativo', 'concluido', 'rejeitado', 'todos') then
    v_status := 'pendente';
  end if;

  return jsonb_build_object(
    'success', true,
    'posts',
    coalesce(
      (
        select jsonb_agg(q.item order by q.created_at desc)
        from (
          select
            jsonb_build_object(
              'id', p.id,
              'tipo', p.tipo,
              'categoria', p.categoria,
              'titulo', p.titulo,
              'descricao', p.descricao,
              'foto_url', p.foto_url,
              'status', p.status,
              'created_at', p.created_at,
              'author_name', coalesce(nullif(trim(pr.full_name), ''), 'Membro'),
              'author_phone', pr.phone,
              'interests_count', (
                select count(*)::int
                  from public.generosity_interests i
                 where i.post_id = p.id and i.tenant_id = v_tenant
              )
            ) as item,
            p.created_at
          from public.generosity_posts p
          join public.profiles pr
            on pr.id = p.user_id
           and pr.tenant_id = v_tenant
         where p.tenant_id = v_tenant
           and (v_status = 'todos' or p.status = v_status)
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.moderate_generosity_post(p_post_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_action text := lower(trim(coalesce(p_action, '')));
  v_next text;
  v_post public.generosity_posts%rowtype;
begin
  if v_me is null or not public.session_can_moderate_generosity() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para moderar.');
  end if;

  if v_action not in ('aprovar', 'rejeitar', 'concluir') then
    return jsonb_build_object('success', false, 'message', 'Ação inválida.');
  end if;

  v_next := case v_action
    when 'aprovar' then 'ativo'
    when 'rejeitar' then 'rejeitado'
    else 'concluido'
  end;

  select * into v_post
    from public.generosity_posts p
   where p.id = p_post_id and p.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Anúncio não encontrado.');
  end if;

  if v_action = 'aprovar' and v_post.status is distinct from 'pendente' then
    return jsonb_build_object('success', false, 'message', 'Só é possível aprovar anúncios pendentes.');
  end if;

  update public.generosity_posts
     set status = v_next,
         updated_at = now(),
         moderated_at = now(),
         moderated_by = v_me
   where id = v_post.id
     and tenant_id = v_tenant;

  if v_action = 'aprovar' then
    insert into public.generosity_notices (tenant_id, profile_id, post_id, title, body)
    values (
      v_tenant,
      v_post.user_id,
      v_post.id,
      'Anúncio publicado',
      'Seu anúncio "' || v_post.titulo || '" foi aprovado e já aparece no Mural de Generosidade.'
    );
  elsif v_action = 'rejeitar' then
    insert into public.generosity_notices (tenant_id, profile_id, post_id, title, body)
    values (
      v_tenant,
      v_post.user_id,
      v_post.id,
      'Anúncio não publicado',
      'A liderança não publicou o anúncio "' || v_post.titulo || '". Você pode enviar outro com mais detalhes.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    case v_action
      when 'aprovar' then 'Anúncio publicado no mural.'
      when 'rejeitar' then 'Anúncio rejeitado.'
      else 'Anúncio marcado como resolvido.'
    end
  );
end;
$$;

create or replace function public.list_generosity_interests_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_can_moderate_generosity() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  return jsonb_build_object(
    'success', true,
    'interests',
    coalesce(
      (
        select jsonb_agg(q.item order by q.created_at desc)
        from (
          select
            jsonb_build_object(
              'id', i.id,
              'post_id', i.post_id,
              'post_titulo', p.titulo,
              'post_tipo', p.tipo,
              'status', i.status,
              'created_at', i.created_at,
              'author_name', coalesce(nullif(trim(a.full_name), ''), 'Autor'),
              'author_phone', a.phone,
              'interested_name', coalesce(nullif(trim(m.full_name), ''), 'Membro'),
              'interested_phone', m.phone
            ) as item,
            i.created_at
          from public.generosity_interests i
          join public.generosity_posts p
            on p.id = i.post_id and p.tenant_id = i.tenant_id
          join public.profiles a
            on a.id = p.user_id and a.tenant_id = i.tenant_id
          join public.profiles m
            on m.id = i.user_id and m.tenant_id = i.tenant_id
         where i.tenant_id = v_tenant
           and i.status = 'pendente'
           and p.status = 'ativo'
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.accept_generosity_interest(p_interest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_row public.generosity_interests%rowtype;
  v_titulo text;
begin
  if v_me is null or not public.session_can_moderate_generosity() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para mediar o contato.');
  end if;

  select * into v_row
    from public.generosity_interests i
   where i.id = p_interest_id and i.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Interesse não encontrado.');
  end if;

  if v_row.status is distinct from 'pendente' then
    return jsonb_build_object('success', true, 'message', 'Já estava aceito.');
  end if;

  update public.generosity_interests
     set status = 'aceito',
         accepted_at = now()
   where id = v_row.id
     and tenant_id = v_tenant;

  select p.titulo into v_titulo
    from public.generosity_posts p
   where p.id = v_row.post_id and p.tenant_id = v_tenant;

  insert into public.generosity_notices (tenant_id, profile_id, post_id, title, body)
  values (
    v_tenant,
    v_row.user_id,
    v_row.post_id,
    'Contato em andamento',
    'A liderança recebeu seu interesse no anúncio "'
      || coalesce(v_titulo, 'do mural')
      || '" e fará a ponte com a outra parte.'
  );

  return jsonb_build_object('success', true, 'message', 'Interesse aceito. Faça a ponte com os dois lados.');
end;
$$;

grant execute on function public.session_can_view_generosity_mural() to anon, authenticated;
grant execute on function public.session_can_moderate_generosity() to anon, authenticated;
grant execute on function public.list_generosity_posts(text) to anon, authenticated;
grant execute on function public.create_generosity_post(text, text, text, text) to anon, authenticated;
grant execute on function public.set_generosity_post_photo(uuid, text) to anon, authenticated;
grant execute on function public.express_generosity_interest(uuid) to anon, authenticated;
grant execute on function public.list_my_generosity_posts() to anon, authenticated;
grant execute on function public.complete_generosity_post(uuid) to anon, authenticated;
grant execute on function public.list_unread_generosity_notices() to anon, authenticated;
grant execute on function public.mark_generosity_notices_read() to anon, authenticated;
grant execute on function public.list_generosity_moderation_queue(text) to anon, authenticated;
grant execute on function public.moderate_generosity_post(uuid, text) to anon, authenticated;
grant execute on function public.list_generosity_interests_admin() to anon, authenticated;
grant execute on function public.accept_generosity_interest(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.generosity',
    'Mural de Generosidade',
    'Doações e pedidos de empréstimo da comunidade, com moderação.',
    true
  ),
  (
    'screen',
    '/mural-generosidade',
    'Tela — Mural de Generosidade',
    'Feed e publicação de doações e pedidos.',
    true
  ),
  (
    'screen',
    'maintenance.card.generosity_moderation',
    'Moderação do Mural',
    'Aprovar, rejeitar e mediar anúncios de generosidade.',
    true
  ),
  (
    'table',
    'generosity_posts',
    'Anúncios de generosidade',
    null,
    true
  ),
  (
    'table',
    'generosity_interests',
    'Interesses do mural de generosidade',
    null,
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code in ('super_admin', 'member')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key in ('dashboard.card.generosity', '/mural-generosidade')
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado',
   'tesoureiro', 'events_admin', 'gestor_controle_acesso', 'family_acceptor'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.generosity_moderation'
 where r.code in ('super_admin', 'pastoral', 'lider_geral', 'lider')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
