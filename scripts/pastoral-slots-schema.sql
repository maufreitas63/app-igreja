-- =============================================================================
-- Agendamento de Atendimento Pastoral — multi-tenant
-- =============================================================================
-- Tabelas: pastoral_slots, pastoral_slot_notices
-- ACL: dashboard.pastoral.schedule / maintenance.pastoral.agenda
-- Sigilo: motivo do pedido NUNCA é exposto a intercessão nem em listagens de slot.
-- tenant_id sempre da sessão (require_session_tenant_id).
-- Aplica: npx supabase db query --linked -f scripts/pastoral-slots-schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.pastoral_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  pastor_id uuid not null references public.profiles (id) on delete restrict,
  data_hora_inicio timestamptz not null,
  data_hora_fim timestamptz not null,
  status text not null default 'disponivel'
    check (status in ('disponivel', 'reservado', 'concluido')),
  tipo_atendimento text not null default 'presencial'
    check (tipo_atendimento in ('presencial', 'online')),
  is_published boolean not null default false,
  pastoral_request_id uuid null references public.pastoral_requests (id) on delete set null,
  member_profile_id uuid null references public.profiles (id) on delete set null,
  checkin_at timestamptz null,
  checkin_by_profile_id uuid null references public.profiles (id) on delete set null,
  member_reminded_at timestamptz null,
  pastor_reminded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_profile_id uuid null references public.profiles (id) on delete set null,
  constraint pastoral_slots_range_check check (data_hora_fim > data_hora_inicio)
);

create index if not exists pastoral_slots_tenant_pastor_idx
  on public.pastoral_slots (tenant_id, pastor_id, data_hora_inicio);

create index if not exists pastoral_slots_available_idx
  on public.pastoral_slots (tenant_id, status, is_published, data_hora_inicio)
  where status = 'disponivel' and is_published is true;

create index if not exists pastoral_slots_request_idx
  on public.pastoral_slots (pastoral_request_id)
  where pastoral_request_id is not null;

create index if not exists pastoral_slots_member_idx
  on public.pastoral_slots (member_profile_id, data_hora_inicio)
  where member_profile_id is not null;

comment on table public.pastoral_slots is
  'Horários de atendimento pastoral por igreja. Motivo/sigilo ficam no pedido vinculado.';
comment on column public.pastoral_slots.is_published is
  'false = rascunho (azul); true = publicado (verde) e visível para agendamento.';

create table if not exists public.pastoral_slot_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  slot_id uuid not null references public.pastoral_slots (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint pastoral_slot_notices_unique unique (slot_id, profile_id)
);

create index if not exists pastoral_slot_notices_profile_idx
  on public.pastoral_slot_notices (profile_id, created_at desc);

comment on table public.pastoral_slot_notices is
  'Avisos automáticos (2h antes) para membro e pastor — sem expor motivo/sigilo.';

alter table public.pastoral_slots enable row level security;
alter table public.pastoral_slot_notices enable row level security;

drop policy if exists pastoral_slots_tenant_all on public.pastoral_slots;
drop policy if exists pastoral_slots_deny_direct on public.pastoral_slots;
create policy pastoral_slots_deny_direct
  on public.pastoral_slots for all using (false) with check (false);

drop policy if exists pastoral_slot_notices_tenant_all on public.pastoral_slot_notices;
drop policy if exists pastoral_slot_notices_deny_direct on public.pastoral_slot_notices;
create policy pastoral_slot_notices_deny_direct
  on public.pastoral_slot_notices for all using (false) with check (false);

-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------

create or replace function public.session_has_pastoral_agenda_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.profile_has_access(
      public.current_session_profile_id(),
      'screen',
      'maintenance.pastoral.agenda',
      'view'
    )
    or public.profile_has_role_code(public.current_session_profile_id(), 'pastoral'),
    false
  );
$$;

create or replace function public.session_can_book_pastoral_slot()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.profile_has_access(
      public.current_session_profile_id(),
      'screen',
      'dashboard.pastoral.schedule',
      'view'
    )
    or public.profile_has_access(
      public.current_session_profile_id(),
      'screen',
      '/pastoral',
      'view'
    ),
    false
  );
$$;

create or replace function public.profile_is_pastoral_attendant(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_profile_id is not null
    and (
      public.profile_has_role_code(p_profile_id, 'pastoral')
      or public.is_super_admin_profile(p_profile_id)
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Membro — atendentes e slots disponíveis
-- ---------------------------------------------------------------------------

create or replace function public.list_pastoral_attendants()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  if v_actor is null or not public.session_can_book_pastoral_slot() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'attendants', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'attendants',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name
          )
          order by p.full_name
        )
        from public.profiles p
        join public.profile_access_roles par on par.profile_id = p.id
        join public.access_roles ar on ar.id = par.role_id
       where p.tenant_id = v_tenant
         and p.membership_out is null
         and ar.code = 'pastoral'
         and (
           public.is_super_admin_profile(v_actor)
           or not public.profile_has_role_code(p.id, 'super_admin')
         )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_pastoral_attendants() to anon, authenticated;

create or replace function public.list_available_pastoral_slots(
  p_pastor_id uuid default null,
  p_from timestamptz default now(),
  p_until timestamptz default now() + interval '45 days'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.session_can_book_pastoral_slot() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'slots', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'slots',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'pastor_id', s.pastor_id,
            'pastor_name', p.full_name,
            'data_hora_inicio', s.data_hora_inicio,
            'data_hora_fim', s.data_hora_fim,
            'tipo_atendimento', s.tipo_atendimento,
            'status', s.status
          )
          order by s.data_hora_inicio
        )
        from public.pastoral_slots s
        join public.profiles p on p.id = s.pastor_id
       where s.tenant_id = v_tenant
         and s.status = 'disponivel'
         and s.is_published is true
         and s.data_hora_inicio >= coalesce(p_from, now())
         and s.data_hora_inicio < coalesce(p_until, now() + interval '45 days')
         and (p_pastor_id is null or s.pastor_id = p_pastor_id)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_available_pastoral_slots(uuid, timestamptz, timestamptz)
  to anon, authenticated;

create or replace function public.book_pastoral_slot(
  p_slot_id uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_slot public.pastoral_slots%rowtype;
  v_request public.pastoral_requests%rowtype;
begin
  if v_actor is null or not public.session_can_book_pastoral_slot() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para agendar.');
  end if;

  select * into v_slot
    from public.pastoral_slots s
   where s.id = p_slot_id
     and s.tenant_id = v_tenant
   for update;

  if v_slot.id is null then
    return jsonb_build_object('success', false, 'message', 'Horário não encontrado.');
  end if;

  if v_slot.status <> 'disponivel' or v_slot.is_published is not true then
    return jsonb_build_object('success', false, 'message', 'Este horário não está mais disponível.');
  end if;

  if v_slot.data_hora_inicio <= now() then
    return jsonb_build_object('success', false, 'message', 'Não é possível reservar um horário já iniciado.');
  end if;

  if p_request_id is not null then
    select * into v_request
      from public.pastoral_requests pr
     where pr.id = p_request_id
       and pr.profile_id = v_actor
       and coalesce(pr.tenant_id, v_tenant) = v_tenant;

    if v_request.id is null then
      return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
    end if;
  end if;

  update public.pastoral_slots
     set status = 'reservado',
         member_profile_id = v_actor,
         pastoral_request_id = case when p_request_id is not null then v_request.id else null end,
         updated_at = now()
   where id = v_slot.id
     and status = 'disponivel';

  if not found then
    return jsonb_build_object('success', false, 'message', 'Não foi possível reservar este horário.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Atendimento agendado.');
end;
$$;

grant execute on function public.book_pastoral_slot(uuid, uuid) to anon, authenticated;

create or replace function public.list_my_pastoral_appointments()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'appointments', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'appointments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'pastoral_request_id', s.pastoral_request_id,
            'data_hora_inicio', s.data_hora_inicio,
            'data_hora_fim', s.data_hora_fim,
            'tipo_atendimento', s.tipo_atendimento,
            'status', s.status,
            'pastor_name', p.full_name,
            'request_status', pr.status,
            'destination_label', pr.destination_label
          )
          order by s.data_hora_inicio desc
        )
        from public.pastoral_slots s
        join public.profiles p on p.id = s.pastor_id
        left join public.pastoral_requests pr on pr.id = s.pastoral_request_id
       where s.tenant_id = v_tenant
         and s.member_profile_id = v_actor
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_my_pastoral_appointments() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Pastor — Minha Agenda
-- ---------------------------------------------------------------------------

create or replace function public.list_my_pastoral_agenda(
  p_from timestamptz default date_trunc('week', now()),
  p_until timestamptz default date_trunc('week', now()) + interval '7 days'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_full boolean;
begin
  if v_actor is null or not public.session_has_pastoral_agenda_access() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'slots', '[]'::jsonb);
  end if;

  v_full := public.session_has_full_pastoral_requests_access();

  return jsonb_build_object(
    'success', true,
    'slots',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'data_hora_inicio', s.data_hora_inicio,
            'data_hora_fim', s.data_hora_fim,
            'status', s.status,
            'tipo_atendimento', s.tipo_atendimento,
            'is_published', s.is_published,
            'member_name', case
              when s.member_profile_id is null then null
              else m.full_name
            end,
            'destination_label', case
              when v_full then pr.destination_label
              when coalesce(pr.confidential, false) then 'Sigilo Pastoral'
              else pr.destination_label
            end,
            'motivo', case
              when v_full then pr.motivo
              else null
            end,
            'can_checkin', s.status = 'reservado'
          )
          order by s.data_hora_inicio
        )
        from public.pastoral_slots s
        left join public.profiles m on m.id = s.member_profile_id
        left join public.pastoral_requests pr on pr.id = s.pastoral_request_id
       where s.tenant_id = v_tenant
         and s.pastor_id = v_actor
         and s.data_hora_inicio >= coalesce(p_from, date_trunc('week', now()))
         and s.data_hora_inicio < coalesce(p_until, date_trunc('week', now()) + interval '7 days')
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_my_pastoral_agenda(timestamptz, timestamptz)
  to anon, authenticated;

create or replace function public.upsert_pastoral_slot(
  p_id uuid default null,
  p_data_hora_inicio timestamptz default null,
  p_data_hora_fim timestamptz default null,
  p_tipo_atendimento text default 'presencial',
  p_is_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
  v_tipo text := lower(trim(coalesce(p_tipo_atendimento, 'presencial')));
begin
  if v_actor is null or not public.session_has_pastoral_agenda_access() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para publicar horários.');
  end if;

  if not public.profile_is_pastoral_attendant(v_actor)
     and not public.is_super_admin_profile(v_actor)
  then
    return jsonb_build_object('success', false, 'message', 'Apenas a equipe pastoral publica horários.');
  end if;

  if v_tipo not in ('presencial', 'online') then
    v_tipo := 'presencial';
  end if;

  if p_id is null then
    if p_data_hora_inicio is null or p_data_hora_fim is null then
      return jsonb_build_object('success', false, 'message', 'Informe início e fim do horário.');
    end if;

    if p_data_hora_fim <= p_data_hora_inicio then
      return jsonb_build_object('success', false, 'message', 'O término deve ser depois do início.');
    end if;

    insert into public.pastoral_slots (
      tenant_id, pastor_id, data_hora_inicio, data_hora_fim,
      tipo_atendimento, is_published, status, created_by_profile_id
    ) values (
      v_tenant, v_actor, p_data_hora_inicio, p_data_hora_fim,
      v_tipo, coalesce(p_is_published, false), 'disponivel', v_actor
    )
    returning id into v_id;
  else
    update public.pastoral_slots s
       set data_hora_inicio = coalesce(p_data_hora_inicio, s.data_hora_inicio),
           data_hora_fim = coalesce(p_data_hora_fim, s.data_hora_fim),
           tipo_atendimento = v_tipo,
           is_published = coalesce(p_is_published, s.is_published),
           updated_at = now()
     where s.id = p_id
       and s.tenant_id = v_tenant
       and s.pastor_id = v_actor
       and s.status = 'disponivel'
    returning s.id into v_id;

    if v_id is null then
      return jsonb_build_object('success', false, 'message', 'Horário não encontrado ou já reservado.');
    end if;
  end if;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

grant execute on function public.upsert_pastoral_slot(
  uuid, timestamptz, timestamptz, text, boolean
) to anon, authenticated;

create or replace function public.checkin_pastoral_slot(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
begin
  if v_actor is null or not public.session_has_pastoral_agenda_access() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para check-in.');
  end if;

  update public.pastoral_slots s
     set status = 'concluido',
         checkin_at = now(),
         checkin_by_profile_id = v_actor,
         updated_at = now()
   where s.id = p_slot_id
     and s.tenant_id = v_tenant
     and s.pastor_id = v_actor
     and s.status = 'reservado'
  returning s.id into v_id;

  if v_id is null then
    return jsonb_build_object('success', false, 'message', 'Horário não está reservado para check-in.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Atendimento concluído. O histórico registra a conclusão sem expor o conteúdo sigiloso.'
  );
end;
$$;

grant execute on function public.checkin_pastoral_slot(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Lembretes 2h antes (orquestrador / avisos)
-- ---------------------------------------------------------------------------

create or replace function public.dispatch_pastoral_appointment_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_slot record;
  v_count int := 0;
  v_when text;
  v_tenant uuid := public.current_session_tenant_id();
begin
  for v_slot in
    select s.*,
           m.full_name as member_name,
           p.full_name as pastor_name
      from public.pastoral_slots s
      left join public.profiles m on m.id = s.member_profile_id
      join public.profiles p on p.id = s.pastor_id
     where s.status = 'reservado'
       and s.data_hora_inicio > now()
       and s.data_hora_inicio <= now() + interval '2 hours 10 minutes'
       and (v_tenant is null or s.tenant_id = v_tenant)
  loop
    v_when := to_char(v_slot.data_hora_inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI');

    if v_slot.member_profile_id is not null and v_slot.member_reminded_at is null then
      insert into public.pastoral_slot_notices (
        tenant_id, slot_id, profile_id, title, body
      ) values (
        v_slot.tenant_id,
        v_slot.id,
        v_slot.member_profile_id,
        'Lembrete de atendimento pastoral',
        'Seu atendimento com ' || coalesce(v_slot.pastor_name, 'a equipe pastoral')
          || ' começa às ' || v_when || ' (' || v_slot.tipo_atendimento || ').'
      )
      on conflict (slot_id, profile_id) do nothing;

      update public.pastoral_slots
         set member_reminded_at = now()
       where id = v_slot.id;

      v_count := v_count + 1;
    end if;

    if v_slot.pastor_reminded_at is null then
      insert into public.pastoral_slot_notices (
        tenant_id, slot_id, profile_id, title, body
      ) values (
        v_slot.tenant_id,
        v_slot.id,
        v_slot.pastor_id,
        'Lembrete de atendimento pastoral',
        'Atendimento às ' || v_when || ' (' || v_slot.tipo_atendimento || ').'
      )
      on conflict (slot_id, profile_id) do nothing;

      update public.pastoral_slots
         set pastor_reminded_at = now()
       where id = v_slot.id;

      v_count := v_count + 1;
    end if;
  end loop;

  return jsonb_build_object('success', true, 'dispatched', v_count);
end;
$$;

grant execute on function public.dispatch_pastoral_appointment_reminders()
  to anon, authenticated;

create or replace function public.list_my_pastoral_slot_notices()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
begin
  if v_actor is null then
    return jsonb_build_object('success', true, 'notices', '[]'::jsonb);
  end if;

  perform public.dispatch_pastoral_appointment_reminders();

  return jsonb_build_object(
    'success', true,
    'notices',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', n.id,
            'title', n.title,
            'body', n.body,
            'created_at', n.created_at,
            'read_at', n.read_at
          )
          order by n.created_at desc
        )
        from public.pastoral_slot_notices n
       where n.profile_id = v_actor
         and (v_tenant is null or n.tenant_id = v_tenant)
         and n.created_at >= now() - interval '2 days'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_my_pastoral_slot_notices() to anon, authenticated;

-- pg_cron opcional (ignora se a extensão não existir)
do $$
begin
  perform cron.schedule(
    'pastoral-slot-reminders-2h',
    '*/15 * * * *',
    $cron$select public.dispatch_pastoral_appointment_reminders();$cron$
  );
exception
  when undefined_function then
    null;
  when undefined_object then
    null;
  when others then
    null;
end
$$;

-- ---------------------------------------------------------------------------
-- 6) ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.pastoral.schedule',
    'Coração Aberto — Agendar atendimento',
    'Membro agenda horário pastoral disponível.',
    true
  ),
  (
    'screen',
    'maintenance.pastoral.agenda',
    'Cuidado Pastoral — Minha Agenda',
    'Equipe pastoral publica horários e registra check-in.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code in ('super_admin', 'member')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'dashboard.pastoral.schedule'
 where r.code in ('super_admin', 'pastoral', 'member', 'congregado', 'lider', 'lider_geral')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.pastoral.agenda'
 where r.code in ('super_admin', 'pastoral')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
