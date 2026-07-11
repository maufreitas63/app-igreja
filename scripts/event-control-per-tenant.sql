-- =============================================================================
-- event_control por tenant (corrige duplicate key event_control_pkey)
-- =============================================================================
-- Causa: PK antiga era id=1 (singleton global). Com multi-tenant o RPC tenta
-- INSERT id=1 para IBEP enquanto IBN já ocupa id=1 → duplicate key.
--
-- Solução: 1 linha por tenant_id (PK em tenant_id).
-- Execute no SQL Editor do Supabase.
-- =============================================================================

-- 1) Garantir coluna tenant_id
alter table public.event_control
  add column if not exists tenant_id uuid references public.igrejas (id) on delete cascade;

-- Preencher tenant_id nulo com o tenant padrão / primeira igreja
update public.event_control ec
   set tenant_id = coalesce(
     public.resolve_default_tenant_id(),
     (select i.id from public.igrejas i order by i.code limit 1)
   )
 where ec.tenant_id is null;

-- 2) Remover PK singleton ANTES de criar linhas por igreja
alter table public.event_control
  drop constraint if exists event_control_singleton;

alter table public.event_control
  drop constraint if exists event_control_pkey;

-- Dedupe por tenant (mantém a mais recente)
with ranked as (
  select
    ctid,
    row_number() over (
      partition by tenant_id
      order by updated_at desc nulls last
    ) as rn
  from public.event_control
  where tenant_id is not null
)
delete from public.event_control ec
 using ranked r
 where ec.ctid = r.ctid
   and r.rn > 1;

-- Remover linhas sem tenant (inválidas)
delete from public.event_control where tenant_id is null;

-- 3) Seed: uma linha por igreja
insert into public.event_control (id, active_route, updated_at, tenant_id)
select 1, '/home', now(), i.id
  from public.igrejas i
 where not exists (
   select 1 from public.event_control ec where ec.tenant_id = i.id
 );

alter table public.event_control
  alter column tenant_id set not null;

update public.event_control set id = 1 where id is distinct from 1;

alter table public.event_control
  add constraint event_control_pkey primary key (tenant_id);

-- 4) RPC upsert por tenant
create or replace function public.atualizar_event_control_rota(
  p_actor_profile_id uuid,
  p_active_route text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_route text;
  v_row public.event_control%rowtype;
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas orquestradores de evento podem alterar a orquestração.'
    );
  end if;

  v_route := lower(trim(coalesce(p_active_route, '')));

  if v_route in ('/ofertas', '/dizimos') then
    v_route := '/ofertas_dizimos';
  end if;

  if v_route not in ('/home', '/ofertas_dizimos', '/avisos', '/ofertas', '/dizimos') then
    return jsonb_build_object('success', false, 'message', 'Rota inválida para orquestração.');
  end if;

  insert into public.event_control as ec (id, active_route, updated_at, tenant_id)
  values (1, v_route, now(), v_tenant)
  on conflict (tenant_id) do update
    set active_route = excluded.active_route,
        updated_at = now(),
        id = 1
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Rota atualizada.',
    'id', v_row.id,
    'active_route', v_row.active_route,
    'updated_at', v_row.updated_at,
    'tenant_id', v_row.tenant_id
  );
end;
$$;

grant execute on function public.atualizar_event_control_rota(uuid, text) to anon, authenticated;

-- 5) RLS: leitura só da instância ativa
alter table public.event_control enable row level security;

drop policy if exists event_control_select_authenticated on public.event_control;
create policy event_control_select_authenticated
  on public.event_control
  for select
  to anon, authenticated
  using (
    public.session_tenant_matches(tenant_id)
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists event_control_update_admin on public.event_control;
create policy event_control_update_admin
  on public.event_control
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists event_control_insert_blocked on public.event_control;
create policy event_control_insert_blocked
  on public.event_control
  for insert
  to authenticated
  with check (false);

notify pgrst, 'reload schema';

select
  'event_control por tenant ok' as status,
  (select count(*) from public.event_control) as rows,
  (select count(distinct tenant_id) from public.event_control) as tenants;
