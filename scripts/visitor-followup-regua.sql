-- =============================================================================
-- Régua de Acolhimento Automatizada (Recepção Familiar)
-- =============================================================================
-- Dispara quando o lote público é Aprovado (status processed).
-- Dia 1: WhatsApp da equipe de boas-vindas
-- Dia 4: convite à célula mais próxima (CEP × anfitrião)
-- Dia 8: verificação de check-in no domingo subsequente
--         → com check-in: régua Concluído / integrado
--         → sem check-in: pendência urgente no painel pastoral
-- tenant_id sempre da linha/sessão — nunca do cliente.
-- Aplica: npx supabase db query --linked -f scripts/visitor-followup-regua.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.visitor_followup (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'Ativo'
    check (status in ('Ativo', 'Concluído', 'Interrompido')),
  data_aprovacao date not null default (timezone('America/Sao_Paulo', now()))::date,
  resultado text null
    check (resultado is null or resultado in ('integrado', 'sem_retorno')),
  recepcao_cadastro_familiar_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists visitor_followup_active_visitor_uq
  on public.visitor_followup (tenant_id, visitor_id)
  where status = 'Ativo';

create index if not exists visitor_followup_tenant_status_idx
  on public.visitor_followup (tenant_id, status, data_aprovacao);

comment on table public.visitor_followup is
  'Ciclo de acolhimento pós-aprovação na Recepção Familiar. Isolado por tenant_id.';
comment on column public.visitor_followup.visitor_id is
  'profiles.id gravado em applied_profile_id no processamento do cadastro público.';
comment on column public.visitor_followup.status is
  'Ativo | Concluído | Interrompido.';
comment on column public.visitor_followup.resultado is
  'integrado (check-in no período) ou sem_retorno (ligação pastoral no dia 8).';

create table if not exists public.task_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  followup_id uuid null references public.visitor_followup (id) on delete cascade,
  responsavel_cargo text not null
    check (responsavel_cargo in ('welcome_team', 'pastor', 'system')),
  tipo_tarefa text not null
    check (tipo_tarefa in (
      'whatsapp_dia_1',
      'convite_celula_dia_4',
      'ligacao_pastor_dia_8'
    )),
  data_programada date not null,
  status text not null default 'Pendente'
    check (status in ('Pendente', 'Concluído')),
  descricao text not null default '',
  completed_at timestamptz null,
  completed_by_profile_id uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists task_alerts_pending_tipo_uq
  on public.task_alerts (tenant_id, visitor_id, tipo_tarefa)
  where status = 'Pendente';

create index if not exists task_alerts_welcome_due_idx
  on public.task_alerts (tenant_id, responsavel_cargo, status, data_programada);

create index if not exists task_alerts_visitor_idx
  on public.task_alerts (tenant_id, visitor_id);

comment on table public.task_alerts is
  'Tarefas da régua de acolhimento (equipe de boas-vindas e pastor). Isolado por tenant_id.';

alter table public.visitor_followup enable row level security;
alter table public.task_alerts enable row level security;

drop policy if exists visitor_followup_deny_direct on public.visitor_followup;
create policy visitor_followup_deny_direct
  on public.visitor_followup for all using (false) with check (false);

drop policy if exists task_alerts_deny_direct on public.task_alerts;
create policy task_alerts_deny_direct
  on public.task_alerts for all using (false) with check (false);

revoke all on public.visitor_followup from anon, authenticated, public;
revoke all on public.task_alerts from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------

create or replace function public.visitor_followup_today()
returns date
language sql
stable
as $$
  select (timezone('America/Sao_Paulo', now()))::date;
$$;

create or replace function public.visitor_followup_next_sunday(p_from date)
returns date
language sql
immutable
as $$
  select p_from + ((7 - extract(dow from p_from)::int) % 7);
$$;

create or replace function public.visitor_followup_weekday_label(p_dow smallint)
returns text
language sql
immutable
as $$
  select case p_dow
    when 0 then 'domingo'
    when 1 then 'segunda-feira'
    when 2 then 'terça-feira'
    when 3 then 'quarta-feira'
    when 4 then 'quinta-feira'
    when 5 then 'sexta-feira'
    when 6 then 'sábado'
    else 'dia não informado'
  end;
$$;

create or replace function public.session_can_manage_visitor_followup_welcome()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.session_has_resource_access('screen', 'maintenance.card.visitor_followup', 'view')
    or public.session_has_resource_access('screen', 'maintenance.card.profile_cadastro', 'view'),
    false
  );
$$;

create or replace function public.session_can_manage_visitor_followup_pastor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.session_has_resource_access('screen', 'maintenance.card.pastoral_care', 'view')
    or public.profile_has_role_code(public.current_session_profile_id(), 'pastoral'),
    false
  );
$$;

-- Célula mais próxima do CEP informado (Haversine × anfitrião). Somente o tenant.
create or replace function public.resolve_nearest_small_group_for_cep(
  p_tenant uuid,
  p_cep text
)
returns table (
  group_id uuid,
  group_name text,
  meeting_weekday smallint,
  meeting_time text,
  host_name text,
  distance_meters int
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_digits text;
begin
  if p_tenant is null then
    return;
  end if;

  v_digits := regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');

  if length(v_digits) = 8 then
    select geo.latitude, geo.longitude
      into v_lat, v_lng
      from public.cep_geolocations geo
     where geo.cep_digits = v_digits;
  end if;

  return query
  select
    q.group_id,
    q.group_name,
    q.meeting_weekday,
    q.meeting_time,
    q.host_name,
    q.distance_meters
  from (
    select
      g.id as group_id,
      g.name as group_name,
      g.meeting_weekday,
      to_char(g.meeting_time, 'HH24:MI') as meeting_time,
      coalesce(h.full_name, '') as host_name,
      case
        when v_lat is not null
         and v_lng is not null
         and hgeo.latitude is not null
         and hgeo.longitude is not null
        then round(
          public.haversine_distance_meters(
            v_lat, v_lng, hgeo.latitude, hgeo.longitude
          )
        )::int
        else null
      end as distance_meters,
      case
        when v_lat is not null
         and v_lng is not null
         and hgeo.latitude is not null
         and hgeo.longitude is not null
        then public.haversine_distance_meters(
          v_lat, v_lng, hgeo.latitude, hgeo.longitude
        )
        else 1e12
      end as sort_distance
    from public.small_groups g
    join public.profiles h
      on h.id = g.host_profile_id
     and h.tenant_id = p_tenant
    left join public.cep_geolocations hgeo
      on length(regexp_replace(coalesce(h.cep, ''), '\D', '', 'g')) = 8
     and hgeo.cep_digits = regexp_replace(coalesce(h.cep, ''), '\D', '', 'g')
   where g.tenant_id = p_tenant
     and g.is_active
     and g.host_profile_id is not null
  ) q
  order by q.sort_distance nulls last, q.group_name
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Inicialização da régua (aprovação)
-- ---------------------------------------------------------------------------

create or replace function public.initialize_visitor_followup_regua(
  p_tenant_id uuid,
  p_visitor_id uuid,
  p_recepcao_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_followup_id uuid;
  v_aprovacao date := public.visitor_followup_today();
  v_day4 date;
  v_day8 date;
  v_full_name text;
  v_first text;
  v_phone text;
  v_cep text;
  v_group_id uuid;
  v_group_name text;
  v_weekday smallint;
  v_time text;
  v_host text;
  v_meters int;
  v_dist_label text;
  v_msg1 text;
  v_msg4 text;
  v_msg8 text;
begin
  if p_tenant_id is null or p_visitor_id is null then
    return null;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_visitor_id
       and p.tenant_id = p_tenant_id
  ) then
    return null;
  end if;

  select f.id
    into v_followup_id
    from public.visitor_followup f
   where f.tenant_id = p_tenant_id
     and f.visitor_id = p_visitor_id
     and f.status = 'Ativo'
   limit 1;

  if v_followup_id is not null then
    return v_followup_id;
  end if;

  select
    coalesce(nullif(trim(p.full_name), ''), 'visitante'),
    nullif(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(p.cep, ''), '\D', '', 'g'), '')
    into v_full_name, v_phone, v_cep
    from public.profiles p
   where p.id = p_visitor_id
     and p.tenant_id = p_tenant_id;

  v_first := split_part(v_full_name, ' ', 1);
  v_day4 := v_aprovacao + 4;
  v_day8 := public.visitor_followup_next_sunday(v_aprovacao + 8);

  select n.group_id, n.group_name, n.meeting_weekday, n.meeting_time, n.host_name, n.distance_meters
    into v_group_id, v_group_name, v_weekday, v_time, v_host, v_meters
    from public.resolve_nearest_small_group_for_cep(p_tenant_id, v_cep) n;

  if v_meters is null then
    v_dist_label := 'distância não calculada (CEP sem geolocalização)';
  elsif v_meters < 1000 then
    v_dist_label := format('%s m', v_meters);
  else
    v_dist_label := replace(trim(to_char(round(v_meters / 1000.0, 1), 'FM9990.0')), '.', ',') || ' km';
  end if;

  v_msg1 := format(
    'Olá, %s! Somos da equipe de boas-vindas. Que alegria receber você na nossa igreja! Estamos à disposição para o que precisar. Deus abençoe!',
    v_first
  );

  if v_group_name is not null then
    v_msg4 := format(
      'Olá, %s! Gostaríamos de convidar você para a célula %s, que se reúne %s às %s (cerca de %s). É um grupo próximo do seu endereço — será uma alegria te receber!',
      v_first,
      v_group_name,
      public.visitor_followup_weekday_label(v_weekday),
      coalesce(v_time, 'horário a confirmar'),
      v_dist_label
    );
  else
    v_msg4 := format(
      'Olá, %s! Gostaríamos de convidar você a conhecer uma de nossas células. Ainda não localizamos um grupo pelo CEP informado — a equipe indicará a célula mais adequada.',
      v_first
    );
  end if;

  v_msg8 := format(
    'Verificação automática de check-in (domingo %s). Se não houver culto confirmado no período, este alerta vira ligação urgente para o pastor.',
    to_char(v_day8, 'DD/MM/YYYY')
  );

  insert into public.visitor_followup (
    tenant_id,
    visitor_id,
    status,
    data_aprovacao,
    recepcao_cadastro_familiar_id
  ) values (
    p_tenant_id,
    p_visitor_id,
    'Ativo',
    v_aprovacao,
    p_recepcao_id
  )
  returning id into v_followup_id;

  insert into public.task_alerts (
    tenant_id, visitor_id, followup_id, responsavel_cargo, tipo_tarefa,
    data_programada, status, descricao
  ) values
    (
      p_tenant_id, p_visitor_id, v_followup_id, 'welcome_team', 'whatsapp_dia_1',
      v_aprovacao, 'Pendente', v_msg1
    ),
    (
      p_tenant_id, p_visitor_id, v_followup_id, 'welcome_team', 'convite_celula_dia_4',
      v_day4, 'Pendente', v_msg4
    ),
    (
      p_tenant_id, p_visitor_id, v_followup_id, 'system', 'ligacao_pastor_dia_8',
      v_day8, 'Pendente', v_msg8
    )
  on conflict do nothing;

  return v_followup_id;
exception
  when unique_violation then
    select f.id
      into v_followup_id
      from public.visitor_followup f
     where f.tenant_id = p_tenant_id
       and f.visitor_id = p_visitor_id
       and f.status = 'Ativo'
     limit 1;
    return v_followup_id;
end;
$$;

create or replace function public.trg_recepcao_start_visitor_followup()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.applied_profile_id is null or new.tenant_id is null then
    return new;
  end if;

  begin
    perform public.initialize_visitor_followup_regua(
      new.tenant_id,
      new.applied_profile_id,
      new.id
    );
  exception
    when others then
      raise warning 'Régua de acolhimento não iniciada (tenant %, visitor %): %',
        new.tenant_id, new.applied_profile_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_recepcao_start_visitor_followup on public.recepcao_cadastro_familiar;
create trigger trg_recepcao_start_visitor_followup
  after update of status on public.recepcao_cadastro_familiar
  for each row
  when (new.status = 'processed' and old.status is distinct from 'processed')
  execute function public.trg_recepcao_start_visitor_followup();

-- ---------------------------------------------------------------------------
-- 4) Rotina do dia 8 (check-in × alerta pastoral)
-- ---------------------------------------------------------------------------

create or replace function public.visitor_had_confirmed_checkin(
  p_tenant uuid,
  p_visitor_id uuid,
  p_from timestamptz,
  p_until timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_family text;
begin
  select nullif(trim(p.family_id), '')
    into v_family
    from public.profiles p
   where p.id = p_visitor_id
     and p.tenant_id = p_tenant;

  return exists (
    select 1
      from public.checkins c
     where c.status = 'confirmado'
       and c.timestamp_confirmacao is not null
       and c.timestamp_confirmacao >= p_from
       and c.timestamp_confirmacao < p_until
       and (c.tenant_id is null or c.tenant_id = p_tenant)
       and (
         c.profile_id = p_visitor_id
         or (v_family is not null and c.family_id = v_family)
       )
  );
end;
$$;

create or replace function public.dispatch_visitor_followup_day8_for_tenant(p_tenant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_today date := public.visitor_followup_today();
  v_row record;
  v_checked int := 0;
  v_integrated int := 0;
  v_escalated int := 0;
  v_from timestamptz;
  v_until timestamptz;
  v_name text;
  v_first text;
  v_phone text;
begin
  if p_tenant is null then
    return jsonb_build_object('success', false, 'message', 'tenant_id obrigatório.');
  end if;

  for v_row in
    select
      t.id as task_id,
      t.visitor_id,
      t.followup_id,
      f.data_aprovacao
      from public.task_alerts t
      join public.visitor_followup f
        on f.id = t.followup_id
       and f.tenant_id = t.tenant_id
     where t.tenant_id = p_tenant
       and t.tipo_tarefa = 'ligacao_pastor_dia_8'
       and t.status = 'Pendente'
       and t.responsavel_cargo = 'system'
       and t.data_programada <= v_today
       and f.status = 'Ativo'
  loop
    v_checked := v_checked + 1;
    v_from := timezone('America/Sao_Paulo', v_row.data_aprovacao::timestamp);
    v_until := timezone('America/Sao_Paulo', (v_today + 1)::timestamp);

    if public.visitor_had_confirmed_checkin(
      p_tenant, v_row.visitor_id, v_from, v_until
    ) then
      update public.visitor_followup
         set status = 'Concluído',
             resultado = 'integrado',
             updated_at = now()
       where id = v_row.followup_id
         and tenant_id = p_tenant;

      update public.task_alerts
         set status = 'Concluído',
             completed_at = now(),
             descricao = 'Régua encerrada: check-in confirmado no período. Visitante integrado.'
       where followup_id = v_row.followup_id
         and tenant_id = p_tenant
         and status = 'Pendente';

      v_integrated := v_integrated + 1;
    else
      select
        coalesce(nullif(trim(p.full_name), ''), 'Visitante'),
        nullif(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), '')
        into v_name, v_phone
        from public.profiles p
       where p.id = v_row.visitor_id
         and p.tenant_id = p_tenant;

      v_first := split_part(v_name, ' ', 1);

      update public.task_alerts
         set responsavel_cargo = 'pastor',
             descricao = format(
               'URGENTE: %s foi aprovado(a) em %s e não fez check-in em culto até o 8º dia. Ligar para acompanhar.%s',
               v_name,
               to_char(v_row.data_aprovacao, 'DD/MM/YYYY'),
               case
                 when v_phone is not null then format(' Telefone: %s.', v_phone)
                 else ' Telefone não informado.'
               end
             )
       where id = v_row.task_id
         and tenant_id = p_tenant;

      v_escalated := v_escalated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'checked', v_checked,
    'integrated', v_integrated,
    'escalated', v_escalated
  );
end;
$$;

-- Cron / superusuário: todos os tenants, sem sessão.
create or replace function public.dispatch_visitor_followup_day8()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_total_checked int := 0;
  v_total_integrated int := 0;
  v_total_escalated int := 0;
  v_part jsonb;
begin
  for v_tenant in
    select i.id from public.igrejas i
  loop
    v_part := public.dispatch_visitor_followup_day8_for_tenant(v_tenant);
    v_total_checked := v_total_checked + coalesce((v_part->>'checked')::int, 0);
    v_total_integrated := v_total_integrated + coalesce((v_part->>'integrated')::int, 0);
    v_total_escalated := v_total_escalated + coalesce((v_part->>'escalated')::int, 0);
  end loop;

  return jsonb_build_object(
    'success', true,
    'checked', v_total_checked,
    'integrated', v_total_integrated,
    'escalated', v_total_escalated
  );
end;
$$;

-- Pastor/sessão: só o tenant da sessão (também usado ao abrir o painel).
create or replace function public.dispatch_visitor_followup_day8_for_session()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_can_manage_visitor_followup_pastor() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão pastoral.');
  end if;

  return public.dispatch_visitor_followup_day8_for_tenant(v_tenant);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPCs de listagem / conclusão
-- ---------------------------------------------------------------------------

create or replace function public.list_welcome_visitor_followup_tasks()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_today date := public.visitor_followup_today();
begin
  if not public.session_can_manage_visitor_followup_welcome() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para a régua de acolhimento.');
  end if;

  return jsonb_build_object(
    'success', true,
    'tasks',
    coalesce(
      (
        select jsonb_agg(q.item order by q.data_programada, q.visitor_name)
        from (
          select
            jsonb_build_object(
              'id', t.id,
              'visitor_id', t.visitor_id,
              'visitor_name', coalesce(nullif(trim(p.full_name), ''), 'Visitante'),
              'phone', p.phone,
              'tipo_tarefa', t.tipo_tarefa,
              'data_programada', t.data_programada,
              'status', t.status,
              'descricao', t.descricao,
              'followup_status', f.status,
              'data_aprovacao', f.data_aprovacao
            ) as item,
            t.data_programada,
            coalesce(p.full_name, '') as visitor_name
          from public.task_alerts t
          join public.visitor_followup f
            on f.id = t.followup_id
           and f.tenant_id = t.tenant_id
          join public.profiles p
            on p.id = t.visitor_id
           and p.tenant_id = t.tenant_id
         where t.tenant_id = v_tenant
           and t.responsavel_cargo = 'welcome_team'
           and t.status = 'Pendente'
           and t.data_programada <= v_today
           and f.status = 'Ativo'
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.list_pastor_visitor_followup_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_can_manage_visitor_followup_pastor() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão pastoral.');
  end if;

  perform public.dispatch_visitor_followup_day8_for_tenant(v_tenant);

  return jsonb_build_object(
    'success', true,
    'alerts',
    coalesce(
      (
        select jsonb_agg(q.item order by q.data_programada, q.visitor_name)
        from (
          select
            jsonb_build_object(
              'id', t.id,
              'visitor_id', t.visitor_id,
              'visitor_name', coalesce(nullif(trim(p.full_name), ''), 'Visitante'),
              'phone', p.phone,
              'tipo_tarefa', t.tipo_tarefa,
              'data_programada', t.data_programada,
              'status', t.status,
              'descricao', t.descricao,
              'followup_status', f.status,
              'data_aprovacao', f.data_aprovacao,
              'resultado', f.resultado
            ) as item,
            t.data_programada,
            coalesce(p.full_name, '') as visitor_name
          from public.task_alerts t
          join public.visitor_followup f
            on f.id = t.followup_id
           and f.tenant_id = t.tenant_id
          join public.profiles p
            on p.id = t.visitor_id
           and p.tenant_id = t.tenant_id
         where t.tenant_id = v_tenant
           and t.responsavel_cargo = 'pastor'
           and t.status = 'Pendente'
           and f.status = 'Ativo'
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.complete_visitor_followup_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_task public.task_alerts%rowtype;
begin
  if p_task_id is null then
    return jsonb_build_object('success', false, 'message', 'Tarefa inválida.');
  end if;

  select *
    into v_task
    from public.task_alerts t
   where t.id = p_task_id
     and t.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Tarefa não encontrada.');
  end if;

  if v_task.responsavel_cargo = 'welcome_team'
     and not public.session_can_manage_visitor_followup_welcome() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para concluir esta tarefa.');
  end if;

  if v_task.responsavel_cargo = 'pastor'
     and not public.session_can_manage_visitor_followup_pastor() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão pastoral para concluir esta tarefa.');
  end if;

  if v_task.responsavel_cargo = 'system' then
    return jsonb_build_object('success', false, 'message', 'Esta verificação é automática.');
  end if;

  if v_task.status = 'Concluído' then
    return jsonb_build_object('success', true, 'message', 'Tarefa já estava concluída.');
  end if;

  update public.task_alerts
     set status = 'Concluído',
         completed_at = now(),
         completed_by_profile_id = v_actor
   where id = v_task.id
     and tenant_id = v_tenant;

  if v_task.tipo_tarefa = 'ligacao_pastor_dia_8' then
    update public.visitor_followup
       set status = 'Concluído',
           resultado = coalesce(resultado, 'sem_retorno'),
           updated_at = now()
     where id = v_task.followup_id
       and tenant_id = v_tenant
       and status = 'Ativo';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.list_welcome_visitor_followup_tasks() to anon, authenticated;
grant execute on function public.list_pastor_visitor_followup_alerts() to anon, authenticated;
grant execute on function public.complete_visitor_followup_task(uuid) to anon, authenticated;
grant execute on function public.dispatch_visitor_followup_day8_for_session() to anon, authenticated;

revoke all on function public.dispatch_visitor_followup_day8() from public, anon, authenticated;
revoke all on function public.dispatch_visitor_followup_day8_for_tenant(uuid) from public, anon, authenticated;
revoke all on function public.initialize_visitor_followup_regua(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_nearest_small_group_for_cep(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Cron (após cultos de domingo; ignora se pg_cron não existir)
--    Segunda 00:00 UTC = domingo 21:00 em America/Sao_Paulo.
-- ---------------------------------------------------------------------------

do $$
begin
  perform cron.schedule(
    'visitor-followup-day8-sunday',
    '0 0 * * 1',
    $cron$select public.dispatch_visitor_followup_day8();$cron$
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
-- 7) ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.card.visitor_followup',
    'Régua de Acolhimento',
    'Tarefas da equipe de boas-vindas (WhatsApp e convite à célula) após aprovação na Recepção Familiar.',
    true
  ),
  (
    'table',
    'visitor_followup',
    'Acompanhamento de visitantes',
    null,
    true
  ),
  (
    'table',
    'task_alerts',
    'Tarefas da régua de acolhimento',
    null,
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

-- Quem já opera Cadastro / Recepção Familiar herda o painel da equipe.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select g.role_id, dest.id, g.can_view, g.can_update
  from public.access_resources dest
  join public.access_resources src
    on src.resource_type = 'screen'
   and src.resource_key = 'maintenance.card.profile_cadastro'
  join public.access_grants g
    on g.resource_id = src.id
 where dest.resource_type = 'screen'
   and dest.resource_key = 'maintenance.card.visitor_followup'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.visitor_followup'
 where r.code in ('super_admin', 'pastoral', 'lider', 'lider_geral', 'family_acceptor')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
