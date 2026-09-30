-- Código visitante (4 dígitos) gerado automaticamente em create/edit de eventos.
-- Check-in de visitantes consome o código do culto ativo (somente leitura na UI).

alter table public.events
  add column if not exists visitor_checkin_code text;

create unique index if not exists events_visitor_checkin_code_tenant_uidx
  on public.events (tenant_id, visitor_checkin_code)
  where visitor_checkin_code is not null
    and length(trim(visitor_checkin_code)) = 4;

create or replace function public.generate_unique_visitor_checkin_code(p_tenant_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempt int := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

    exit when not exists (
      select 1
        from public.events e
       where trim(coalesce(e.visitor_checkin_code, '')) = v_code
         and e.tenant_id is not distinct from p_tenant_id
    );

    if v_attempt >= 40 then
      raise exception 'Não foi possível gerar código único de check-in de visitante.';
    end if;
  end loop;

  return v_code;
end;
$$;

create or replace function public.trg_events_assign_visitor_checkin_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if length(trim(coalesce(new.visitor_checkin_code, ''))) <> 4 then
      new.visitor_checkin_code := public.generate_unique_visitor_checkin_code(new.tenant_id);
    end if;
    return new;
  end if;

  -- UPDATE: garante código; se ausente, gera. Se já existe, mantém (evita quebrar check-ins do dia).
  if length(trim(coalesce(new.visitor_checkin_code, ''))) <> 4 then
    new.visitor_checkin_code := coalesce(
      nullif(trim(coalesce(old.visitor_checkin_code, '')), ''),
      public.generate_unique_visitor_checkin_code(new.tenant_id)
    );
    if length(trim(coalesce(new.visitor_checkin_code, ''))) <> 4 then
      new.visitor_checkin_code := public.generate_unique_visitor_checkin_code(new.tenant_id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_events_assign_visitor_checkin_code on public.events;
create trigger trg_events_assign_visitor_checkin_code
  before insert or update on public.events
  for each row
  execute function public.trg_events_assign_visitor_checkin_code();

-- Backfill eventos sem código
update public.events e
   set visitor_checkin_code = public.generate_unique_visitor_checkin_code(e.tenant_id)
 where length(trim(coalesce(e.visitor_checkin_code, ''))) <> 4;

-- Contexto do culto ativo para o Cadastro Rápido (código somente leitura na UI)
create or replace function public.get_active_visitor_checkin_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_event public.events%rowtype;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
begin
  v_actor := public.assert_visitor_quick_checkin_actor();

  select e.*
    into v_event
    from public.events e
   where coalesce(e.is_locked, false) = false
     and (
       (e.event_date at time zone 'America/Sao_Paulo')::date = v_today
       or (
         e.event_end_date is not null
         and (e.event_date at time zone 'America/Sao_Paulo')::date <= v_today
         and (e.event_end_date at time zone 'America/Sao_Paulo')::date >= v_today
       )
     )
   order by e.event_date asc
   limit 1;

  if v_event.id is null then
    select e.*
      into v_event
      from public.events e
     where coalesce(e.is_locked, false) = false
       and (e.event_date at time zone 'America/Sao_Paulo')::date
           between v_today and (v_today + 1)
     order by e.event_date asc
     limit 1;
  end if;

  if v_event.id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum culto ativo encontrado para check-in de visitantes.'
    );
  end if;

  if length(trim(coalesce(v_event.visitor_checkin_code, ''))) <> 4 then
    update public.events
       set visitor_checkin_code = public.generate_unique_visitor_checkin_code(tenant_id)
     where id = v_event.id
     returning * into v_event;
  end if;

  return jsonb_build_object(
    'success', true,
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'event_date', v_event.event_date,
      'visitor_checkin_code', v_event.visitor_checkin_code
    ),
    'actor_profile_id', v_actor
  );
end;
$$;

grant execute on function public.generate_unique_visitor_checkin_code(uuid) to authenticated;
grant execute on function public.get_active_visitor_checkin_context() to authenticated;
