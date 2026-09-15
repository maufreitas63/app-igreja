-- Funil Kanban de Indicados (Governança e TI): fases sequenciais, auditoria,
-- automações on_phase_enter e acesso exclusivo do Super Administrador.
-- Execute: npx supabase db query --linked -f scripts/alianca-indicados-kanban.sql

begin;

-- ---------------------------------------------------------------------------
-- Recursos ACL: só Super Admin. Gestor não concede nem vê estes atalhos.
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- ---------------------------------------------------------------------------

create or replace function public.is_alianca_indicados_access_resource(
  p_resource_type text,
  p_resource_key text
)
returns boolean
language sql
immutable
as $$
  select lower(btrim(coalesce(p_resource_type, ''))) = 'screen'
     and btrim(coalesce(p_resource_key, '')) in (
       '/alianca-indicados',
       'menu_alianca_indicados'
     );
$$;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    '/alianca-indicados',
    'Aliança — Indicados',
    'Funil Kanban de igrejas parceiras indicadas (exclusivo Super Administrador)',
    true
  ),
  (
    'screen',
    'menu_alianca_indicados',
    'Menu — Indicados Aliança',
    'Atalho da engrenagem para o funil de Indicados (exclusivo Super Administrador)',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

delete from public.access_grants g
 using public.access_roles ar, public.access_resources res
 where g.role_id = ar.id
   and g.resource_id = res.id
   and public.is_alianca_indicados_access_resource(res.resource_type, res.resource_key)
   and ar.code is distinct from 'super_admin';

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on public.is_alianca_indicados_access_resource(res.resource_type, res.resource_key)
 where r.code = 'super_admin'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

create or replace function public.prevent_non_super_admin_alianca_indicados_grants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_type text;
  v_key text;
begin
  if new.role_id is null or new.resource_id is null then
    return new;
  end if;

  select ar.code into v_role from public.access_roles ar where ar.id = new.role_id;
  select res.resource_type, res.resource_key
    into v_type, v_key
    from public.access_resources res
   where res.id = new.resource_id;

  if public.is_alianca_indicados_access_resource(v_type, v_key)
     and coalesce(v_role, '') is distinct from 'super_admin' then
    raise exception 'O funil de Indicados é exclusivo do Super Administrador.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_non_super_admin_alianca_indicados_grants
  on public.access_grants;
create trigger trg_prevent_non_super_admin_alianca_indicados_grants
before insert or update on public.access_grants
for each row
execute function public.prevent_non_super_admin_alianca_indicados_grants();

-- ---------------------------------------------------------------------------
-- Campos de governança / análise de TI
-- ---------------------------------------------------------------------------

alter table public.alianca_partner_leads
  add column if not exists indicated_church_name text,
  add column if not exists city text,
  add column if not exists uf text,
  add column if not exists estimated_members integer,
  add column if not exists current_systems text,
  add column if not exists governance_notes text,
  add column if not exists ti_notes text,
  add column if not exists priority text not null default 'media',
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_action_at timestamptz,
  add column if not exists lost_reason text,
  add column if not exists entered_stage_at timestamptz not null default now();

update public.alianca_partner_leads
   set entered_stage_at = coalesce(updated_at, created_at, now())
 where entered_stage_at is null;

alter table public.alianca_partner_leads
  drop constraint if exists alianca_partner_leads_priority_chk;
alter table public.alianca_partner_leads
  add constraint alianca_partner_leads_priority_chk
  check (priority in ('baixa', 'media', 'alta'));

alter table public.alianca_partner_leads
  drop constraint if exists alianca_partner_leads_uf_chk;
alter table public.alianca_partner_leads
  add constraint alianca_partner_leads_uf_chk
  check (uf is null or uf ~ '^[A-Z]{2}$');

alter table public.alianca_partner_leads
  drop constraint if exists alianca_partner_leads_members_chk;
alter table public.alianca_partner_leads
  add constraint alianca_partner_leads_members_chk
  check (estimated_members is null or estimated_members >= 0);

-- ---------------------------------------------------------------------------
-- Histórico de movimentação + catálogo de automações + execuções + avisos
-- ---------------------------------------------------------------------------

create table if not exists public.alianca_partner_lead_movements (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.alianca_partner_leads (id) on delete cascade,
  from_stage text,
  from_sub_stage integer,
  to_stage text not null,
  to_sub_stage integer not null,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists alianca_partner_lead_movements_lead_idx
  on public.alianca_partner_lead_movements (lead_id, created_at desc);

create table if not exists public.alianca_partner_lead_phase_actions (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  event text not null default 'on_phase_enter',
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alianca_phase_actions_event_chk check (event = 'on_phase_enter'),
  constraint alianca_phase_actions_type_chk check (
    action_type in ('notify_super_admin', 'webhook', 'audit_log')
  ),
  constraint alianca_phase_actions_stage_chk check (
    stage in (
      'primeiro_contato',
      'qualificacao',
      'apresentacao',
      'follow_up',
      'negociacao',
      'fechamento'
    )
  )
);

create unique index if not exists alianca_phase_actions_stage_type_uidx
  on public.alianca_partner_lead_phase_actions (stage, event, action_type)
  where is_active = true and action_type <> 'webhook';

create table if not exists public.alianca_partner_lead_action_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.alianca_partner_leads (id) on delete cascade,
  movement_id uuid references public.alianca_partner_lead_movements (id) on delete set null,
  action_id uuid references public.alianca_partner_lead_phase_actions (id) on delete set null,
  action_type text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint alianca_action_runs_status_chk check (status in ('queued', 'done', 'failed'))
);

create index if not exists alianca_partner_lead_action_runs_lead_idx
  on public.alianca_partner_lead_action_runs (lead_id, created_at desc);

create table if not exists public.alianca_partner_lead_notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.alianca_partner_leads (id) on delete cascade,
  movement_id uuid references public.alianca_partner_lead_movements (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists alianca_partner_lead_notifications_unread_idx
  on public.alianca_partner_lead_notifications (created_at desc)
  where is_read = false;

alter table public.alianca_partner_lead_movements enable row level security;
alter table public.alianca_partner_lead_phase_actions enable row level security;
alter table public.alianca_partner_lead_action_runs enable row level security;
alter table public.alianca_partner_lead_notifications enable row level security;

revoke all on table public.alianca_partner_lead_movements from public, anon, authenticated;
revoke all on table public.alianca_partner_lead_phase_actions from public, anon, authenticated;
revoke all on table public.alianca_partner_lead_action_runs from public, anon, authenticated;
revoke all on table public.alianca_partner_lead_notifications from public, anon, authenticated;

drop policy if exists alianca_partner_lead_movements_no_direct on public.alianca_partner_lead_movements;
create policy alianca_partner_lead_movements_no_direct
  on public.alianca_partner_lead_movements for all using (false) with check (false);

drop policy if exists alianca_partner_lead_phase_actions_no_direct on public.alianca_partner_lead_phase_actions;
create policy alianca_partner_lead_phase_actions_no_direct
  on public.alianca_partner_lead_phase_actions for all using (false) with check (false);

drop policy if exists alianca_partner_lead_action_runs_no_direct on public.alianca_partner_lead_action_runs;
create policy alianca_partner_lead_action_runs_no_direct
  on public.alianca_partner_lead_action_runs for all using (false) with check (false);

drop policy if exists alianca_partner_lead_notifications_no_direct on public.alianca_partner_lead_notifications;
create policy alianca_partner_lead_notifications_no_direct
  on public.alianca_partner_lead_notifications for all using (false) with check (false);

insert into public.alianca_partner_lead_phase_actions (stage, event, action_type, payload, is_active)
select v.stage, v.event, v.action_type, v.payload, true
  from (values
    (
      'primeiro_contato', 'on_phase_enter', 'notify_super_admin',
      jsonb_build_object(
        'title', 'Funil Indicados',
        'body', 'Card entrou em Primeiro contato. Inicie a abordagem e o agendamento do diagnóstico.'
      )
    ),
    (
      'qualificacao', 'on_phase_enter', 'notify_super_admin',
      jsonb_build_object(
        'title', 'Funil Indicados',
        'body', 'Card entrou em Qualificação. Execute o diagnóstico BANT e o fit tecnológico.'
      )
    ),
    (
      'apresentacao', 'on_phase_enter', 'notify_super_admin',
      jsonb_build_object(
        'title', 'Funil Indicados',
        'body', 'Card entrou em Apresentação. Prepare a demo do Conecta+ e a proposta comercial.'
      )
    ),
    (
      'follow_up', 'on_phase_enter', 'notify_super_admin',
      jsonb_build_object(
        'title', 'Funil Indicados',
        'body', 'Card entrou em Follow-up. Envie materiais de apoio e alinhe o prazo de decisão.'
      )
    ),
    (
      'negociacao', 'on_phase_enter', 'notify_super_admin',
      jsonb_build_object(
        'title', 'Funil Indicados',
        'body', 'Card entrou em Negociação. Contorne objeções de custo e resistência à tecnologia.'
      )
    ),
    (
      'fechamento', 'on_phase_enter', 'notify_super_admin',
      jsonb_build_object(
        'title', 'Funil Indicados',
        'body', 'Card entrou em Fechamento. Conclua o contrato, o tenant e a passagem para o onboarding.'
      )
    )
  ) as v(stage, event, action_type, payload)
 where not exists (
   select 1
     from public.alianca_partner_lead_phase_actions a
    where a.stage = v.stage
      and a.event = v.event
      and a.action_type = v.action_type
 );

-- ---------------------------------------------------------------------------
-- Motor on_phase_enter
-- ---------------------------------------------------------------------------

create or replace function public.alianca_partner_lead_stage_ordinal(p_stage text)
returns integer
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_stage, '')))
    when 'primeiro_contato' then 1
    when 'qualificacao' then 2
    when 'apresentacao' then 3
    when 'follow_up' then 4
    when 'negociacao' then 5
    when 'fechamento' then 6
    else 0
  end;
$$;

create or replace function public.alianca_indicados_set_actor(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.alianca_indicados_actor', coalesce(p_actor::text, ''), true);
end;
$$;

create or replace function public.alianca_indicados_current_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw text := nullif(current_setting('app.alianca_indicados_actor', true), '');
begin
  if v_raw is not null then
    return v_raw::uuid;
  end if;
  return public.current_session_profile_id();
end;
$$;

create or replace function public.assert_alianca_indicados_super_admin(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor is null then
    raise exception 'Sessão inválida.';
  end if;
  if not public.profile_has_super_admin_role(p_actor) then
    raise exception 'Apenas o Super Administrador acessa o funil de Indicados.';
  end if;
end;
$$;

create or replace function public.alianca_run_phase_enter_actions(
  p_lead_id uuid,
  p_stage text,
  p_sub_stage integer,
  p_movement_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_action record;
  v_run_id uuid;
  v_title text;
  v_body text;
  v_url text;
  v_payload jsonb;
  v_lead jsonb;
  v_has_pg_net boolean := false;
begin
  select jsonb_build_object(
           'event', 'on_phase_enter',
           'lead_id', l.id,
           'stage', p_stage,
           'sub_stage', p_sub_stage,
           'actor_profile_id', p_actor,
           'indicated_name', l.indicated_name,
           'indicated_role', l.indicated_role,
           'indicated_phone', l.indicated_phone,
           'indicated_church_name', l.indicated_church_name,
           'tenant_id', l.tenant_id,
           'priority', l.priority
         )
    into v_lead
    from public.alianca_partner_leads l
   where l.id = p_lead_id;

  if v_lead is null then
    return;
  end if;

  perform pg_notify('alianca_indicados_phase', v_lead::text);

  select exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'net'
       and p.proname = 'http_post'
  ) into v_has_pg_net;

  for v_action in
    select a.*
      from public.alianca_partner_lead_phase_actions a
     where a.is_active
       and a.event = 'on_phase_enter'
       and a.stage = p_stage
     order by a.action_type, a.created_at
  loop
    insert into public.alianca_partner_lead_action_runs (
      lead_id, movement_id, action_id, action_type, status, payload
    )
    values (
      p_lead_id, p_movement_id, v_action.id, v_action.action_type, 'queued',
      coalesce(v_action.payload, '{}'::jsonb) || jsonb_build_object('lead', v_lead)
    )
    returning id into v_run_id;

    begin
      if v_action.action_type = 'notify_super_admin' then
        v_title := coalesce(nullif(v_action.payload->>'title', ''), 'Funil Indicados');
        v_body := coalesce(
          nullif(v_action.payload->>'body', ''),
          'O Super Administrador avançou um card no funil de Indicados.'
        );
        insert into public.alianca_partner_lead_notifications (
          lead_id, movement_id, actor_profile_id, title, body
        )
        values (p_lead_id, p_movement_id, p_actor, v_title, v_body);

        update public.alianca_partner_lead_action_runs
           set status = 'done',
               result = jsonb_build_object('notified', true)
         where id = v_run_id;

      elsif v_action.action_type = 'webhook' then
        v_url := nullif(btrim(coalesce(v_action.payload->>'url', '')), '');
        v_payload := coalesce(v_action.payload, '{}'::jsonb) || jsonb_build_object('lead', v_lead);

        if v_url is null then
          update public.alianca_partner_lead_action_runs
             set status = 'done',
                 result = jsonb_build_object('skipped', true, 'reason', 'url_ausente')
           where id = v_run_id;
        elsif v_has_pg_net then
          execute 'select net.http_post($1, $2, $3, $4, $5)'
            using v_url,
                  v_payload,
                  '{}'::jsonb,
                  '{"Content-Type": "application/json"}'::jsonb,
                  2000;
          update public.alianca_partner_lead_action_runs
             set status = 'done',
                 result = jsonb_build_object('dispatched', true, 'via', 'pg_net')
           where id = v_run_id;
        else
          update public.alianca_partner_lead_action_runs
             set status = 'queued',
                 result = jsonb_build_object('queued', true, 'reason', 'pg_net_ausente')
           where id = v_run_id;
        end if;

      else
        update public.alianca_partner_lead_action_runs
           set status = 'done',
               result = jsonb_build_object('audited', true)
         where id = v_run_id;
      end if;
    exception
      when others then
        update public.alianca_partner_lead_action_runs
           set status = 'failed',
               result = jsonb_build_object('error', SQLERRM)
         where id = v_run_id;
    end;
  end loop;
end;
$$;

create or replace function public.alianca_partner_leads_phase_change_trg()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.alianca_indicados_current_actor();
  v_movement uuid;
  v_phase_changed boolean;
begin
  if v_actor is null then
    v_actor := coalesce(new.referrer_profile_id, old.referrer_profile_id);
  end if;

  if tg_op = 'INSERT' then
    v_phase_changed := true;
    insert into public.alianca_partner_lead_movements (
      lead_id, from_stage, from_sub_stage, to_stage, to_sub_stage, actor_profile_id
    )
    values (new.id, null, null, new.stage, new.sub_stage, v_actor)
    returning id into v_movement;

    perform public.alianca_run_phase_enter_actions(
      new.id, new.stage, new.sub_stage, v_movement, v_actor
    );
    return new;
  end if;

  if new.stage is not distinct from old.stage
     and new.sub_stage is not distinct from old.sub_stage then
    return new;
  end if;

  v_phase_changed := new.stage is distinct from old.stage;

  insert into public.alianca_partner_lead_movements (
    lead_id, from_stage, from_sub_stage, to_stage, to_sub_stage, actor_profile_id
  )
  values (
    new.id, old.stage, old.sub_stage, new.stage, new.sub_stage, v_actor
  )
  returning id into v_movement;

  if v_phase_changed then
    perform public.alianca_run_phase_enter_actions(
      new.id, new.stage, new.sub_stage, v_movement, v_actor
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_alianca_partner_leads_phase_change on public.alianca_partner_leads;
create trigger trg_alianca_partner_leads_phase_change
after insert or update of stage, sub_stage on public.alianca_partner_leads
for each row
execute function public.alianca_partner_leads_phase_change_trg();

insert into public.alianca_partner_lead_movements (
  lead_id, from_stage, from_sub_stage, to_stage, to_sub_stage, actor_profile_id, created_at
)
select
  l.id,
  null,
  null,
  l.stage,
  l.sub_stage,
  l.referrer_profile_id,
  l.created_at
  from public.alianca_partner_leads l
 where not exists (
   select 1 from public.alianca_partner_lead_movements m where m.lead_id = l.id
 );

-- ---------------------------------------------------------------------------
-- RPCs (todas as operações do funil: só Super Admin)
-- ---------------------------------------------------------------------------

create or replace function public.submit_alianca_partner_lead(
  p_indicated_name text,
  p_indicated_role text,
  p_indicated_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_name text := nullif(btrim(coalesce(p_indicated_name, '')), '');
  v_role text := nullif(btrim(coalesce(p_indicated_role, '')), '');
  v_phone text := regexp_replace(coalesce(p_indicated_phone, ''), '\D', '', 'g');
  v_referrer text;
  v_id uuid;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  perform public.alianca_indicados_set_actor(v_actor);

  if v_phone like '55%' and length(v_phone) >= 12 then
    v_phone := substr(v_phone, 3);
  end if;

  if v_name is null or length(v_name) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do indicado.');
  end if;
  if v_role is null or length(v_role) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe a posição do indicado.');
  end if;
  if length(v_phone) < 10 or length(v_phone) > 11 then
    return jsonb_build_object('success', false, 'message', 'Informe um celular válido com DDD.');
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'Membro da instância')
    into v_referrer
    from public.profiles p
   where p.id = v_actor;

  v_referrer := coalesce(nullif(btrim(v_referrer), ''), 'Membro da instância');

  insert into public.alianca_partner_leads (
    tenant_id,
    referrer_profile_id,
    referrer_name,
    indicated_name,
    indicated_role,
    indicated_phone
  )
  values (
    v_tenant,
    v_actor,
    v_referrer,
    v_name,
    v_role,
    v_phone
  )
  on conflict (tenant_id, indicated_phone) do update
    set indicated_name = excluded.indicated_name,
        indicated_role = excluded.indicated_role,
        referrer_profile_id = excluded.referrer_profile_id,
        referrer_name = excluded.referrer_name,
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'message', 'Indicação registrada.'
  );
end;
$$;

create or replace function public.alianca_partner_lead_to_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'id', l.id,
    'indicated_name', l.indicated_name,
    'indicated_role', l.indicated_role,
    'indicated_phone', l.indicated_phone,
    'indicated_church_name', l.indicated_church_name,
    'city', l.city,
    'uf', l.uf,
    'estimated_members', l.estimated_members,
    'current_systems', l.current_systems,
    'governance_notes', l.governance_notes,
    'ti_notes', l.ti_notes,
    'priority', l.priority,
    'last_contact_at', l.last_contact_at,
    'next_action_at', l.next_action_at,
    'lost_reason', l.lost_reason,
    'stage', l.stage,
    'sub_stage', l.sub_stage,
    'entered_stage_at', l.entered_stage_at,
    'referrer_name', l.referrer_name,
    'instance_code', i.code,
    'instance_name', i.name,
    'tenant_id', l.tenant_id,
    'created_at', l.created_at,
    'updated_at', l.updated_at
  )
    from public.alianca_partner_leads l
    join public.igrejas i on i.id = l.tenant_id
   where l.id = p_id;
$$;

create or replace function public.list_alianca_partner_leads()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_items jsonb;
  v_notes jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'leads', '[]'::jsonb, 'notifications', '[]'::jsonb);
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas o Super Administrador acessa o funil de Indicados.',
      'leads', '[]'::jsonb,
      'notifications', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(public.alianca_partner_lead_to_json(x.id) order by x.created_at desc),
    '[]'::jsonb
  )
    into v_items
    from public.alianca_partner_leads x;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'lead_id', n.lead_id,
        'title', n.title,
        'body', n.body,
        'created_at', n.created_at
      )
      order by n.created_at desc
    ),
    '[]'::jsonb
  )
    into v_notes
    from (
      select *
        from public.alianca_partner_lead_notifications
       where is_read = false
       order by created_at desc
       limit 20
    ) n;

  return jsonb_build_object(
    'success', true,
    'leads', coalesce(v_items, '[]'::jsonb),
    'notifications', coalesce(v_notes, '[]'::jsonb)
  );
end;
$$;

drop function if exists public.set_alianca_partner_lead_stage(uuid, text);
drop function if exists public.set_alianca_partner_lead_stage(uuid, text, integer);

create or replace function public.set_alianca_partner_lead_stage(
  p_lead_id uuid,
  p_stage text,
  p_sub_stage integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_stage text := lower(btrim(coalesce(p_stage, '')));
  v_sub integer := coalesce(p_sub_stage, 1);
  v_current record;
  v_from_ord integer;
  v_to_ord integer;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  begin
    perform public.assert_alianca_indicados_super_admin(v_actor);
  exception
    when others then
      return jsonb_build_object('success', false, 'message', SQLERRM);
  end;
  if p_lead_id is null then
    return jsonb_build_object('success', false, 'message', 'Indicado não informado.');
  end if;
  if v_stage not in (
    'primeiro_contato',
    'qualificacao',
    'apresentacao',
    'follow_up',
    'negociacao',
    'fechamento'
  ) then
    return jsonb_build_object('success', false, 'message', 'Etapa comercial inválida.');
  end if;
  if v_stage = 'negociacao' then
    if v_sub not between 1 and 4 then
      return jsonb_build_object('success', false, 'message', 'Atividade da etapa inválida.');
    end if;
  elsif v_sub not between 1 and 3 then
    return jsonb_build_object('success', false, 'message', 'Atividade da etapa inválida.');
  end if;

  select stage, sub_stage
    into v_current
    from public.alianca_partner_leads
   where id = p_lead_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.');
  end if;

  v_from_ord := public.alianca_partner_lead_stage_ordinal(v_current.stage);
  v_to_ord := public.alianca_partner_lead_stage_ordinal(v_stage);

  if v_from_ord <> v_to_ord then
    if abs(v_from_ord - v_to_ord) <> 1 then
      return jsonb_build_object(
        'success', false,
        'message', 'Avance ou recue uma etapa por vez no funil.'
      );
    end if;
    if v_current.stage = 'negociacao'
       and v_current.sub_stage = 4
       and v_stage = 'fechamento' then
      return jsonb_build_object(
        'success', false,
        'message', 'Negócio não concluído não avança para o fechamento.'
      );
    end if;
    v_sub := 1;
  end if;

  perform public.alianca_indicados_set_actor(v_actor);

  update public.alianca_partner_leads
     set stage = v_stage,
         sub_stage = v_sub,
         updated_at = now(),
         entered_stage_at = case
           when stage is distinct from v_stage then now()
           else entered_stage_at
         end
   where id = p_lead_id;

  return jsonb_build_object(
    'success', true,
    'stage', v_stage,
    'sub_stage', v_sub,
    'message', 'Etapa atualizada.'
  );
end;
$$;

create or replace function public.update_alianca_partner_lead(
  p_lead_id uuid,
  p_indicated_church_name text default null,
  p_city text default null,
  p_uf text default null,
  p_estimated_members integer default null,
  p_current_systems text default null,
  p_governance_notes text default null,
  p_ti_notes text default null,
  p_priority text default null,
  p_last_contact_at timestamptz default null,
  p_next_action_at timestamptz default null,
  p_lost_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_priority text;
  v_uf text;
  v_members integer;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  begin
    perform public.assert_alianca_indicados_super_admin(v_actor);
  exception
    when others then
      return jsonb_build_object('success', false, 'message', SQLERRM);
  end;
  if p_lead_id is null then
    return jsonb_build_object('success', false, 'message', 'Indicado não informado.');
  end if;

  v_priority := lower(nullif(btrim(coalesce(p_priority, '')), ''));
  if v_priority is not null and v_priority not in ('baixa', 'media', 'alta') then
    return jsonb_build_object('success', false, 'message', 'Prioridade inválida.');
  end if;

  v_uf := upper(nullif(btrim(coalesce(p_uf, '')), ''));
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
    return jsonb_build_object('success', false, 'message', 'UF inválida.');
  end if;

  v_members := p_estimated_members;
  if v_members is not null and v_members < 0 then
    return jsonb_build_object('success', false, 'message', 'Informe um número de membros válido.');
  end if;

  perform public.alianca_indicados_set_actor(v_actor);

  update public.alianca_partner_leads
     set indicated_church_name = nullif(btrim(coalesce(p_indicated_church_name, '')), ''),
         city = nullif(btrim(coalesce(p_city, '')), ''),
         uf = v_uf,
         estimated_members = v_members,
         current_systems = nullif(btrim(coalesce(p_current_systems, '')), ''),
         governance_notes = nullif(btrim(coalesce(p_governance_notes, '')), ''),
         ti_notes = nullif(btrim(coalesce(p_ti_notes, '')), ''),
         priority = coalesce(v_priority, priority),
         last_contact_at = p_last_contact_at,
         next_action_at = p_next_action_at,
         lost_reason = nullif(btrim(coalesce(p_lost_reason, '')), ''),
         updated_at = now()
   where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Dados de governança atualizados.',
    'lead', public.alianca_partner_lead_to_json(p_lead_id)
  );
end;
$$;

create or replace function public.list_alianca_partner_lead_movements(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_items jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'movements', '[]'::jsonb);
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas o Super Administrador acessa o funil de Indicados.',
      'movements', '[]'::jsonb
    );
  end if;
  if p_lead_id is null then
    return jsonb_build_object('success', false, 'message', 'Indicado não informado.', 'movements', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'from_stage', m.from_stage,
        'from_sub_stage', m.from_sub_stage,
        'to_stage', m.to_stage,
        'to_sub_stage', m.to_sub_stage,
        'actor_profile_id', m.actor_profile_id,
        'actor_name', coalesce(nullif(btrim(p.full_name), ''), 'Super Administrador'),
        'created_at', m.created_at
      )
      order by m.created_at desc
    ),
    '[]'::jsonb
  )
    into v_items
    from public.alianca_partner_lead_movements m
    left join public.profiles p on p.id = m.actor_profile_id
   where m.lead_id = p_lead_id;

  return jsonb_build_object('success', true, 'movements', coalesce(v_items, '[]'::jsonb));
end;
$$;

create or replace function public.delete_alianca_partner_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  begin
    perform public.assert_alianca_indicados_super_admin(v_actor);
  exception
    when others then
      return jsonb_build_object('success', false, 'message', SQLERRM);
  end;
  if p_lead_id is null then
    return jsonb_build_object('success', false, 'message', 'Indicado não informado.');
  end if;

  delete from public.alianca_partner_leads
   where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Indicado excluído.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Matriz de papéis: oculta o funil (acesso é pelo papel, não por grant)
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- ---------------------------------------------------------------------------

create or replace function public.listar_grants_recurso_papel_admin(
  p_actor_profile_id uuid,
  p_role_code text,
  p_resource_type text
)
returns table (
  resource_id uuid,
  resource_type text,
  resource_key text,
  label text,
  can_view boolean,
  can_update boolean,
  grant_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_resource_type text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));
  v_resource_type := lower(trim(coalesce(p_resource_type, '')));

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_gestor_super_admin_shield(
    p_actor_profile_id,
    null,
    v_role_code,
    'list_role_grants'
  );

  if v_role_code = '' then
    raise exception 'Papel não informado.';
  end if;

  if v_resource_type not in ('screen', 'table', 'column') then
    raise exception 'Tipo de recurso inválido.';
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    raise exception 'Papel não encontrado.';
  end if;

  return query
  select
    res.id as resource_id,
    res.resource_type,
    res.resource_key,
    res.label,
    coalesce(g.can_view, false) as can_view,
    coalesce(g.can_update, false) as can_update,
    g.id as grant_id
  from public.access_resources res
  left join public.access_grants g
    on g.resource_id = res.id
   and g.role_id = v_role_id
 where res.resource_type = v_resource_type
   and res.is_active = true
   and not (
     res.resource_type = 'screen'
     and res.resource_key like 'scale_type.tstmax%'
   )
   and not public.is_alianca_indicados_access_resource(res.resource_type, res.resource_key)
   -- Gestor: sem recursos de PIN/senha na matriz
   and (
     public.is_super_admin_profile(p_actor_profile_id)
     or not (
       res.resource_type = 'column'
       and (
         res.resource_key ilike '%access_pin%'
         or res.resource_key ilike '%password%'
         or res.resource_key ilike '%senha%'
       )
     )
   )
 order by
   case when res.resource_key = 'maintenance.card.access_control' then 1 else 0 end,
   res.resource_key asc;
end;
$$;

revoke all on function public.submit_alianca_partner_lead(text, text, text) from public, anon, authenticated;
revoke all on function public.list_alianca_partner_leads() from public, anon, authenticated;
revoke all on function public.set_alianca_partner_lead_stage(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.update_alianca_partner_lead(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.list_alianca_partner_lead_movements(uuid) from public, anon, authenticated;
revoke all on function public.delete_alianca_partner_lead(uuid) from public, anon, authenticated;

grant execute on function public.submit_alianca_partner_lead(text, text, text) to anon, authenticated, service_role;
grant execute on function public.list_alianca_partner_leads() to anon, authenticated, service_role;
grant execute on function public.set_alianca_partner_lead_stage(uuid, text, integer) to anon, authenticated, service_role;
grant execute on function public.update_alianca_partner_lead(uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text) to anon, authenticated, service_role;
grant execute on function public.list_alianca_partner_lead_movements(uuid) to anon, authenticated, service_role;
grant execute on function public.delete_alianca_partner_lead(uuid) to anon, authenticated, service_role;

-- Artigo da ajuda (somente Super Admin)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '_seed_knowledge_article'
  ) then
    perform public._seed_knowledge_article(
      'alianca-indicados',
      'Indicados',
      'Como avanço o funil Kanban das igrejas parceiras?',
      $body$## Quem acessa
Somente o Super Administrador vê e opera este funil. O atalho na engrenagem, a rota e as APIs recusam qualquer outro papel.

## O que é o Kanban
Cada coluna é uma etapa sequencial: Primeiro contato → Qualificação → Apresentação → Follow-up → Negociação → Fechamento. Avance ou recue uma coluna por vez. A atividade (1.1 a 6.3) fica dentro da coluna; 5.4 encerra a tratativa sem ir ao fechamento.

## Governança e TI
No card, registre igreja indicada, cidade/UF, porte, sistemas atuais, notas de governança e de TI, prioridade e próximos contatos. Esses campos alimentam a análise antes do contrato.

## Automações
Ao entrar em uma fase (`on_phase_enter`), o sistema registra o histórico (data, hora e Super Administrador responsável) e dispara as ações daquela etapa — aviso interno e, se configurado, webhook.
$body$,
      '/alianca-indicados',
      array['super_admin'],
      72
    );
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
