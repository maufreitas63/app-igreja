-- =============================================================================
-- Livros doados — catálogo por igreja (ISBN + cadastro manual)
-- =============================================================================
-- Isolamento: tenant_id da sessão (require_session_tenant_id).
-- Sem acesso direto à tabela (RLS deny-all). CRUD só por RPCs SECURITY DEFINER.
-- Aplica: npx supabase db query --linked -f scripts/livros-doados.sql
-- =============================================================================

create table if not exists public.livros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  isbn text null,
  titulo text not null,
  autor text null,
  editora text null,
  ano text null,
  capa text null,
  criado_em timestamptz not null default now(),
  constraint livros_titulo_check check (length(trim(titulo)) >= 1)
);

create index if not exists livros_isbn_idx
  on public.livros (isbn);

create index if not exists livros_tenant_isbn_idx
  on public.livros (tenant_id, isbn);

create index if not exists livros_tenant_criado_idx
  on public.livros (tenant_id, criado_em desc);

comment on table public.livros is
  'Livros doados ao acervo da igreja. Isolado por tenant_id da sessão.';

alter table public.livros enable row level security;

drop policy if exists livros_deny_direct on public.livros;
create policy livros_deny_direct
  on public.livros
  for all
  using (false)
  with check (false);

revoke all on table public.livros from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    '/livros-doados',
    'Livros doados',
    'Cadastro de livros doados com busca ISBN',
    true
  ),
  (
    'table',
    'livros',
    'Livros doados',
    null,
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join (
    values
      ('screen', '/livros-doados'),
      ('table', 'livros')
  ) as g(resource_type, resource_key)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code in ('secretaria', 'gestor_controle_acesso', 'super_admin')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.assert_can_manage_livros(p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, public.current_session_profile_id());
begin
  if v_actor is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  if public.is_super_admin_profile(v_actor) then
    return;
  end if;

  if public.profile_has_role_code(v_actor, 'secretaria')
     or public.profile_has_role_code(v_actor, 'gestor_controle_acesso')
     or public.profile_has_access(v_actor, 'screen', '/livros-doados', 'view') then
    return;
  end if;

  raise exception 'Você não tem permissão para cadastrar livros doados.';
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_livros()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_rows jsonb;
begin
  perform public.assert_can_manage_livros(v_actor);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc), '[]'::jsonb)
    into v_rows
    from (
      select
        l.id,
        l.tenant_id,
        l.isbn,
        l.titulo,
        l.autor,
        l.editora,
        l.ano,
        l.capa,
        l.criado_em
      from public.livros l
      where l.tenant_id = v_tenant
    ) x;

  return jsonb_build_object('success', true, 'rows', v_rows);
end;
$$;

create or replace function public.create_livro(
  p_isbn text default null,
  p_titulo text default null,
  p_autor text default null,
  p_editora text default null,
  p_ano text default null,
  p_capa text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_titulo text := trim(coalesce(p_titulo, ''));
  v_row public.livros;
begin
  perform public.assert_can_manage_livros(v_actor);

  if v_titulo = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o título do livro.');
  end if;

  insert into public.livros (
    tenant_id,
    isbn,
    titulo,
    autor,
    editora,
    ano,
    capa
  )
  values (
    v_tenant,
    nullif(trim(coalesce(p_isbn, '')), ''),
    v_titulo,
    nullif(trim(coalesce(p_autor, '')), ''),
    nullif(trim(coalesce(p_editora, '')), ''),
    nullif(trim(coalesce(p_ano, '')), ''),
    nullif(trim(coalesce(p_capa, '')), '')
  )
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Livro cadastrado.',
    'row', to_jsonb(v_row)
  );
end;
$$;

create or replace function public.delete_livro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  perform public.assert_can_manage_livros(v_actor);

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Livro inválido.');
  end if;

  delete from public.livros
   where id = p_id
     and tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Livro não encontrado nesta igreja.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Livro removido.');
end;
$$;

grant execute on function public.assert_can_manage_livros(uuid) to anon, authenticated;
grant execute on function public.list_livros() to anon, authenticated;
grant execute on function public.create_livro(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_livro(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
