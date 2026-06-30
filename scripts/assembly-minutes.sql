-- Atas de assembleias: metadados em tabela + arquivos PDF no Storage.
-- Execute no Supabase após access-control-schema.sql.

-- ---------------------------------------------------------------------------
-- Bucket de storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assembly-minutes',
  'assembly-minutes',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table if not exists public.maintenance_assembly_minutes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  uploaded_by_profile_id uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint maintenance_assembly_minutes_title_check
    check (char_length(trim(title)) > 0),
  constraint maintenance_assembly_minutes_storage_path_unique unique (storage_path)
);

create index if not exists maintenance_assembly_minutes_created_idx
  on public.maintenance_assembly_minutes (created_at desc);

-- ---------------------------------------------------------------------------
-- ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'table',
  'maintenance_assembly_minutes',
  'Tabela — Atas de assembleias',
  'PDFs de atas publicados pelo financeiro e visualizados no card Administrativo.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code in ('super_admin', 'tesoureiro', 'events_admin')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'table'
   and res.resource_key = 'maintenance_assembly_minutes'
 where r.code in ('super_admin', 'tesoureiro', 'events_admin', 'pastoral', 'member', 'congregado')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS tabela
-- ---------------------------------------------------------------------------

alter table public.maintenance_assembly_minutes enable row level security;

drop policy if exists maintenance_assembly_minutes_select on public.maintenance_assembly_minutes;
create policy maintenance_assembly_minutes_select
  on public.maintenance_assembly_minutes
  for select
  to anon, authenticated
  using (
    public.session_has_screen_access('dashboard.card.administrativo', 'view')
    or public.session_has_screen_access('maintenance.card.financials', 'view')
    or public.can_manage_maintenance_support()
  );

drop policy if exists maintenance_assembly_minutes_insert on public.maintenance_assembly_minutes;
create policy maintenance_assembly_minutes_insert
  on public.maintenance_assembly_minutes
  for insert
  to anon, authenticated
  with check (
    public.session_has_screen_access('maintenance.card.financials', 'update')
    or public.can_manage_maintenance_support()
  );

grant select, insert on public.maintenance_assembly_minutes to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS storage
-- ---------------------------------------------------------------------------

drop policy if exists assembly_minutes_storage_select on storage.objects;
create policy assembly_minutes_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('dashboard.card.administrativo', 'view')
      or public.session_has_screen_access('maintenance.card.financials', 'view')
      or public.can_manage_maintenance_support()
    )
  );

drop policy if exists assembly_minutes_storage_insert on storage.objects;
create policy assembly_minutes_storage_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('maintenance.card.financials', 'update')
      or public.can_manage_maintenance_support()
    )
  );

notify pgrst, 'reload schema';
