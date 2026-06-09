-- Cadastro de veiculos (inclui visitantes sem perfil em public.profiles).
--
-- Campos:
-- - phone   -> Telefone de referencia (mesmo formato visual que profiles no app:
--             manage-profile formatPhone: (DD) NNNN-NNNN ou (DD) NNNNN-NNNN)
-- - placa   -> Placa
-- - marca   -> Marca
-- - modelo  -> Modelo
-- - cor     -> Cor
-- - celular -> Celular (contato adicional do veiculo)
--
-- Execute o arquivo inteiro no SQL Editor do Supabase (um unico run).

create extension if not exists pgcrypto;

-- Instalacoes antigas tinham FK para public.profiles(phone). Remover para permitir visitantes.
alter table if exists public.profile_vehicles
  drop constraint if exists profile_vehicles_phone_fkey;

do $$
declare
  v_conname text;
begin
  if to_regclass('public.profile_vehicles') is null then
    return;
  end if;

  for v_conname in
    select c.conname::text
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace nmsp on nmsp.oid = rel.relnamespace
    join pg_class frel on frel.oid = c.confrelid
    join pg_namespace fnmsp on fnmsp.oid = frel.relnamespace
    where nmsp.nspname = 'public'
      and rel.relname = 'profile_vehicles'
      and fnmsp.nspname = 'public'
      and frel.relname = 'profiles'
      and c.contype = 'f'
  loop
    execute format('alter table public.profile_vehicles drop constraint %I', v_conname);
  end loop;
end
$$;

-- Espelha formatPhone em app/manage-profile.tsx e app/manage-members.tsx (apenas digitos -> mascara BR).
create or replace function public.format_phone_like_profiles(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
  n int := length(d);
begin
  if n = 0 then
    return '';
  end if;

  if n <= 2 then
    return d;
  end if;

  if n <= 6 then
    return '(' || substring(d from 1 for 2) || ') ' || substring(d from 3);
  end if;

  if n <= 10 then
    return '(' || substring(d from 1 for 2) || ') ' || substring(d from 3 for 4) || '-' || substring(d from 7);
  end if;

  return '(' || substring(d from 1 for 2) || ') ' || substring(d from 3 for 5) || '-' || substring(d from 8 for 4);
end;
$$;

comment on function public.format_phone_like_profiles(text) is
  'Formata telefone como no cadastro de perfil (app): (DD) NNNN-NNNN ou (DD) NNNNN-NNNN.';

grant execute on function public.format_phone_like_profiles(text) to anon;
grant execute on function public.format_phone_like_profiles(text) to authenticated;

create table if not exists public.profile_vehicles (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  placa text not null,
  marca text,
  modelo text,
  cor text,
  celular text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_vehicles_phone_not_blank check (btrim(phone) <> ''),
  constraint profile_vehicles_placa_not_blank check (btrim(placa) <> ''),
  constraint profile_vehicles_phone_placa_key unique (phone, placa)
);

create index if not exists idx_profile_vehicles_phone
  on public.profile_vehicles (phone);

create index if not exists idx_profile_vehicles_placa
  on public.profile_vehicles (placa);

drop function if exists public.set_updated_at_profile_vehicles() cascade;

create or replace function public.set_updated_at_profile_vehicles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_profile_vehicles on public.profile_vehicles;
create trigger trg_set_updated_at_profile_vehicles
before update on public.profile_vehicles
for each row
execute function public.set_updated_at_profile_vehicles();

drop function if exists public.profile_vehicles_format_phones() cascade;

create or replace function public.profile_vehicles_format_phones()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.format_phone_like_profiles(new.phone);
  if new.celular is null or btrim(new.celular) = '' then
    new.celular := null;
  else
    new.celular := public.format_phone_like_profiles(new.celular);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_vehicles_format_phones on public.profile_vehicles;
create trigger trg_profile_vehicles_format_phones
before insert or update of phone, celular on public.profile_vehicles
for each row
execute function public.profile_vehicles_format_phones();

comment on table public.profile_vehicles is
  'Veiculos cadastrados por telefone, inclusive visitantes sem perfil cadastrado.';

comment on column public.profile_vehicles.phone is
  'Telefone de referencia; mesmo formato visual que profiles.phone no app (manage-profile formatPhone).';

comment on column public.profile_vehicles.placa is 'Placa do veiculo.';
comment on column public.profile_vehicles.marca is 'Marca do veiculo.';
comment on column public.profile_vehicles.modelo is 'Modelo do veiculo.';
comment on column public.profile_vehicles.cor is 'Cor do veiculo.';
comment on column public.profile_vehicles.celular is 'Celular de contato relacionado ao veiculo.';

alter table public.profile_vehicles enable row level security;

drop policy if exists profile_vehicles_select_policy on public.profile_vehicles;
create policy profile_vehicles_select_policy
on public.profile_vehicles
for select
to anon, authenticated
using (true);

drop policy if exists profile_vehicles_insert_policy on public.profile_vehicles;
create policy profile_vehicles_insert_policy
on public.profile_vehicles
for insert
to anon, authenticated
with check (true);

drop policy if exists profile_vehicles_update_policy on public.profile_vehicles;
create policy profile_vehicles_update_policy
on public.profile_vehicles
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists profile_vehicles_delete_policy on public.profile_vehicles;
create policy profile_vehicles_delete_policy
on public.profile_vehicles
for delete
to anon, authenticated
using (true);

grant select, insert, update, delete on public.profile_vehicles to anon;
grant select, insert, update, delete on public.profile_vehicles to authenticated;

-- Reformata linhas ja existentes sem alterar updated_at (idempotente).
alter table public.profile_vehicles disable trigger trg_set_updated_at_profile_vehicles;

update public.profile_vehicles
set
  phone = public.format_phone_like_profiles(phone),
  celular = case
    when celular is null or btrim(celular) = '' then null
    else public.format_phone_like_profiles(celular)
  end;

alter table public.profile_vehicles enable trigger trg_set_updated_at_profile_vehicles;

select
  'public.profile_vehicles OK' as status,
  (select count(*)::bigint from public.profile_vehicles) as total_veiculos;
