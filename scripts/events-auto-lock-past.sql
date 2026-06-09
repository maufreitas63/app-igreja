-- Bloqueia automaticamente eventos com data anterior ao dia atual (America/Sao_Paulo).
-- is_locked = true  → oculto no app (rascunho / encerrado)
--
-- Execute no SQL Editor do Supabase (pode reexecutar com segurança).

create or replace function public.app_local_today()
returns date
language sql
stable
as $$
  select (timezone('America/Sao_Paulo', now()))::date;
$$;

-- Converte qualquer event_date (timestamptz / timestamp / date / text) para dia de calendário em SP.
create or replace function public.event_local_date(p_event_date timestamptz)
returns date
language sql
stable
as $$
  select case
    when p_event_date is null then null::date
    else (p_event_date at time zone 'America/Sao_Paulo')::date
  end;
$$;

create or replace function public.event_local_date(p_event_date timestamp without time zone)
returns date
language sql
stable
as $$
  select case
    when p_event_date is null then null::date
    -- timestamp sem fuso: assume horário local da igreja (parede), não UTC
    else p_event_date::date
  end;
$$;

create or replace function public.event_local_date(p_event_date date)
returns date
language sql
stable
as $$
  select p_event_date;
$$;

create or replace function public.event_local_date(p_event_date text)
returns date
language plpgsql
stable
as $$
declare
  v_ts timestamptz;
begin
  if p_event_date is null or btrim(p_event_date) = '' then
    return null;
  end if;

  begin
    v_ts := btrim(p_event_date)::timestamptz;
    return (v_ts at time zone 'America/Sao_Paulo')::date;
  exception
    when others then
      return null;
  end;
end;
$$;

create or replace function public.is_event_date_in_past(p_event_date timestamptz)
returns boolean
language sql
stable
as $$
  select public.event_local_date(p_event_date) is not null
    and public.event_local_date(p_event_date) < public.app_local_today();
$$;

create or replace function public.is_event_date_in_past(p_event_date timestamp without time zone)
returns boolean
language sql
stable
as $$
  select public.event_local_date(p_event_date) is not null
    and public.event_local_date(p_event_date) < public.app_local_today();
$$;

create or replace function public.is_event_date_in_past(p_event_date date)
returns boolean
language sql
stable
as $$
  select p_event_date is not null
    and p_event_date < public.app_local_today();
$$;

create or replace function public.is_event_date_in_past(p_event_date text)
returns boolean
language sql
stable
as $$
  select public.event_local_date(p_event_date) is not null
    and public.event_local_date(p_event_date) < public.app_local_today();
$$;

-- Atualiza em lote eventos passados ainda desbloqueados.
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
     and coalesce(e.is_locked, false) is distinct from true;

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

drop trigger if exists trg_events_enforce_lock_if_past on public.events;

create trigger trg_events_enforce_lock_if_past
before insert or update
on public.events
for each row
execute function public.events_enforce_lock_if_past();

-- Corrige registros já existentes ao aplicar o script.
select public.lock_past_events() as locked_past_events_count;

grant execute on function public.lock_past_events() to anon, authenticated, service_role;
grant execute on function public.app_local_today() to anon, authenticated, service_role;
grant execute on function public.is_event_date_in_past(timestamptz) to anon, authenticated, service_role;
grant execute on function public.is_event_date_in_past(timestamp without time zone) to anon, authenticated, service_role;
grant execute on function public.is_event_date_in_past(date) to anon, authenticated, service_role;
grant execute on function public.is_event_date_in_past(text) to anon, authenticated, service_role;

comment on function public.lock_past_events is
  'Define is_locked=true em eventos com event_date anterior ao dia atual (fuso America/Sao_Paulo).';
