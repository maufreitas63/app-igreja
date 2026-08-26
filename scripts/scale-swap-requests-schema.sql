-- Gestão de Trocas em Escalas de Voluntários (tenant-aware).
-- Substitui apenas a linha pontual de escalas_log — não regenera o ciclo em bloco.

alter table public.tipos_escala
  add column if not exists allow_swap boolean not null default true;

create table if not exists public.scale_swap_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  escala_id_origem uuid references public.escalas_log(id) on delete set null,
  tipo_escala_id uuid not null references public.tipos_escala(id) on delete cascade,
  data_servico date not null,
  solicitante_profile_id uuid not null references public.profiles(id) on delete cascade,
  substituto_profile_id uuid references public.profiles(id) on delete set null,
  voluntario_id_origem uuid references public.voluntarios_escala(id) on delete set null,
  voluntario_id_substituto uuid references public.voluntarios_escala(id) on delete set null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito', 'recusado', 'cancelado', 'desfeito')),
  motivo text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  undone_at timestamptz,
  undone_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scale_swap_requests_tenant_status
  on public.scale_swap_requests (tenant_id, status, created_at desc);
create index if not exists idx_scale_swap_requests_origem
  on public.scale_swap_requests (escala_id_origem) where escala_id_origem is not null;
create index if not exists idx_scale_swap_requests_solicitante
  on public.scale_swap_requests (tenant_id, solicitante_profile_id, created_at desc);
create index if not exists idx_scale_swap_requests_substituto
  on public.scale_swap_requests (tenant_id, substituto_profile_id, created_at desc);

create unique index if not exists uq_scale_swap_pending_origem
  on public.scale_swap_requests (escala_id_origem)
  where status = 'pendente' and escala_id_origem is not null;

create table if not exists public.scale_swap_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.scale_swap_requests(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_scale_swap_notices_unread
  on public.scale_swap_notices (tenant_id, profile_id, created_at desc)
  where read_at is null;

create table if not exists public.scale_swap_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  request_id uuid not null references public.scale_swap_requests(id) on delete cascade,
  escala_id_origem uuid,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  from_voluntario_id uuid,
  to_voluntario_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_scale_swap_audit_tenant
  on public.scale_swap_audit (tenant_id, created_at desc);

alter table public.scale_swap_requests enable row level security;
alter table public.scale_swap_notices enable row level security;
alter table public.scale_swap_audit enable row level security;

drop policy if exists scale_swap_requests_deny_direct on public.scale_swap_requests;
create policy scale_swap_requests_deny_direct
  on public.scale_swap_requests for all using (false) with check (false);

drop policy if exists scale_swap_notices_deny_direct on public.scale_swap_notices;
create policy scale_swap_notices_deny_direct
  on public.scale_swap_notices for all using (false) with check (false);

drop policy if exists scale_swap_audit_deny_direct on public.scale_swap_audit;
create policy scale_swap_audit_deny_direct
  on public.scale_swap_audit for all using (false) with check (false);

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'scales.allow_swap',
    'Escalas — Solicitar troca autônoma',
    'Permite ao servo pedir substituição pontual com outro voluntário do mesmo tipo.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code in ('super_admin', 'lider', 'lider_geral', 'pastoral', 'gestor_controle_acesso')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'scales.allow_swap'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado',
   'tesoureiro', 'kids_checkin', 'estacionamento', 'gestor_controle_acesso'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
create or replace function public.scale_swap_volunteer_id_for_profile(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_tipo_escala_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_id uuid;
begin
  select trim(coalesce(p.full_name, ''))
    into v_name
    from public.profiles p
   where p.id = p_profile_id
     and p.tenant_id = p_tenant_id;

  if v_name is null or v_name = '' then
    return null;
  end if;

  select ve.id
    into v_id
    from public.voluntarios_escala ve
   where ve.tenant_id = p_tenant_id
     and ve.tipo_escala_id = p_tipo_escala_id
     and ve.is_ativo is true
     and public.unaccent(lower(regexp_replace(trim(coalesce(ve.nome, '')), '\s+', ' ', 'g')))
         = public.unaccent(lower(regexp_replace(v_name, '\s+', ' ', 'g')))
   limit 1;

  return v_id;
end;
$$;

create or replace function public.scale_swap_can_member()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
begin
  if v_profile is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_profile) then
    return true;
  end if;
  return public.profile_has_access(v_profile, 'screen', 'scales.allow_swap', 'view');
end;
$$;

create or replace function public.scale_swap_can_lead()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
begin
  if v_profile is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_profile) then
    return true;
  end if;
  return public.profile_has_access(v_profile, 'screen', 'maintenance.card.scales', 'update')
      or public.profile_has_access(v_profile, 'screen', 'maintenance.card.scales', 'view');
end;
$$;

create or replace function public.scale_swap_insert_notice(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_request_id uuid,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    return;
  end if;
  insert into public.scale_swap_notices (tenant_id, profile_id, request_id, title, body)
  values (p_tenant_id, p_profile_id, p_request_id, p_title, p_body);
end;
$$;

create or replace function public.scale_swap_insert_audit(
  p_tenant_id uuid,
  p_request_id uuid,
  p_escala_id uuid,
  p_actor uuid,
  p_action text,
  p_from uuid,
  p_to uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scale_swap_audit (
    tenant_id, request_id, escala_id_origem, actor_profile_id, action,
    from_voluntario_id, to_voluntario_id, details
  ) values (
    p_tenant_id, p_request_id, p_escala_id, p_actor, p_action, p_from, p_to, coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.list_scale_swap_candidates(p_escala_log_id uuid)
returns table (
  profile_id uuid,
  volunteer_id uuid,
  volunteer_name text,
  phone text,
  already_scheduled boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_log public.escalas_log%rowtype;
  v_allow boolean;
  v_my_vol uuid;
begin
  if v_me is null or not public.scale_swap_can_member() then
    return;
  end if;

  select * into v_log
    from public.escalas_log el
   where el.id = p_escala_log_id
     and el.tenant_id = v_tenant;

  if not found then
    return;
  end if;

  select coalesce(te.allow_swap, true) into v_allow
    from public.tipos_escala te
   where te.id = v_log.tipo_escala_id
     and te.tenant_id = v_tenant;

  if v_allow is not true then
    return;
  end if;

  v_my_vol := public.scale_swap_volunteer_id_for_profile(v_tenant, v_me, v_log.tipo_escala_id);
  if v_my_vol is null or v_my_vol is distinct from v_log.voluntario_id then
    if not public.scale_swap_can_lead() then
      return;
    end if;
  end if;

  return query
  select
    p.id,
    ve.id,
    ve.nome,
    p.phone,
    exists (
      select 1
        from public.escalas_log busy
       where busy.tenant_id = v_tenant
         and busy.data_servico = v_log.data_servico
         and busy.voluntario_id = ve.id
    ) as already_scheduled
    from public.voluntarios_escala ve
    join public.profiles p
      on p.tenant_id = v_tenant
     and p.status = 'approved'
     and public.unaccent(lower(regexp_replace(trim(coalesce(p.full_name, '')), '\s+', ' ', 'g')))
         = public.unaccent(lower(regexp_replace(trim(coalesce(ve.nome, '')), '\s+', ' ', 'g')))
   where ve.tenant_id = v_tenant
     and ve.tipo_escala_id = v_log.tipo_escala_id
     and ve.is_ativo is true
     and ve.id is distinct from v_log.voluntario_id
     and p.id is distinct from v_me
     -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
     and public.profile_visible_to_access_actor(v_me, p.id)
   order by ve.ordem_sequencial, ve.nome;
end;
$$;

create or replace function public.create_scale_swap_request(
  p_escala_log_id uuid,
  p_substituto_profile_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_log public.escalas_log%rowtype;
  v_allow boolean;
  v_my_vol uuid;
  v_sub_vol uuid;
  v_id uuid;
  v_me_name text;
  v_type_name text;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.scale_swap_can_member() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para solicitar troca nesta escala.');
  end if;
  if p_substituto_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Selecione um substituto.');
  end if;
  if p_substituto_profile_id = v_me then
    return jsonb_build_object('success', false, 'message', 'Não é possível trocar consigo mesmo.');
  end if;

  select * into v_log
    from public.escalas_log el
   where el.id = p_escala_log_id
     and el.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Escala de origem não encontrada.');
  end if;

  if v_log.data_servico < (timezone('America/Sao_Paulo', now()))::date then
    return jsonb_build_object('success', false, 'message', 'Não é possível trocar uma escala já realizada.');
  end if;

  select coalesce(te.allow_swap, true), te.nome
    into v_allow, v_type_name
    from public.tipos_escala te
   where te.id = v_log.tipo_escala_id
     and te.tenant_id = v_tenant;

  if v_allow is not true then
    return jsonb_build_object('success', false, 'message', 'Esta escala não permite troca autônoma.');
  end if;

  v_my_vol := public.scale_swap_volunteer_id_for_profile(v_tenant, v_me, v_log.tipo_escala_id);
  if v_my_vol is null or v_my_vol is distinct from v_log.voluntario_id then
    return jsonb_build_object('success', false, 'message', 'Só o servo escalado nesta data pode solicitar a troca.');
  end if;

  v_sub_vol := public.scale_swap_volunteer_id_for_profile(v_tenant, p_substituto_profile_id, v_log.tipo_escala_id);
  if v_sub_vol is null then
    return jsonb_build_object('success', false, 'message', 'O substituto precisa ser do mesmo tipo de escala.');
  end if;

  if exists (
    select 1 from public.escalas_log busy
     where busy.tenant_id = v_tenant
       and busy.data_servico = v_log.data_servico
       and busy.voluntario_id = v_sub_vol
  ) then
    return jsonb_build_object('success', false, 'message', 'Este servo já está escalado nesta data.');
  end if;

  if exists (
    select 1 from public.scale_swap_requests r
     where r.tenant_id = v_tenant
       and r.escala_id_origem = v_log.id
       and r.status = 'pendente'
  ) then
    return jsonb_build_object('success', false, 'message', 'Já existe um pedido de troca pendente para esta data.');
  end if;

  insert into public.scale_swap_requests (
    tenant_id, escala_id_origem, tipo_escala_id, data_servico,
    solicitante_profile_id, substituto_profile_id,
    voluntario_id_origem, voluntario_id_substituto, status, motivo
  ) values (
    v_tenant, v_log.id, v_log.tipo_escala_id, v_log.data_servico,
    v_me, p_substituto_profile_id,
    v_log.voluntario_id, v_sub_vol, 'pendente', nullif(trim(coalesce(p_motivo, '')), '')
  )
  returning id into v_id;

  select trim(coalesce(full_name, 'Um servo')) into v_me_name
    from public.profiles where id = v_me;

  perform public.scale_swap_insert_notice(
    v_tenant,
    p_substituto_profile_id,
    v_id,
    'Pedido de troca de escala',
    v_me_name || ' pediu para você cobrir ' || coalesce(v_type_name, 'a escala')
      || ' em ' || to_char(v_log.data_servico, 'DD/MM/YYYY') || '.'
  );
  perform public.scale_swap_insert_audit(
    v_tenant, v_id, v_log.id, v_me, 'solicitado', v_log.voluntario_id, v_sub_vol,
    jsonb_build_object('motivo', nullif(trim(coalesce(p_motivo, '')), ''))
  );

  return jsonb_build_object('success', true, 'id', v_id, 'message', 'Proposta enviada.');
end;
$$;

create or replace function public.list_my_scale_swaps()
returns table (
  id uuid,
  escala_id_origem uuid,
  tipo_escala_id uuid,
  tipo_nome text,
  data_servico date,
  solicitante_profile_id uuid,
  solicitante_nome text,
  substituto_profile_id uuid,
  substituto_nome text,
  status text,
  motivo text,
  direction text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return;
  end if;

  return query
  select
    r.id,
    r.escala_id_origem,
    r.tipo_escala_id,
    te.nome,
    r.data_servico,
    r.solicitante_profile_id,
    sp.full_name,
    r.substituto_profile_id,
    subp.full_name,
    r.status,
    r.motivo,
    case
      when r.solicitante_profile_id = v_me then 'enviado'
      else 'recebido'
    end,
    r.created_at,
    r.resolved_at
    from public.scale_swap_requests r
    join public.tipos_escala te on te.id = r.tipo_escala_id
    join public.profiles sp on sp.id = r.solicitante_profile_id
    left join public.profiles subp on subp.id = r.substituto_profile_id
   where r.tenant_id = v_tenant
     and (r.solicitante_profile_id = v_me or r.substituto_profile_id = v_me)
   order by r.created_at desc
   limit 80;
end;
$$;

create or replace function public.respond_scale_swap(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_req public.scale_swap_requests%rowtype;
  v_log public.escalas_log%rowtype;
  v_sub_vol uuid;
  v_type_name text;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  select * into v_req
    from public.scale_swap_requests r
   where r.id = p_id
     and r.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;
  if v_req.status is distinct from 'pendente' then
    return jsonb_build_object('success', false, 'message', 'Este pedido já foi resolvido.');
  end if;
  if v_req.substituto_profile_id is distinct from v_me then
    return jsonb_build_object('success', false, 'message', 'Só o substituto pode responder este pedido.');
  end if;

  if p_accept is not true then
    update public.scale_swap_requests
       set status = 'recusado',
           resolved_at = now(),
           resolved_by = v_me,
           updated_at = now()
     where id = v_req.id;
    perform public.scale_swap_insert_notice(
      v_tenant, v_req.solicitante_profile_id, v_req.id,
      'Troca recusada',
      'Seu pedido de troca foi recusado.'
    );
    perform public.scale_swap_insert_audit(
      v_tenant, v_req.id, v_req.escala_id_origem, v_me, 'recusado',
      v_req.voluntario_id_origem, v_req.voluntario_id_substituto, '{}'::jsonb
    );
    return jsonb_build_object('success', true, 'message', 'Pedido recusado.');
  end if;

  if v_req.escala_id_origem is null then
    update public.scale_swap_requests
       set status = 'cancelado',
           resolved_at = now(),
           resolved_by = v_me,
           updated_at = now()
     where id = v_req.id;
    perform public.scale_swap_insert_audit(
      v_tenant, v_req.id, v_req.escala_id_origem, v_me, 'cancelado',
      v_req.voluntario_id_origem, v_req.voluntario_id_substituto, '{}'::jsonb
    );
    return jsonb_build_object('success', false, 'message', 'A escala de origem não existe mais.');
  end if;

  select * into v_log
    from public.escalas_log el
   where el.id = v_req.escala_id_origem
     and el.tenant_id = v_tenant
   for update;

  if not found then
    update public.scale_swap_requests
       set status = 'cancelado',
           resolved_at = now(),
           resolved_by = v_me,
           updated_at = now()
     where id = v_req.id;
    perform public.scale_swap_insert_audit(
      v_tenant, v_req.id, v_req.escala_id_origem, v_me, 'cancelado',
      v_req.voluntario_id_origem, v_req.voluntario_id_substituto, '{}'::jsonb
    );
    return jsonb_build_object('success', false, 'message', 'A escala de origem não existe mais.');
  end if;

  if v_log.voluntario_id is distinct from v_req.voluntario_id_origem then
    update public.scale_swap_requests
       set status = 'cancelado',
           resolved_at = now(),
           resolved_by = v_me,
           updated_at = now()
     where id = v_req.id;
    perform public.scale_swap_insert_notice(
      v_tenant, v_req.solicitante_profile_id, v_req.id,
      'Troca cancelada',
      'A escala original já foi alterada. O pedido foi cancelado.'
    );
    perform public.scale_swap_insert_audit(
      v_tenant, v_req.id, v_req.escala_id_origem, v_me, 'cancelado',
      v_req.voluntario_id_origem, v_req.voluntario_id_substituto, '{}'::jsonb
    );
    return jsonb_build_object('success', false, 'message', 'A escala original já foi alterada. O pedido foi cancelado.');
  end if;

  v_sub_vol := public.scale_swap_volunteer_id_for_profile(v_tenant, v_me, v_log.tipo_escala_id);
  if v_sub_vol is null or v_sub_vol is distinct from v_req.voluntario_id_substituto then
    return jsonb_build_object('success', false, 'message', 'O substituto precisa ser do mesmo tipo de escala.');
  end if;

  if exists (
    select 1 from public.escalas_log busy
     where busy.tenant_id = v_tenant
       and busy.data_servico = v_log.data_servico
       and busy.voluntario_id = v_sub_vol
       and busy.id is distinct from v_log.id
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Você já possui outra escala nesta data. O aceite foi bloqueado.'
    );
  end if;

  begin
    update public.escalas_log
       set voluntario_id = v_sub_vol
     where id = v_log.id
       and tenant_id = v_tenant;
  exception
    when unique_violation then
      return jsonb_build_object(
        'success', false,
        'message', 'Você já possui outra escala nesta data. O aceite foi bloqueado.'
      );
  end;

  update public.scale_swap_requests
     set status = 'aceito',
         resolved_at = now(),
         resolved_by = v_me,
         updated_at = now()
   where id = v_req.id;

  select te.nome into v_type_name
    from public.tipos_escala te
   where te.id = v_log.tipo_escala_id;

  perform public.scale_swap_insert_notice(
    v_tenant, v_req.solicitante_profile_id, v_req.id,
    'Troca aceita',
    'Sua troca em ' || coalesce(v_type_name, 'escala') || ' (' || to_char(v_log.data_servico, 'DD/MM/YYYY') || ') foi aceita.'
  );
  perform public.scale_swap_insert_audit(
    v_tenant, v_req.id, v_log.id, v_me, 'aceito',
    v_req.voluntario_id_origem, v_sub_vol,
    jsonb_build_object('data_servico', v_log.data_servico)
  );

  return jsonb_build_object('success', true, 'message', 'Troca confirmada. A escala desta data foi atualizada.');
end;
$$;

create or replace function public.cancel_scale_swap(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_req public.scale_swap_requests%rowtype;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  select * into v_req
    from public.scale_swap_requests r
   where r.id = p_id and r.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;
  if v_req.status is distinct from 'pendente' then
    return jsonb_build_object('success', false, 'message', 'Só é possível cancelar pedidos pendentes.');
  end if;
  if v_req.solicitante_profile_id is distinct from v_me and not public.scale_swap_can_lead() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para cancelar este pedido.');
  end if;

  update public.scale_swap_requests
     set status = 'cancelado',
         resolved_at = now(),
         resolved_by = v_me,
         updated_at = now()
   where id = v_req.id;

  if v_req.substituto_profile_id is not null then
    perform public.scale_swap_insert_notice(
      v_tenant, v_req.substituto_profile_id, v_req.id,
      'Troca cancelada',
      'O pedido de troca foi cancelado.'
    );
  end if;
  perform public.scale_swap_insert_audit(
    v_tenant, v_req.id, v_req.escala_id_origem, v_me, 'cancelado',
    v_req.voluntario_id_origem, v_req.voluntario_id_substituto, '{}'::jsonb
  );

  return jsonb_build_object('success', true, 'message', 'Pedido cancelado.');
end;
$$;

create or replace function public.undo_scale_swap(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_req public.scale_swap_requests%rowtype;
  v_log public.escalas_log%rowtype;
begin
  if v_me is null or not public.scale_swap_can_lead() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para desfazer a troca.');
  end if;

  select * into v_req
    from public.scale_swap_requests r
   where r.id = p_id and r.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;
  if v_req.status is distinct from 'aceito' then
    return jsonb_build_object('success', false, 'message', 'Só é possível desfazer uma troca aceita.');
  end if;
  if v_req.escala_id_origem is null or v_req.voluntario_id_origem is null then
    return jsonb_build_object('success', false, 'message', 'Não há como restaurar a escala original.');
  end if;

  select * into v_log
    from public.escalas_log el
   where el.id = v_req.escala_id_origem and el.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'A escala de origem não existe mais.');
  end if;

  if v_log.voluntario_id is distinct from v_req.voluntario_id_substituto then
    return jsonb_build_object(
      'success', false,
      'message', 'A escala já foi alterada depois desta troca. Não é possível desfazer.'
    );
  end if;

  if exists (
    select 1 from public.escalas_log busy
     where busy.tenant_id = v_tenant
       and busy.data_servico = v_log.data_servico
       and busy.voluntario_id = v_req.voluntario_id_origem
       and busy.id is distinct from v_log.id
  ) then
    return jsonb_build_object('success', false, 'message', 'O servo original já está em outra escala nesta data.');
  end if;

  update public.escalas_log
     set voluntario_id = v_req.voluntario_id_origem
   where id = v_log.id and tenant_id = v_tenant;

  update public.scale_swap_requests
     set status = 'desfeito',
         undone_at = now(),
         undone_by = v_me,
         updated_at = now()
   where id = v_req.id;

  perform public.scale_swap_insert_notice(
    v_tenant, v_req.solicitante_profile_id, v_req.id,
    'Troca desfeita pela liderança',
    'A liderança restaurou a escala original desta data.'
  );
  if v_req.substituto_profile_id is not null then
    perform public.scale_swap_insert_notice(
      v_tenant, v_req.substituto_profile_id, v_req.id,
      'Troca desfeita pela liderança',
      'A liderança restaurou a escala original desta data.'
    );
  end if;
  perform public.scale_swap_insert_audit(
    v_tenant, v_req.id, v_log.id, v_me, 'desfeito',
    v_req.voluntario_id_substituto, v_req.voluntario_id_origem, '{}'::jsonb
  );

  return jsonb_build_object('success', true, 'message', 'Troca desfeita. A escala original foi restaurada.');
end;
$$;

create or replace function public.leader_force_scale_swap(
  p_escala_log_id uuid,
  p_substituto_profile_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_log public.escalas_log%rowtype;
  v_from uuid;
  v_to uuid;
  v_solicitante uuid;
  v_id uuid;
  v_type_name text;
  v_pending public.scale_swap_requests%rowtype;
begin
  if v_me is null or not public.scale_swap_can_lead() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para intervir na escala.');
  end if;
  if p_substituto_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Selecione o substituto.');
  end if;

  select * into v_log
    from public.escalas_log el
   where el.id = p_escala_log_id and el.tenant_id = v_tenant
   for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Escala não encontrada.');
  end if;

  v_from := v_log.voluntario_id;
  v_to := public.scale_swap_volunteer_id_for_profile(v_tenant, p_substituto_profile_id, v_log.tipo_escala_id);
  if v_to is null then
    return jsonb_build_object('success', false, 'message', 'O substituto precisa ser do mesmo tipo de escala.');
  end if;
  if v_to = v_from then
    return jsonb_build_object('success', false, 'message', 'O substituto já é o servo desta data.');
  end if;

  if exists (
    select 1 from public.escalas_log busy
     where busy.tenant_id = v_tenant
       and busy.data_servico = v_log.data_servico
       and busy.voluntario_id = v_to
       and busy.id is distinct from v_log.id
  ) then
    return jsonb_build_object('success', false, 'message', 'O substituto já possui escala nesta data.');
  end if;

  select p.id into v_solicitante
    from public.profiles p
    join public.voluntarios_escala ve on ve.id = v_from
   where p.tenant_id = v_tenant
     and public.unaccent(lower(regexp_replace(trim(coalesce(p.full_name, '')), '\s+', ' ', 'g')))
         = public.unaccent(lower(regexp_replace(trim(coalesce(ve.nome, '')), '\s+', ' ', 'g')))
   limit 1;

  begin
    update public.escalas_log
       set voluntario_id = v_to
     where id = v_log.id and tenant_id = v_tenant;
  exception
    when unique_violation then
      return jsonb_build_object('success', false, 'message', 'O substituto já possui escala nesta data.');
  end;

  for v_pending in
    select *
      from public.scale_swap_requests r
     where r.tenant_id = v_tenant
       and r.escala_id_origem = v_log.id
       and r.status = 'pendente'
     for update
  loop
    update public.scale_swap_requests
       set status = 'cancelado',
           resolved_at = now(),
           resolved_by = v_me,
           updated_at = now()
     where id = v_pending.id;

    perform public.scale_swap_insert_notice(
      v_tenant, v_pending.solicitante_profile_id, v_pending.id,
      'Troca cancelada',
      'A liderança alterou esta escala. O pedido pendente foi cancelado.'
    );
    if v_pending.substituto_profile_id is not null then
      perform public.scale_swap_insert_notice(
        v_tenant, v_pending.substituto_profile_id, v_pending.id,
        'Troca cancelada',
        'A liderança alterou esta escala. O pedido pendente foi cancelado.'
      );
    end if;
    perform public.scale_swap_insert_audit(
      v_tenant, v_pending.id, v_log.id, v_me, 'cancelado',
      v_pending.voluntario_id_origem, v_pending.voluntario_id_substituto, '{}'::jsonb
    );
  end loop;

  insert into public.scale_swap_requests (
    tenant_id, escala_id_origem, tipo_escala_id, data_servico,
    solicitante_profile_id, substituto_profile_id,
    voluntario_id_origem, voluntario_id_substituto,
    status, motivo, resolved_at, resolved_by
  ) values (
    v_tenant, v_log.id, v_log.tipo_escala_id, v_log.data_servico,
    coalesce(v_solicitante, v_me), p_substituto_profile_id,
    v_from, v_to,
    'aceito',
    coalesce(nullif(trim(coalesce(p_motivo, '')), ''), 'Intervenção da liderança'),
    now(), v_me
  )
  returning id into v_id;

  select te.nome into v_type_name from public.tipos_escala te where te.id = v_log.tipo_escala_id;

  if v_solicitante is not null then
    perform public.scale_swap_insert_notice(
      v_tenant, v_solicitante, v_id,
      'Troca feita pela liderança',
      'A liderança substituiu você em ' || coalesce(v_type_name, 'escala')
        || ' (' || to_char(v_log.data_servico, 'DD/MM/YYYY') || ').'
    );
  end if;
  perform public.scale_swap_insert_notice(
    v_tenant, p_substituto_profile_id, v_id,
    'Você foi escalado pela liderança',
    'A liderança atribuiu a você ' || coalesce(v_type_name, 'a escala')
      || ' em ' || to_char(v_log.data_servico, 'DD/MM/YYYY') || '.'
  );
  perform public.scale_swap_insert_audit(
    v_tenant, v_id, v_log.id, v_me, 'intervencao', v_from, v_to,
    jsonb_build_object('motivo', coalesce(nullif(trim(coalesce(p_motivo, '')), ''), 'Intervenção da liderança'))
  );

  return jsonb_build_object('success', true, 'id', v_id, 'message', 'Substituição aplicada nesta data.');
end;
$$;

create or replace function public.list_scale_swaps_admin(p_tipo_escala_id uuid default null)
returns table (
  id uuid,
  escala_id_origem uuid,
  tipo_escala_id uuid,
  tipo_nome text,
  data_servico date,
  solicitante_nome text,
  substituto_nome text,
  status text,
  motivo text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.scale_swap_can_lead() then
    return;
  end if;

  return query
  select
    r.id,
    r.escala_id_origem,
    r.tipo_escala_id,
    te.nome,
    r.data_servico,
    sp.full_name,
    subp.full_name,
    r.status,
    r.motivo,
    r.created_at,
    r.resolved_at
    from public.scale_swap_requests r
    join public.tipos_escala te on te.id = r.tipo_escala_id
    join public.profiles sp on sp.id = r.solicitante_profile_id
    left join public.profiles subp on subp.id = r.substituto_profile_id
   where r.tenant_id = v_tenant
     and (p_tipo_escala_id is null or r.tipo_escala_id = p_tipo_escala_id)
   order by r.created_at desc
   limit 200;
end;
$$;

create or replace function public.list_unread_scale_swap_notices()
returns table (
  id uuid,
  request_id uuid,
  title text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return;
  end if;
  return query
  select n.id, n.request_id, n.title, n.body, n.created_at
    from public.scale_swap_notices n
   where n.tenant_id = v_tenant
     and n.profile_id = v_me
     and n.read_at is null
   order by n.created_at desc
   limit 30;
end;
$$;

create or replace function public.mark_scale_swap_notices_read()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('success', false);
  end if;
  update public.scale_swap_notices
     set read_at = now()
   where tenant_id = v_tenant
     and profile_id = v_me
     and read_at is null;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.set_tipo_escala_allow_swap(p_id uuid, p_allow boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.is_super_admin_profile(v_me)
     and not public.profile_has_access(v_me, 'screen', 'maintenance.card.scale_types', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar tipos de escala.');
  end if;

  update public.tipos_escala
     set allow_swap = coalesce(p_allow, true),
         updated_at = now()
   where id = p_id
     and tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;
  return jsonb_build_object('success', true, 'message', 'Permissão de troca atualizada.');
end;
$$;

drop function if exists public.listar_tipos_escala_manutencao();
create or replace function public.listar_tipos_escala_manutencao()
returns table (
  id uuid,
  codigo text,
  nome text,
  is_ativa boolean,
  vagas_por_servico integer,
  modo_ciclo text,
  allow_swap boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile_id uuid;
begin
  v_profile_id := public.current_session_profile_id();

  if public.is_super_admin_profile(v_profile_id)
     or public.profile_has_access(v_profile_id, 'screen', 'maintenance.card.scale_types', 'view') then
    return query
    select
      te.id,
      te.codigo,
      te.nome,
      te.is_ativa,
      coalesce(te.vagas_por_servico, 1),
      coalesce(te.modo_ciclo, 'individual'),
      coalesce(te.allow_swap, true),
      te.created_at,
      te.updated_at
      from public.tipos_escala te
     where te.tenant_id = v_tenant
     order by te.is_ativa desc, te.nome asc;
    return;
  end if;

  return;
end;
$$;

revoke all on function public.scale_swap_volunteer_id_for_profile(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.scale_swap_insert_notice(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.scale_swap_insert_audit(uuid, uuid, uuid, uuid, text, uuid, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.scale_swap_can_member() to anon, authenticated, service_role;
grant execute on function public.scale_swap_can_lead() to anon, authenticated, service_role;
grant execute on function public.list_scale_swap_candidates(uuid) to anon, authenticated, service_role;
grant execute on function public.create_scale_swap_request(uuid, uuid, text) to anon, authenticated, service_role;
grant execute on function public.list_my_scale_swaps() to anon, authenticated, service_role;
grant execute on function public.respond_scale_swap(uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.cancel_scale_swap(uuid) to anon, authenticated, service_role;
grant execute on function public.undo_scale_swap(uuid) to anon, authenticated, service_role;
grant execute on function public.leader_force_scale_swap(uuid, uuid, text) to anon, authenticated, service_role;
grant execute on function public.list_scale_swaps_admin(uuid) to anon, authenticated, service_role;
grant execute on function public.list_unread_scale_swap_notices() to anon, authenticated, service_role;
grant execute on function public.mark_scale_swap_notices_read() to anon, authenticated, service_role;
grant execute on function public.set_tipo_escala_allow_swap(uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.listar_tipos_escala_manutencao() to anon, authenticated, service_role;

-- Pedidos que diziam "cancelado" na mensagem mas continuavam pendentes.
update public.scale_swap_requests r
   set status = 'cancelado',
       resolved_at = coalesce(r.resolved_at, now()),
       updated_at = now()
 where r.status = 'pendente'
   and (
     r.escala_id_origem is null
     or not exists (
       select 1 from public.escalas_log el where el.id = r.escala_id_origem
     )
     or exists (
       select 1 from public.escalas_log el
        where el.id = r.escala_id_origem
          and el.voluntario_id is distinct from r.voluntario_id_origem
     )
   );

notify pgrst, 'reload schema';
