-- Sugestões e Melhorias: central de relacionamento e suporte no Dashboard de Manutenção.
-- Execute no SQL Editor do Supabase após access-control-schema.sql e access-control-table-rls.sql.

-- ---------------------------------------------------------------------------
-- ACL do card
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.card.suggestions_improvements',
    'Manutenção — Sugestões e Melhorias',
    'Central de solicitações, respostas, status, anexos e comunicações com usuários.',
    true
  ),
  (
    'table',
    'maintenance_support_requests',
    'Tabela — Solicitações de suporte',
    'Ocorrências abertas em Sugestões e Melhorias.',
    true
  ),
  (
    'table',
    'maintenance_support_attachments',
    'Tabela — Anexos de suporte',
    'Imagens anexadas às solicitações.',
    true
  ),
  (
    'table',
    'maintenance_support_interactions',
    'Tabela — Histórico de suporte',
    'Interações cronológicas entre usuário, sistema e desenvolvedor.',
    true
  ),
  (
    'table',
    'maintenance_support_communications',
    'Tabela — Comunicações de suporte',
    'Histórico de notificações no app e WhatsApp.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code = 'super_admin'
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.suggestions_improvements'
 where r.code in ('super_admin', 'events_admin', 'pastoral', 'tesoureiro')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code = 'super_admin'
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'table'
   and res.resource_key in (
      'maintenance_support_requests',
      'maintenance_support_attachments',
      'maintenance_support_interactions',
      'maintenance_support_communications'
   )
 where r.code in ('super_admin', 'events_admin', 'pastoral', 'tesoureiro')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Tipos e tabelas
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'maintenance_support_record_type') then
    create type public.maintenance_support_record_type as enum (
      'suggestion',
      'question',
      'comment',
      'incident'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'maintenance_support_status') then
    create type public.maintenance_support_status as enum (
      'received',
      'in_review',
      'in_development',
      'awaiting_validation',
      'completed',
      'not_applicable'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'maintenance_support_actor_role') then
    create type public.maintenance_support_actor_role as enum (
      'user',
      'developer',
      'system'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'maintenance_support_channel') then
    create type public.maintenance_support_channel as enum (
      'app',
      'whatsapp',
      'status',
      'attachment'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'maintenance_support_communication_channel') then
    create type public.maintenance_support_communication_channel as enum (
      'in_app',
      'whatsapp'
    );
  end if;
end $$;

create table if not exists public.maintenance_support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid null references public.profiles (id) on delete set null,
  requester_name text not null,
  requester_phone text null,
  record_type public.maintenance_support_record_type not null,
  description text not null,
  status public.maintenance_support_status not null default 'received',
  developer_action text null,
  developer_guidance text null,
  estimated_completion_date date null,
  responded_at timestamptz null,
  whatsapp_authorized boolean not null default false,
  notify_in_app boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_support_requests_requester_name_check
    check (char_length(trim(requester_name)) > 0),
  constraint maintenance_support_requests_description_check
    check (char_length(trim(description)) > 0)
);

create index if not exists maintenance_support_requests_requester_idx
  on public.maintenance_support_requests (requester_profile_id, created_at desc);

create index if not exists maintenance_support_requests_status_idx
  on public.maintenance_support_requests (status, updated_at desc);

create table if not exists public.maintenance_support_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_support_requests (id) on delete cascade,
  storage_path text not null,
  file_name text null,
  mime_type text null,
  sort_order integer not null default 0,
  uploaded_by_profile_id uuid null references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint maintenance_support_attachments_storage_path_check
    check (char_length(trim(storage_path)) > 0)
);

create index if not exists maintenance_support_attachments_request_idx
  on public.maintenance_support_attachments (request_id, sort_order, created_at);

create table if not exists public.maintenance_support_interactions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_support_requests (id) on delete cascade,
  actor_profile_id uuid null references public.profiles (id) on delete set null,
  actor_name text not null,
  actor_role public.maintenance_support_actor_role not null default 'user',
  channel public.maintenance_support_channel not null default 'app',
  message text not null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  constraint maintenance_support_interactions_actor_name_check
    check (char_length(trim(actor_name)) > 0),
  constraint maintenance_support_interactions_message_check
    check (char_length(trim(message)) > 0)
);

create index if not exists maintenance_support_interactions_request_idx
  on public.maintenance_support_interactions (request_id, created_at);

create table if not exists public.maintenance_support_communications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_support_requests (id) on delete cascade,
  recipient_profile_id uuid null references public.profiles (id) on delete set null,
  channel public.maintenance_support_communication_channel not null,
  subject text null,
  message text not null,
  delivery_status text not null default 'registered',
  authorized boolean not null default true,
  sent_by_profile_id uuid null references public.profiles (id) on delete set null,
  sent_at timestamptz not null default now(),
  constraint maintenance_support_communications_message_check
    check (char_length(trim(message)) > 0)
);

create index if not exists maintenance_support_communications_request_idx
  on public.maintenance_support_communications (request_id, sent_at);

-- ---------------------------------------------------------------------------
-- Atualização automática de updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_maintenance_support_request_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_maintenance_support_requests_touch on public.maintenance_support_requests;
create trigger trg_maintenance_support_requests_touch
before update on public.maintenance_support_requests
for each row execute function public.touch_maintenance_support_request_updated_at();

create or replace function public.touch_maintenance_support_parent_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.maintenance_support_requests
     set updated_at = now()
   where id = coalesce(new.request_id, old.request_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_maintenance_support_attachments_parent_touch
  on public.maintenance_support_attachments;
create trigger trg_maintenance_support_attachments_parent_touch
after insert or update or delete on public.maintenance_support_attachments
for each row execute function public.touch_maintenance_support_parent_request();

drop trigger if exists trg_maintenance_support_interactions_parent_touch
  on public.maintenance_support_interactions;
create trigger trg_maintenance_support_interactions_parent_touch
after insert or update or delete on public.maintenance_support_interactions
for each row execute function public.touch_maintenance_support_parent_request();

drop trigger if exists trg_maintenance_support_communications_parent_touch
  on public.maintenance_support_communications;
create trigger trg_maintenance_support_communications_parent_touch
after insert or update or delete on public.maintenance_support_communications
for each row execute function public.touch_maintenance_support_parent_request();

-- ---------------------------------------------------------------------------
-- Permissões auxiliares
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_maintenance_support()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(public.is_super_admin_profile(public.current_session_profile_id()), false)
    or coalesce(public.session_has_screen_access(
      'maintenance.card.suggestions_improvements',
      'update'
    ), false);
$$;

create or replace function public.can_view_maintenance_support_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.maintenance_support_requests r
     where r.id = p_request_id
       and (
         r.requester_profile_id = public.current_session_profile_id()
         or public.can_manage_maintenance_support()
         or public.session_has_screen_access('maintenance.card.suggestions_improvements', 'view')
       )
  );
$$;

create or replace function public.maintenance_support_request_id_from_storage_path(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v_raw text;
begin
  v_raw := split_part(coalesce(p_name, ''), '/', 2);

  if v_raw = '' then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.maintenance_support_requests enable row level security;
alter table public.maintenance_support_attachments enable row level security;
alter table public.maintenance_support_interactions enable row level security;
alter table public.maintenance_support_communications enable row level security;

drop policy if exists maintenance_support_requests_select on public.maintenance_support_requests;
create policy maintenance_support_requests_select
  on public.maintenance_support_requests
  for select
  to anon, authenticated
  using (
    requester_profile_id = public.current_session_profile_id()
    or public.can_manage_maintenance_support()
    or public.session_has_screen_access('maintenance.card.suggestions_improvements', 'view')
  );

drop policy if exists maintenance_support_requests_insert on public.maintenance_support_requests;
create policy maintenance_support_requests_insert
  on public.maintenance_support_requests
  for insert
  to anon, authenticated
  with check (
    public.current_session_profile_id() is not null
    and (
      requester_profile_id = public.current_session_profile_id()
      or public.can_manage_maintenance_support()
    )
  );

drop policy if exists maintenance_support_requests_update on public.maintenance_support_requests;
create policy maintenance_support_requests_update
  on public.maintenance_support_requests
  for update
  to anon, authenticated
  using (
    requester_profile_id = public.current_session_profile_id()
    or public.can_manage_maintenance_support()
  )
  with check (
    requester_profile_id = public.current_session_profile_id()
    or public.can_manage_maintenance_support()
  );

drop policy if exists maintenance_support_attachments_select on public.maintenance_support_attachments;
create policy maintenance_support_attachments_select
  on public.maintenance_support_attachments
  for select
  to anon, authenticated
  using (public.can_view_maintenance_support_request(request_id));

drop policy if exists maintenance_support_attachments_insert on public.maintenance_support_attachments;
create policy maintenance_support_attachments_insert
  on public.maintenance_support_attachments
  for insert
  to anon, authenticated
  with check (public.can_view_maintenance_support_request(request_id));

drop policy if exists maintenance_support_attachments_update on public.maintenance_support_attachments;
create policy maintenance_support_attachments_update
  on public.maintenance_support_attachments
  for update
  to anon, authenticated
  using (public.can_manage_maintenance_support())
  with check (public.can_manage_maintenance_support());

drop policy if exists maintenance_support_interactions_select on public.maintenance_support_interactions;
create policy maintenance_support_interactions_select
  on public.maintenance_support_interactions
  for select
  to anon, authenticated
  using (public.can_view_maintenance_support_request(request_id));

drop policy if exists maintenance_support_interactions_insert on public.maintenance_support_interactions;
create policy maintenance_support_interactions_insert
  on public.maintenance_support_interactions
  for insert
  to anon, authenticated
  with check (public.can_view_maintenance_support_request(request_id));

drop policy if exists maintenance_support_communications_select on public.maintenance_support_communications;
create policy maintenance_support_communications_select
  on public.maintenance_support_communications
  for select
  to anon, authenticated
  using (public.can_view_maintenance_support_request(request_id));

drop policy if exists maintenance_support_communications_insert on public.maintenance_support_communications;
create policy maintenance_support_communications_insert
  on public.maintenance_support_communications
  for insert
  to anon, authenticated
  with check (public.can_manage_maintenance_support());

grant select, insert, update on public.maintenance_support_requests to anon, authenticated;
grant select, insert, update on public.maintenance_support_attachments to anon, authenticated;
grant select, insert on public.maintenance_support_interactions to anon, authenticated;
grant select, insert on public.maintenance_support_communications to anon, authenticated;
grant execute on function public.can_manage_maintenance_support() to anon, authenticated;
grant execute on function public.can_view_maintenance_support_request(uuid) to anon, authenticated;
grant execute on function public.maintenance_support_request_id_from_storage_path(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado de anexos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-support',
  'maintenance-support',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists maintenance_support_storage_select on storage.objects;
create policy maintenance_support_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'maintenance-support'
    and public.can_view_maintenance_support_request(
      public.maintenance_support_request_id_from_storage_path(name)
    )
  );

drop policy if exists maintenance_support_storage_insert on storage.objects;
create policy maintenance_support_storage_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'maintenance-support'
    and public.can_view_maintenance_support_request(
      public.maintenance_support_request_id_from_storage_path(name)
    )
  );

drop policy if exists maintenance_support_storage_update on storage.objects;
create policy maintenance_support_storage_update
  on storage.objects
  for update
  to anon, authenticated
  using (
    bucket_id = 'maintenance-support'
    and public.can_manage_maintenance_support()
  )
  with check (
    bucket_id = 'maintenance-support'
    and public.can_manage_maintenance_support()
  );

drop policy if exists maintenance_support_storage_delete on storage.objects;
create policy maintenance_support_storage_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'maintenance-support'
    and public.can_manage_maintenance_support()
  );

notify pgrst, 'reload schema';
