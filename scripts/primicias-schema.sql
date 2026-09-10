-- =============================================================================
-- Campanha Prímicias — doações em espécie (quantidade / unidade / nome / peso)
-- Aplica: npx supabase db query --linked -f scripts/primicias-schema.sql
-- =============================================================================

create table if not exists public.primicias_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  category text not null
    check (category in ('alimenticios', 'limpeza_higiene', 'criancas')),
  quantity integer not null
    check (quantity > 0),
  unit text not null,
  product_name text not null,
  weight text not null,
  catalog_key text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint primicias_items_unit_check check (length(trim(unit)) >= 1),
  constraint primicias_items_name_check check (length(trim(product_name)) >= 2),
  constraint primicias_items_weight_check check (length(trim(weight)) >= 1)
);

create unique index if not exists primicias_items_tenant_catalog_uq
  on public.primicias_items (tenant_id, catalog_key)
  where catalog_key is not null;

create index if not exists primicias_items_tenant_cat_idx
  on public.primicias_items (tenant_id, category, sort_order, product_name);

create table if not exists public.primicias_pledges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  item_id uuid not null references public.primicias_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint primicias_pledges_unique unique (item_id, profile_id)
);

create index if not exists primicias_pledges_item_idx
  on public.primicias_pledges (tenant_id, item_id, created_at);

create table if not exists public.primicias_catalog_state (
  tenant_id uuid primary key references public.igrejas (id) on delete cascade,
  seeded_at timestamptz not null default now()
);

comment on table public.primicias_items is
  'Catálogo da campanha Prímicias, isolado por tenant. Campos: quantidade, unidade, nome, peso.';
comment on table public.primicias_pledges is
  'Compromisso de um perfil efetivo (Ghost-aware) com um item. Sem telefone no feed.';
comment on table public.primicias_catalog_state is
  'Marca se a lista padrão já foi aplicada no tenant. Itens excluídos não são recriados.';

alter table public.primicias_items enable row level security;
alter table public.primicias_pledges enable row level security;
alter table public.primicias_catalog_state enable row level security;

drop policy if exists primicias_items_deny_direct on public.primicias_items;
create policy primicias_items_deny_direct
  on public.primicias_items for all using (false) with check (false);

drop policy if exists primicias_pledges_deny_direct on public.primicias_pledges;
create policy primicias_pledges_deny_direct
  on public.primicias_pledges for all using (false) with check (false);

drop policy if exists primicias_catalog_state_deny_direct on public.primicias_catalog_state;
create policy primicias_catalog_state_deny_direct
  on public.primicias_catalog_state for all using (false) with check (false);

revoke all on public.primicias_items from anon, authenticated, public;
revoke all on public.primicias_pledges from anon, authenticated, public;
revoke all on public.primicias_catalog_state from anon, authenticated, public;

create or replace function public.session_can_view_primicias()
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
  return public.profile_has_access(v_me, 'screen', '/primicias', 'view')
      or public.profile_has_access(v_me, 'screen', 'dashboard.card.primicias', 'view');
end;
$$;

create or replace function public.session_can_manage_primicias()
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
  return public.profile_has_access(v_me, 'screen', 'maintenance.card.primicias_management', 'view')
      or public.profile_has_access(v_me, 'screen', 'maintenance.card.primicias_management', 'update');
end;
$$;

create or replace function public.ensure_primicias_defaults(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if exists (
    select 1 from public.primicias_catalog_state s where s.tenant_id = p_tenant
  ) then
    return;
  end if;

  insert into public.primicias_catalog_state (tenant_id) values (p_tenant);

  insert into public.primicias_items (
    tenant_id, category, quantity, unit, product_name, weight, catalog_key, sort_order
  )
  values
    (p_tenant, 'alimenticios', 1, 'pacotes', 'Arroz', '5kg', 'arroz', 10),
    (p_tenant, 'alimenticios', 2, 'pacotes', 'Feijão', '1kg', 'feijao', 20),
    (p_tenant, 'alimenticios', 2, 'unidades', 'Óleo de soja', '900ml', 'oleo', 30),
    (p_tenant, 'alimenticios', 1, 'pacote', 'Sal', '1kg', 'sal', 40),
    (p_tenant, 'alimenticios', 1, 'pacote', 'Açúcar', '2kg', 'acucar', 50),
    (p_tenant, 'alimenticios', 1, 'pacote', 'Café', '500g', 'cafe', 60),
    (p_tenant, 'alimenticios', 2, 'unidades', 'Molho de tomate', '340g', 'molho', 70),
    (p_tenant, 'alimenticios', 2, 'pacotes', 'Macarrão espaguete', '500g', 'macarrao', 80),
    (p_tenant, 'alimenticios', 2, 'latas', 'Sardinha', 'conforme embalagem', 'sardinha', 90),
    (p_tenant, 'alimenticios', 1, 'pacote', 'Fubá', 'conforme embalagem', 'fuba', 100),
    (p_tenant, 'alimenticios', 1, 'pacote', 'Farinha de trigo', 'conforme embalagem', 'trigo', 110),
    (p_tenant, 'alimenticios', 1, 'pacote', 'Biscoito água e sal', '400g', 'biscoito_agua_sal', 120),
    (p_tenant, 'limpeza_higiene', 1, 'pacote', 'Sabão em barra (2 unidades)', 'conforme embalagem', 'sabao_barra', 10),
    (p_tenant, 'limpeza_higiene', 2, 'unidades', 'Sabonete', 'conforme embalagem', 'sabonete', 20),
    (p_tenant, 'limpeza_higiene', 1, 'unidade', 'Detergente', 'conforme embalagem', 'detergente', 30),
    (p_tenant, 'limpeza_higiene', 1, 'unidade', 'Água sanitária', '5L', 'agua_sanitaria', 40),
    (p_tenant, 'limpeza_higiene', 1, 'pacote', 'Papel higiênico (6 rolos)', 'conforme embalagem', 'papel_higienico', 50),
    (p_tenant, 'limpeza_higiene', 2, 'unidades', 'Pasta de dente', '90g', 'pasta_dente', 60),
    (p_tenant, 'criancas', 12, 'caixas', 'Leite integral', '1L', 'leite', 10),
    (p_tenant, 'criancas', 1, 'pote', 'Achocolatado', '400g', 'achocolatado', 20),
    (p_tenant, 'criancas', 2, 'pacotes', 'Biscoito (tipo rosquinha de coco ou recheada)', '400g', 'biscoito_crianca', 30),
    (p_tenant, 'criancas', 2, 'pacotes', 'Pão de forma branco', 'conforme embalagem', 'pao_forma', 40),
    (p_tenant, 'criancas', 1, 'pote', 'Margarina', '500g', 'margarina', 50),
    (p_tenant, 'criancas', 1, 'pacote', 'Aveia em flocos', '200g', 'aveia', 60);
end;
$$;

create or replace function public.primicias_item_json(
  p_item public.primicias_items,
  p_tenant uuid,
  p_me uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  return jsonb_build_object(
    'id', p_item.id,
    'category', p_item.category,
    'quantity', p_item.quantity,
    'unit', p_item.unit,
    'product_name', p_item.product_name,
    'weight', p_item.weight,
    'catalog_key', p_item.catalog_key,
    'sort_order', p_item.sort_order,
    'created_at', p_item.created_at,
    'pledges',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', g.profile_id,
            'name', g.name,
            'is_mine', g.is_mine,
            'created_at', g.created_at
          )
          order by g.created_at
        )
        from (
          select
            pl.profile_id,
            coalesce(nullif(trim(pr.full_name), ''), 'Membro') as name,
            (pl.profile_id = p_me) as is_mine,
            pl.created_at
          from public.primicias_pledges pl
          join public.profiles pr
            on pr.id = pl.profile_id
         where pl.item_id = p_item.id
           and pl.tenant_id = p_tenant
        ) g
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.list_primicias_items()
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
  if v_me is null or not public.session_can_view_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para Prímicias.');
  end if;

  perform public.ensure_primicias_defaults(v_tenant);

  return jsonb_build_object(
    'success', true,
    'can_manage', public.session_can_manage_primicias(),
    'items',
    coalesce(
      (
        select jsonb_agg(
          public.primicias_item_json(i, v_tenant, v_me)
          order by
            case i.category
              when 'alimenticios' then 1
              when 'limpeza_higiene' then 2
              when 'criancas' then 3
              else 9
            end,
            i.sort_order,
            i.product_name
        )
        from public.primicias_items i
       where i.tenant_id = v_tenant
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.toggle_primicias_pledge(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_item public.primicias_items%rowtype;
  v_existed boolean := false;
begin
  if v_me is null or not public.session_can_view_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  select * into v_item
    from public.primicias_items i
   where i.id = p_item_id and i.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Item não encontrado.');
  end if;

  select exists (
    select 1
      from public.primicias_pledges p
     where p.item_id = v_item.id
       and p.profile_id = v_me
       and p.tenant_id = v_tenant
  ) into v_existed;

  if v_existed then
    delete from public.primicias_pledges
     where item_id = v_item.id
       and profile_id = v_me
       and tenant_id = v_tenant;

    return jsonb_build_object(
      'success', true,
      'pledged', false,
      'message', 'Compromisso removido.'
    );
  end if;

  insert into public.primicias_pledges (tenant_id, item_id, profile_id)
  values (v_tenant, v_item.id, v_me);

  return jsonb_build_object(
    'success', true,
    'pledged', true,
    'message', 'Seu nome foi vinculado a este item.'
  );
end;
$$;

create or replace function public.create_primicias_item(
  p_category text,
  p_quantity integer,
  p_unit text,
  p_product_name text,
  p_weight text
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
  v_cat text := lower(trim(coalesce(p_category, '')));
  v_unit text := trim(coalesce(p_unit, ''));
  v_name text := trim(coalesce(p_product_name, ''));
  v_weight text := trim(coalesce(p_weight, ''));
  v_id uuid;
  v_sort integer;
begin
  if v_me is null or not public.session_can_manage_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para cadastrar itens.');
  end if;

  if v_cat not in ('alimenticios', 'limpeza_higiene', 'criancas') then
    return jsonb_build_object('success', false, 'message', 'Selecione a categoria.');
  end if;

  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('success', false, 'message', 'Informe a quantidade.');
  end if;

  if length(v_unit) < 1 then
    return jsonb_build_object('success', false, 'message', 'Informe a unidade de medida.');
  end if;

  if length(v_name) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do produto.');
  end if;

  if length(v_weight) < 1 then
    return jsonb_build_object('success', false, 'message', 'Informe o peso (ou “conforme embalagem”).');
  end if;

  perform public.ensure_primicias_defaults(v_tenant);

  select coalesce(max(i.sort_order), 0) + 10
    into v_sort
    from public.primicias_items i
   where i.tenant_id = v_tenant
     and i.category = v_cat;

  insert into public.primicias_items (
    tenant_id, category, quantity, unit, product_name, weight, sort_order
  ) values (
    v_tenant, v_cat, p_quantity, v_unit, v_name, v_weight, v_sort
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'message', 'Item cadastrado.');
end;
$$;

create or replace function public.delete_primicias_item(p_item_id uuid)
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
  if v_me is null or not public.session_can_manage_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir itens.');
  end if;

  delete from public.primicias_items
   where id = p_item_id
     and tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Item não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Item excluído.');
end;
$$;

grant execute on function public.session_can_view_primicias() to anon, authenticated;
grant execute on function public.session_can_manage_primicias() to anon, authenticated;
grant execute on function public.list_primicias_items() to anon, authenticated;
grant execute on function public.toggle_primicias_pledge(uuid) to anon, authenticated;
grant execute on function public.create_primicias_item(text, integer, text, text, text) to anon, authenticated;
grant execute on function public.delete_primicias_item(uuid) to anon, authenticated;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.primicias',
    'Prímicias',
    'Campanha de doações em espécie.',
    true
  ),
  (
    'screen',
    '/primicias',
    'Tela — Prímicias',
    'Lista de itens e compromisso de doação.',
    true
  ),
  (
    'screen',
    'maintenance.card.primicias_management',
    'Gestão de Prímicias',
    'Cadastrar e excluir itens da campanha Prímicias.',
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
   and res.resource_key in ('dashboard.card.primicias', '/primicias')
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado',
   'secretaria', 'tesoureiro', 'events_admin', 'gestor_controle_acesso', 'family_acceptor'
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
   and res.resource_key = 'maintenance.card.primicias_management'
 where r.code in ('super_admin', 'pastoral', 'lider_geral', 'lider', 'tesoureiro', 'secretaria')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
