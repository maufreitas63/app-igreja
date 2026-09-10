-- =============================================================================
-- Prímicias como evento da agenda + histórico por data + reset D+10
-- Aplica: npx supabase db query --linked -f scripts/primicias-event-history.sql
-- =============================================================================

create table if not exists public.primicias_occurrences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete restrict,
  event_date date not null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint primicias_occurrences_tenant_event_uq unique (tenant_id, event_id)
);

create unique index if not exists primicias_occurrences_open_tenant_uq
  on public.primicias_occurrences (tenant_id)
  where closed_at is null;

create index if not exists primicias_occurrences_tenant_date_idx
  on public.primicias_occurrences (tenant_id, event_date desc);

create table if not exists public.primicias_pledge_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  occurrence_id uuid not null references public.primicias_occurrences (id) on delete restrict,
  event_date date not null,
  profile_id uuid null references public.profiles (id) on delete set null,
  full_name text not null,
  item_id uuid null,
  category text not null,
  quantity integer not null,
  unit text not null,
  product_name text not null,
  weight text not null,
  pledged_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index if not exists primicias_pledge_history_tenant_date_idx
  on public.primicias_pledge_history (tenant_id, event_date desc, full_name);

alter table public.primicias_pledges
  add column if not exists occurrence_id uuid;

alter table public.primicias_occurrences enable row level security;
alter table public.primicias_pledge_history enable row level security;

drop policy if exists primicias_occurrences_deny_direct on public.primicias_occurrences;
create policy primicias_occurrences_deny_direct
  on public.primicias_occurrences for all using (false) with check (false);

drop policy if exists primicias_pledge_history_deny_direct on public.primicias_pledge_history;
create policy primicias_pledge_history_deny_direct
  on public.primicias_pledge_history for all using (false) with check (false);

revoke all on public.primicias_occurrences from anon, authenticated, public;
revoke all on public.primicias_pledge_history from anon, authenticated, public;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'primicias_pledges_occurrence_fk'
  ) then
    alter table public.primicias_pledges
      add constraint primicias_pledges_occurrence_fk
      foreign key (occurrence_id) references public.primicias_occurrences (id) on delete cascade;
  end if;
end
$$;

alter table public.primicias_pledges drop constraint if exists primicias_pledges_unique;

drop index if exists primicias_pledges_occ_item_profile_uq;
create unique index if not exists primicias_pledges_occ_item_profile_uq
  on public.primicias_pledges (occurrence_id, item_id, profile_id)
  where occurrence_id is not null;

create or replace function public.primicias_event_title()
returns text
language sql
immutable
as $$
  select 'Contribuição para Prímicias'::text;
$$;

create or replace function public.primicias_keep_unlocked(p_event_date date)
returns boolean
language sql
stable
as $$
  select p_event_date is not null
     and p_event_date + 10 >= public.app_local_today();
$$;

create or replace function public.open_primicias_occurrence_id(p_tenant uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select o.id
    from public.primicias_occurrences o
   where o.tenant_id = p_tenant
     and o.closed_at is null
   order by o.event_date desc, o.created_at desc
   limit 1;
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
    i.quantity,
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

create or replace function public.close_expired_primicias_occurrences()
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select o.id
      from public.primicias_occurrences o
     where o.closed_at is null
       and o.event_date + 10 < public.app_local_today()
  loop
    perform public.archive_primicias_occurrence(v_row.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
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
           and v_occ is not null
           and pl.occurrence_id = v_occ
        ) g
      ),
      '[]'::jsonb
    )
  );
end;
$$;

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
    'event_end_date', v_event.event_end_date,
    'reset_on', (v_occ.event_date + 10),
    'title', public.primicias_event_title()
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

  perform public.close_expired_primicias_occurrences();
  perform public.ensure_primicias_defaults(v_tenant);

  return jsonb_build_object(
    'success', true,
    'can_manage', public.session_can_manage_primicias(),
    'occurrence', public.primicias_occurrence_json(v_tenant),
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

create or replace function public.sync_primicias_event_registration(
  p_event_id uuid,
  p_profile_id uuid,
  p_register boolean
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_result jsonb;
begin
  if p_event_id is null or p_profile_id is null then
    return;
  end if;

  if p_register then
    v_result := public.register_profile_atomic(p_event_id, p_profile_id);
  else
    v_result := public.unregister_profile_atomic(p_event_id, p_profile_id);
  end if;

  if coalesce(v_result->>'success', '') <> 'true' then
    raise exception '%', coalesce(v_result->>'message', 'Não foi possível atualizar a agenda.');
  end if;
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
  v_occ public.primicias_occurrences%rowtype;
  v_existed boolean := false;
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
       and p.occurrence_id = v_occ.id
  ) into v_existed;

  if v_existed then
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

  insert into public.primicias_pledges (tenant_id, item_id, profile_id, occurrence_id)
  values (v_tenant, v_item.id, v_me, v_occ.id);

  perform public.sync_primicias_event_registration(v_occ.event_id, v_me, true);

  return jsonb_build_object(
    'success', true,
    'pledged', true,
    'message', 'Seu nome foi vinculado a este item e a inscrição entrou na agenda.'
  );
end;
$$;

create or replace function public.save_primicias_event_date(p_event_date date)
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
  v_event_id uuid;
  v_start timestamptz;
  v_end timestamptz;
begin
  if v_me is null or not public.session_can_manage_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para definir a data.');
  end if;

  if p_event_date is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data da campanha.');
  end if;

  perform public.close_expired_primicias_occurrences();

  v_start := ((p_event_date::text || ' 09:00:00')::timestamp at time zone 'America/Sao_Paulo');
  v_end := v_start + interval '1 hour';

  select * into v_occ
    from public.primicias_occurrences o
   where o.tenant_id = v_tenant
     and o.closed_at is null
   order by o.event_date desc
   limit 1;

  if found then
    update public.events
       set name = public.primicias_event_title(),
           event_date = v_start,
           event_end_date = v_end,
           event_local = 'Campanha Prímicias',
           is_locked = false,
           requer_quorum = false,
           totem_ativo = false,
           geofence_ativo = false
     where id = v_occ.event_id;

    update public.primicias_occurrences
       set event_date = p_event_date
     where id = v_occ.id;

    update public.primicias_pledges
       set occurrence_id = v_occ.id
     where tenant_id = v_tenant
       and occurrence_id is null;

    return jsonb_build_object(
      'success', true,
      'event_id', v_occ.event_id,
      'event_date', p_event_date,
      'message', 'Data da campanha atualizada. O compromisso aparece na agenda da família.'
    );
  end if;

  begin
    insert into public.events (
      tenant_id, name, event_date, event_end_date, event_local, max_capacity,
      is_locked, kids_room, teens_room, parm_ofertas, totem_ativo, requer_quorum,
      somente_membros, geofence_ativo, enabled_room_keys
    )
    values (
      v_tenant,
      public.primicias_event_title(),
      v_start,
      v_end,
      'Campanha Prímicias',
      999,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      '{}'::text[]
    )
    returning id into v_event_id;
  exception
    when unique_violation then
      select e.id into v_event_id
        from public.events e
       where e.tenant_id = v_tenant
         and e.name = public.primicias_event_title()
         and e.event_date = v_start
       limit 1;

      if v_event_id is null then
        return jsonb_build_object('success', false, 'message', 'Não foi possível criar o evento da campanha.');
      end if;

      update public.events
         set event_end_date = v_end,
             is_locked = false,
             requer_quorum = false
       where id = v_event_id;
  end;

  insert into public.primicias_occurrences (tenant_id, event_id, event_date)
  values (v_tenant, v_event_id, p_event_date)
  returning * into v_occ;

  update public.primicias_pledges
     set occurrence_id = v_occ.id
   where tenant_id = v_tenant
     and occurrence_id is null;

  return jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'event_date', p_event_date,
    'message', 'Evento da campanha criado na agenda.'
  );
end;
$$;

create or replace function public.list_primicias_history()
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
    return jsonb_build_object('success', false, 'message', 'Sem permissão para ver o histórico.');
  end if;

  perform public.close_expired_primicias_occurrences();

  return jsonb_build_object(
    'success', true,
    'history',
    coalesce(
      (
        select jsonb_agg(day order by day->>'event_date' desc)
        from (
          select jsonb_build_object(
            'event_date', h.event_date,
            'occurrence_id', h.occurrence_id,
            'donors',
            (
              select jsonb_agg(donor order by donor->>'name')
              from (
                select jsonb_build_object(
                  'profile_id', x.profile_id,
                  'name', x.full_name,
                  'items',
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'quantity', i.quantity,
                        'unit', i.unit,
                        'product_name', i.product_name,
                        'weight', i.weight
                      )
                      order by i.product_name
                    )
                    from public.primicias_pledge_history i
                   where i.occurrence_id = h.occurrence_id
                     and i.profile_id is not distinct from x.profile_id
                     and i.full_name = x.full_name
                  )
                ) as donor
                from (
                  select distinct hh.profile_id, hh.full_name
                    from public.primicias_pledge_history hh
                   where hh.occurrence_id = h.occurrence_id
                ) x
              ) donor
            )
          ) as day
          from (
            select distinct hh.occurrence_id, hh.event_date
              from public.primicias_pledge_history hh
             where hh.tenant_id = v_tenant
          ) h
        ) q
      ),
      '[]'::jsonb
    )
  );
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
                'quantity', i.quantity,
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

-- Eventos de Prímicias ficam visíveis na agenda até D+10 (depois o reset trava).
create or replace function public.lock_past_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_today date := public.app_local_today();
begin
  update public.events e
     set is_locked = true
   where e.event_date is not null
     and (
       case pg_typeof(e.event_date)::text
         when 'date' then e.event_date::date < v_today
         when 'timestamp without time zone' then e.event_date::date < v_today
         when 'timestamp with time zone' then
           (e.event_date::timestamptz at time zone 'America/Sao_Paulo')::date < v_today
         else
           public.is_event_date_in_past(e.event_date::text)
       end
     )
     and coalesce(e.is_locked, false) is distinct from true
     and not (
       e.name = public.primicias_event_title()
       and public.primicias_keep_unlocked(public.event_local_date(e.event_date))
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.events_enforce_lock_if_past()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.event_date is not distinct from old.event_date
     and new.is_locked is true then
    return new;
  end if;

  if new.name = public.primicias_event_title()
     and public.primicias_keep_unlocked(public.event_local_date(new.event_date)) then
    return new;
  end if;

  if pg_typeof(new.event_date)::text = 'date' then
    if new.event_date::date < public.app_local_today() then
      new.is_locked := true;
    end if;
  elsif pg_typeof(new.event_date)::text = 'timestamp without time zone' then
    if new.event_date::date < public.app_local_today() then
      new.is_locked := true;
    end if;
  elsif pg_typeof(new.event_date)::text = 'timestamp with time zone' then
    if (new.event_date::timestamptz at time zone 'America/Sao_Paulo')::date < public.app_local_today() then
      new.is_locked := true;
    end if;
  elsif new.event_date is not null
        and public.is_event_date_in_past(new.event_date::text) then
    new.is_locked := true;
  end if;

  return new;
end;
$$;

grant execute on function public.primicias_event_title() to anon, authenticated;
grant execute on function public.list_primicias_items() to anon, authenticated;
grant execute on function public.toggle_primicias_pledge(uuid) to anon, authenticated;
grant execute on function public.save_primicias_event_date(date) to anon, authenticated;
grant execute on function public.list_primicias_history() to anon, authenticated;
grant execute on function public.list_primicias_event_commitments(uuid) to anon, authenticated;
grant execute on function public.close_expired_primicias_occurrences() to anon, authenticated;
grant execute on function public.lock_past_events() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
