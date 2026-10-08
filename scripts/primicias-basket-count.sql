-- Quantidade de cestas da campanha aberta.
-- O cadastro do item continua por cesta; o pedido na doação é quantidade × cestas.

alter table public.primicias_occurrences
  add column if not exists basket_count integer not null default 1;

alter table public.primicias_occurrences
  drop constraint if exists primicias_occurrences_basket_count_check;

alter table public.primicias_occurrences
  add constraint primicias_occurrences_basket_count_check
  check (basket_count >= 1 and basket_count <= 99);

comment on column public.primicias_occurrences.basket_count is
  'Cestas pedidas nesta data. O item cadastrado é a quantidade de uma cesta.';

create or replace function public.primicias_occurrence_json(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_occ public.primicias_occurrences%rowtype;
  v_event public.events%rowtype;
begin
  select * into v_occ
    from public.primicias_occurrences o
   where o.tenant_id = p_tenant
     and o.closed_at is null
   order by o.event_date desc, o.created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  select * into v_event from public.events e where e.id = v_occ.event_id;

  return jsonb_build_object(
    'id', v_occ.id,
    'event_id', v_occ.event_id,
    'event_date', v_occ.event_date,
    'starts_at', v_event.event_date,
    'event_end_date', v_event.event_end_date,
    'event_local', coalesce(nullif(trim(v_event.event_local), ''), 'Campanha Prímicias'),
    'reset_on', (v_occ.event_date + 10),
    'title', public.primicias_event_title(),
    'basket_count', greatest(coalesce(v_occ.basket_count, 1), 1)
  );
end;
$$;

create or replace function public.save_primicias_basket_count(p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_occ public.primicias_occurrences%rowtype;
  v_count integer := p_count;
begin
  if v_me is null or not public.session_can_manage_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para definir as cestas.');
  end if;

  if v_count is null or v_count < 1 or v_count > 99 then
    return jsonb_build_object('success', false, 'message', 'Informe de 1 a 99 cestas.');
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
      'message', 'Grave a data da campanha antes de definir as cestas.'
    );
  end if;

  if exists (
    select 1
      from public.primicias_items i
     where i.tenant_id = v_tenant
       and (
         select coalesce(sum(p.quantity), 0)
           from public.primicias_pledges p
          where p.item_id = i.id
            and p.occurrence_id = v_occ.id
       ) > i.quantity * v_count
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Já há doações acima dessa quantidade de cestas.'
    );
  end if;

  update public.primicias_occurrences
     set basket_count = v_count
   where id = v_occ.id;

  return jsonb_build_object(
    'success', true,
    'basket_count', v_count,
    'message', case
      when v_count = 1 then '1 cesta nesta data.'
      else format('%s cestas nesta data.', v_count)
    end
  );
end;
$$;

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
  v_requested integer := 0;
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

  v_requested := v_item.quantity * greatest(coalesce(v_occ.basket_count, 1), 1);
  v_available := greatest(v_requested - v_taken, 0);

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

grant execute on function public.save_primicias_basket_count(integer) to anon, authenticated;

notify pgrst, 'reload schema';
