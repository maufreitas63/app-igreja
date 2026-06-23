-- Locais favoritos para cadastro rápido de eventos (nome, endereço, geo e capacidade).
-- Execute no SQL Editor do Supabase do projeto.

create table if not exists public.event_favorite_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cep text null,
  address text not null default '',
  latitude double precision null,
  longitude double precision null,
  capacity integer not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_favorite_locations_name_check
    check (char_length(trim(name)) > 0),
  constraint event_favorite_locations_capacity_check
    check (capacity > 0),
  constraint event_favorite_locations_latitude_check
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint event_favorite_locations_longitude_check
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  constraint event_favorite_locations_cep_check
    check (cep is null or cep ~ '^\d{5}-\d{3}$')
);

create unique index if not exists event_favorite_locations_name_unique_idx
  on public.event_favorite_locations (lower(trim(name)));

create index if not exists idx_event_favorite_locations_active_sort
  on public.event_favorite_locations (is_active, sort_order, name);

comment on table public.event_favorite_locations is
  'Locais favoritos reutilizáveis no formulário de eventos (local e capacidade).';

create or replace function public.touch_event_favorite_locations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_event_favorite_locations_updated_at on public.event_favorite_locations;

create trigger trg_event_favorite_locations_updated_at
before update on public.event_favorite_locations
for each row
execute function public.touch_event_favorite_locations_updated_at();

alter table public.event_favorite_locations enable row level security;

create or replace function public.session_can_manage_event_favorite_locations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'session_has_resource_access'
    ) then public.session_has_resource_access('table', 'events', 'update')
    else true
  end;
$$;

drop policy if exists event_favorite_locations_select_policy on public.event_favorite_locations;
create policy event_favorite_locations_select_policy
  on public.event_favorite_locations
  for select
  to anon, authenticated
  using (true);

drop policy if exists event_favorite_locations_insert_policy on public.event_favorite_locations;
create policy event_favorite_locations_insert_policy
  on public.event_favorite_locations
  for insert
  to anon, authenticated
  with check (public.session_can_manage_event_favorite_locations());

drop policy if exists event_favorite_locations_update_policy on public.event_favorite_locations;
create policy event_favorite_locations_update_policy
  on public.event_favorite_locations
  for update
  to anon, authenticated
  using (public.session_can_manage_event_favorite_locations())
  with check (public.session_can_manage_event_favorite_locations());

drop policy if exists event_favorite_locations_delete_policy on public.event_favorite_locations;
create policy event_favorite_locations_delete_policy
  on public.event_favorite_locations
  for delete
  to anon, authenticated
  using (public.session_can_manage_event_favorite_locations());

grant select, insert, update, delete on public.event_favorite_locations to anon, authenticated;

-- Exemplo opcional (ajuste endereço e coordenadas da sua igreja).
insert into public.event_favorite_locations (name, address, latitude, longitude, capacity, sort_order)
select 'Templo principal', 'Endereço do templo', null, null, 200, 1
where not exists (
  select 1
  from public.event_favorite_locations existing
  where lower(trim(existing.name)) = lower('Templo principal')
);

notify pgrst, 'reload schema';
