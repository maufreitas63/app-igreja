-- Permite dividir um item de Prímicias entre doadores, até a quantidade cadastrada.
-- Aplica: npx supabase db query --linked -f scripts/primicias-pledge-quantity.sql

alter table public.primicias_pledges
  add column if not exists quantity integer;

-- Quem já tinha o item inteiro sozinho continua responsável pela quantidade toda.
update public.primicias_pledges pl
   set quantity = i.quantity
  from public.primicias_items i
 where pl.quantity is null
   and i.id = pl.item_id
   and (
     select count(*)
       from public.primicias_pledges other
      where other.item_id = pl.item_id
        and other.occurrence_id is not distinct from pl.occurrence_id
   ) = 1;

update public.primicias_pledges
   set quantity = 1
 where quantity is null
    or quantity < 1;

alter table public.primicias_pledges
  alter column quantity set default 1;

alter table public.primicias_pledges
  alter column quantity set not null;

alter table public.primicias_pledges
  drop constraint if exists primicias_pledges_quantity_check;

alter table public.primicias_pledges
  add constraint primicias_pledges_quantity_check check (quantity > 0);

comment on column public.primicias_pledges.quantity is
  'Quantidade deste compromisso. A soma por item e ocorrência não passa da quantidade do item.';

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
declare
  v_occ uuid := public.open_primicias_occurrence_id(p_tenant);
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
            'quantity', g.quantity,
            'created_at', g.created_at
          )
          order by g.created_at
        )
        from (
          select
            pl.profile_id,
            coalesce(nullif(trim(pr.full_name), ''), 'Membro') as name,
            (pl.profile_id = p_me) as is_mine,
            greatest(coalesce(pl.quantity, 1), 1) as quantity,
            pl.created_at
          from public.primicias_pledges pl
          join public.profiles pr
            on pr.id = pl.profile_id
         where pl.item_id = p_item.id
           and pl.tenant_id = p_tenant
           and v_occ is not null
           and pl.occurrence_id = v_occ
        ) g
      ),
      '[]'::jsonb
    )
  );
end;
$$;

drop function if exists public.toggle_primicias_pledge(uuid);

create or replace function public.toggle_primicias_pledge(
  p_item_id uuid,
  p_quantity integer default null
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
  v_item public.primicias_items%rowtype;
  v_occ public.primicias_occurrences%rowtype;
  v_mine integer := 0;
  v_taken integer := 0;
  v_available integer := 0;
  v_qty integer := p_quantity;
  v_still_has boolean := false;
begin
  if v_me is null or not public.session_can_view_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  perform public.close_expired_primicias_occurrences();

  select * into v_occ
    from public.primicias_occurrences o
   where o.tenant_id = v_tenant
     and o.closed_at is null
   order by o.event_date desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'A campanha ainda não tem data. Defina a data em Gestão de Prímicias.'
    );
  end if;

  select * into v_item
    from public.primicias_items i
   where i.id = p_item_id
     and i.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Item não encontrado.');
  end if;

  select coalesce(sum(p.quantity), 0)
    into v_mine
    from public.primicias_pledges p
   where p.item_id = v_item.id
     and p.profile_id = v_me
     and p.tenant_id = v_tenant
     and p.occurrence_id = v_occ.id;

  select coalesce(sum(p.quantity), 0)
    into v_taken
    from public.primicias_pledges p
   where p.item_id = v_item.id
     and p.tenant_id = v_tenant
     and p.occurrence_id = v_occ.id
     and p.profile_id <> v_me;

  v_available := greatest(v_item.quantity - v_taken, 0);

  if v_qty is null then
    if v_mine > 0 then
      v_qty := 0;
    else
      v_qty := 1;
    end if;
  end if;

  if v_qty <= 0 then
    if v_mine <= 0 then
      return jsonb_build_object('success', false, 'message', 'Você ainda não se comprometeu com este item.');
    end if;

    delete from public.primicias_pledges
     where item_id = v_item.id
       and profile_id = v_me
       and tenant_id = v_tenant
       and occurrence_id = v_occ.id;

    select exists (
      select 1
        from public.primicias_pledges p
       where p.profile_id = v_me
         and p.tenant_id = v_tenant
         and p.occurrence_id = v_occ.id
    ) into v_still_has;

    if not v_still_has then
      perform public.sync_primicias_event_registration(v_occ.event_id, v_me, false);
    end if;

    return jsonb_build_object(
      'success', true,
      'pledged', false,
      'message', 'Compromisso removido.'
    );
  end if;

  if v_qty > v_available then
    return jsonb_build_object(
      'success', false,
      'message',
      case
        when v_available <= 0 then 'Este item já foi todo doado.'
        else format('O saldo deste item é %s.', v_available)
      end
    );
  end if;

  if v_mine > 0 then
    update public.primicias_pledges
       set quantity = v_qty
     where item_id = v_item.id
       and profile_id = v_me
       and tenant_id = v_tenant
       and occurrence_id = v_occ.id;
  else
    insert into public.primicias_pledges (tenant_id, item_id, profile_id, occurrence_id, quantity)
    values (v_tenant, v_item.id, v_me, v_occ.id, v_qty);
  end if;

  perform public.sync_primicias_event_registration(v_occ.event_id, v_me, true);

  return jsonb_build_object(
    'success', true,
    'pledged', true,
    'quantity', v_qty,
    'message', format('Compromisso de %s %s registrado. A inscrição entrou na agenda.', v_qty, v_item.unit)
  );
end;
$$;

create or replace function public.archive_primicias_occurrence(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.primicias_pledge_history (
    tenant_id, occurrence_id, event_date, profile_id, full_name,
    item_id, category, quantity, unit, product_name, weight, pledged_at
  )
  select
    pl.tenant_id,
    pl.occurrence_id,
    o.event_date,
    pl.profile_id,
    coalesce(nullif(trim(pr.full_name), ''), 'Membro'),
    i.id,
    i.category,
    greatest(coalesce(pl.quantity, 1), 1),
    i.unit,
    i.product_name,
    i.weight,
    pl.created_at
  from public.primicias_pledges pl
  join public.primicias_occurrences o on o.id = pl.occurrence_id
  join public.primicias_items i on i.id = pl.item_id
  join public.profiles pr on pr.id = pl.profile_id
  where pl.occurrence_id = p_occurrence_id;

  delete from public.primicias_pledges
   where occurrence_id = p_occurrence_id;

  update public.primicias_occurrences
     set closed_at = now()
   where id = p_occurrence_id
     and closed_at is null;

  update public.events e
     set is_locked = true
    from public.primicias_occurrences o
   where o.id = p_occurrence_id
     and e.id = o.event_id
     and coalesce(e.is_locked, false) is distinct from true;
end;
$$;

create or replace function public.list_primicias_event_commitments(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_occ uuid;
begin
  if v_me is null or not public.session_can_view_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  perform public.close_expired_primicias_occurrences();

  select o.id into v_occ
    from public.primicias_occurrences o
   where o.tenant_id = v_tenant
     and o.event_id = p_event_id;

  if v_occ is null then
    return jsonb_build_object('success', true, 'is_primicias', false, 'commitments', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'is_primicias', true,
    'title', public.primicias_event_title(),
    'commitments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', g.profile_id,
            'name', g.name,
            'items', g.items
          )
          order by g.name
        )
        from (
          select
            pl.profile_id,
            coalesce(nullif(trim(pr.full_name), ''), 'Membro') as name,
            jsonb_agg(
              jsonb_build_object(
                'quantity', greatest(coalesce(pl.quantity, 1), 1),
                'unit', i.unit,
                'product_name', i.product_name,
                'weight', i.weight
              )
              order by i.product_name
            ) as items
          from public.primicias_pledges pl
          join public.primicias_items i on i.id = pl.item_id
          join public.profiles pr on pr.id = pl.profile_id
         where pl.occurrence_id = v_occ
           and pl.tenant_id = v_tenant
          group by pl.profile_id, pr.full_name
        ) g
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.toggle_primicias_pledge(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
