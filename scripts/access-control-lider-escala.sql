-- Papel Líder: gerencia voluntários e programação de tipos de escala específicos.
-- Execute no SQL Editor do Supabase após access-control-schema.sql e vigilancia-escalas.sql.
--
-- Inclui: recursos ACL, papel lider, vínculo profile_scale_leadership, RPCs admin,
-- filtro listar_tipos_escala_permitidos e enforcement nas RPCs de escala.

-- ---------------------------------------------------------------------------
-- Recursos e papel
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values (
  'lider',
  'Líder',
  'Gerencia servos e programação de tipos de escala atribuídos ao perfil',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

insert into public.access_resources (resource_type, resource_key, label, description)
values
  ('screen', 'maintenance.card.scale_types', 'Manutenção: Tipos de Escala', 'Criar/editar tipos (super_admin ou grant explícito)'),
  ('screen', 'maintenance.card.scale_volunteers', 'Manutenção: Servos em Disponibilidade', null),
  ('screen', 'maintenance.card.scales', 'Manutenção: Programação de Escalas', null),
  ('table', 'tipos_escala', 'Tipos de escala', null),
  ('table', 'voluntarios_escala', 'Voluntários de escala', null),
  ('table', 'escalas_log', 'Registro de escalas', null)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

create table if not exists public.profile_scale_leadership (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tipo_escala_id uuid not null references public.tipos_escala (id) on delete cascade,
  granted_by_profile_id uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profile_id, tipo_escala_id)
);

create index if not exists idx_profile_scale_leadership_tipo
  on public.profile_scale_leadership (tipo_escala_id);

-- ---------------------------------------------------------------------------
-- Helpers ACL escala
-- ---------------------------------------------------------------------------

create or replace function public.scale_type_resource_key(p_codigo text)
returns text
language sql
immutable
as $$
  select 'scale_type.' || lower(trim(coalesce(p_codigo, '')));
$$;

create or replace function public.sync_scale_type_access_resource(
  p_codigo text,
  p_nome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_key text;
begin
  v_codigo := lower(trim(coalesce(p_codigo, '')));

  if v_codigo = '' then
    return;
  end if;

  v_key := public.scale_type_resource_key(v_codigo);

  insert into public.access_resources (resource_type, resource_key, label, description)
  values (
    'screen',
    v_key,
    'Escala: ' || coalesce(nullif(trim(p_nome), ''), v_codigo),
    'Permissão por tipo de escala'
  )
  on conflict (resource_type, resource_key) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = true;
end;
$$;

create or replace function public.sync_all_scale_type_access_resources()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select te.codigo, te.nome
      from public.tipos_escala te
  loop
    perform public.sync_scale_type_access_resource(v_row.codigo, v_row.nome);
  end loop;
end;
$$;

select public.sync_all_scale_type_access_resources();

create or replace function public.profile_has_scale_type_access(
  p_profile_id uuid,
  p_tipo_escala_id uuid,
  p_action text default 'view'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_resource_key text;
  v_action text;
begin
  v_action := lower(trim(coalesce(p_action, 'view')));

  if v_action not in ('view', 'update') then
    return false;
  end if;

  if p_profile_id is null or p_tipo_escala_id is null then
    return false;
  end if;

  if public.is_super_admin_profile(p_profile_id) then
    return true;
  end if;

  if public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.scale_types', v_action) then
    return true;
  end if;

  select te.codigo
    into v_codigo
    from public.tipos_escala te
   where te.id = p_tipo_escala_id
     and te.is_ativa = true;

  if v_codigo is null then
    return false;
  end if;

  v_resource_key := public.scale_type_resource_key(v_codigo);

  if public.profile_has_access(p_profile_id, 'screen', v_resource_key, v_action) then
    return true;
  end if;

  if not exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = 'lider'
  ) then
    return false;
  end if;

  if not exists (
    select 1
      from public.profile_scale_leadership psl
     where psl.profile_id = p_profile_id
       and psl.tipo_escala_id = p_tipo_escala_id
  ) then
    return false;
  end if;

  if v_action = 'view' then
    return public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.scales', 'view')
        or public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.scale_volunteers', 'view');
  end if;

  return public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.scales', 'update')
      or public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.scale_volunteers', 'update');
end;
$$;

create or replace function public.assert_scale_type_access(
  p_profile_id uuid,
  p_tipo_escala_id uuid,
  p_action text default 'update'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.profile_has_scale_type_access(p_profile_id, p_tipo_escala_id, p_action) then
    raise exception 'Sem permissão para este tipo de escala.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listagem filtrada (app)
-- ---------------------------------------------------------------------------

drop function if exists public.listar_tipos_escala_permitidos(uuid, text);

create or replace function public.listar_tipos_escala_permitidos(
  p_profile_id uuid default public.current_session_profile_id(),
  p_action text default 'view'
)
returns table (
  id uuid,
  codigo text,
  nome text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select te.id, te.codigo, te.nome
    from public.tipos_escala te
   where te.is_ativa = true
     and public.profile_has_scale_type_access(p_profile_id, te.id, p_action)
   order by te.nome asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants iniciais do papel lider
-- ---------------------------------------------------------------------------

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('/maintenance-dashboard', true, false),
      ('maintenance.card.scale_volunteers', true, true),
      ('maintenance.card.scales', true, true),
      ('dashboard.card.vigilance_scales', true, false)
  ) as g(resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = g.resource_key
 where r.code = 'lider'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Ordem do papel lider na UI admin
-- access_role_display_order: script canônico em access-control-role-display-order.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Admin: líderanças por perfil
-- ---------------------------------------------------------------------------

drop function if exists public.listar_liderancas_escala_admin(uuid, uuid);

create or replace function public.listar_liderancas_escala_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  tipo_escala_id uuid,
  tipo_codigo text,
  tipo_nome text,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  return query
  select
    te.id as tipo_escala_id,
    te.codigo as tipo_codigo,
    te.nome as tipo_nome,
    exists (
      select 1
        from public.profile_scale_leadership psl
       where psl.profile_id = p_target_profile_id
         and psl.tipo_escala_id = te.id
    ) as assigned
  from public.tipos_escala te
 where te.is_ativa = true
 order by te.nome asc;
end;
$$;

drop function if exists public.salvar_lideranca_escala_admin(uuid, uuid, uuid, boolean);

create or replace function public.salvar_lideranca_escala_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_tipo_escala_id uuid,
  p_assigned boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nome text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null or p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil ou tipo de escala não informado.');
  end if;

  select te.codigo, te.nome
    into v_codigo, v_nome
    from public.tipos_escala te
   where te.id = p_tipo_escala_id;

  if v_codigo is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  perform public.sync_scale_type_access_resource(v_codigo, v_nome);

  if coalesce(p_assigned, false) then
    insert into public.profile_scale_leadership (profile_id, tipo_escala_id, granted_by_profile_id)
    values (p_target_profile_id, p_tipo_escala_id, p_actor_profile_id)
    on conflict (profile_id, tipo_escala_id) do update
      set granted_by_profile_id = excluded.granted_by_profile_id;
  else
    delete from public.profile_scale_leadership psl
     where psl.profile_id = p_target_profile_id
       and psl.tipo_escala_id = p_tipo_escala_id;
  end if;

  return jsonb_build_object('success', true, 'message', 'Liderança de escala atualizada.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Enforcement nas RPCs de escala
-- ---------------------------------------------------------------------------

create or replace function public.listar_voluntarios_escala(p_tipo_escala_id uuid)
returns table (
  id uuid,
  nome text,
  is_ativo boolean,
  ultima_data_servico date,
  ordem_sequencial integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.profile_has_scale_type_access(public.current_session_profile_id(), p_tipo_escala_id, 'view') then
    return;
  end if;

  return query
  select
    ve.id,
    ve.nome,
    ve.is_ativo,
    (
      select max(el.data_servico)
      from public.escalas_log el
      where el.tipo_escala_id = ve.tipo_escala_id
        and el.voluntario_id = ve.id
    ) as ultima_data_servico,
    ve.ordem_sequencial
  from public.voluntarios_escala ve
  where ve.tipo_escala_id = p_tipo_escala_id
  order by ve.is_ativo desc, ve.ordem_sequencial asc nulls last, ve.nome asc;
end;
$$;

create or replace function public.registrar_escala_manual(
  p_tipo_escala_id uuid,
  p_voluntario_id uuid,
  p_data_servico date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voluntario_nome text;
  v_tipo_nome text;
  v_existing_voluntario text;
begin
  if not public.profile_has_scale_type_access(public.current_session_profile_id(), p_tipo_escala_id, 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
  end if;

  if p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não informado.');
  end if;

  if p_voluntario_id is null then
    return jsonb_build_object('success', false, 'message', 'Servo não informado.');
  end if;

  if p_data_servico is null then
    return jsonb_build_object('success', false, 'message', 'Data do serviço não informada.');
  end if;

  if extract(dow from p_data_servico) <> 0 then
    return jsonb_build_object('success', false, 'message', 'A data do serviço deve ser um domingo.');
  end if;

  select te.nome
    into v_tipo_nome
    from public.tipos_escala te
   where te.id = p_tipo_escala_id
     and te.is_ativa = true
   limit 1;

  if v_tipo_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado ou inativo.');
  end if;

  select ve.nome
    into v_voluntario_nome
    from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id
     and ve.is_ativo = true
   limit 1;

  if v_voluntario_nome is null then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado ou inativo neste tipo de escala.');
  end if;

  if exists (
    select 1
      from public.escalas_log el
     where el.tipo_escala_id = p_tipo_escala_id
       and el.data_servico = p_data_servico
       and el.voluntario_id <> p_voluntario_id
  ) then
    select ve.nome
      into v_existing_voluntario
      from public.escalas_log el
      join public.voluntarios_escala ve on ve.id = el.voluntario_id
     where el.tipo_escala_id = p_tipo_escala_id
       and el.data_servico = p_data_servico
     limit 1;

    return jsonb_build_object(
      'success', false,
      'message',
      format('Já existe escala para %s neste domingo (%s).', coalesce(v_existing_voluntario, 'outro servo'), p_data_servico)
    );
  end if;

  if exists (
    select 1
      from public.escalas_log el
     where el.tipo_escala_id = p_tipo_escala_id
       and el.voluntario_id = p_voluntario_id
       and el.data_servico = p_data_servico
  ) then
    return jsonb_build_object('success', false, 'message', 'Este servo já está escalado para esta data.');
  end if;

  insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico)
  values (p_tipo_escala_id, p_voluntario_id, p_data_servico);

  return jsonb_build_object(
    'success', true,
    'message', 'Escala registrada com sucesso.',
    'voluntario_nome', v_voluntario_nome,
    'tipo_escala_nome', v_tipo_nome,
    'data_servico', p_data_servico
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Já existe escala para este domingo neste tipo de escala.');
end;
$$;

create or replace function public.excluir_escala(p_escala_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data_servico date;
  v_voluntario_nome text;
  v_tipo_escala_id uuid;
begin
  if p_escala_log_id is null then
    return jsonb_build_object('success', false, 'message', 'Escala não informada.');
  end if;

  select el.data_servico, ve.nome, el.tipo_escala_id
    into v_data_servico, v_voluntario_nome, v_tipo_escala_id
    from public.escalas_log el
    join public.voluntarios_escala ve on ve.id = el.voluntario_id
   where el.id = p_escala_log_id
   limit 1;

  if v_data_servico is null then
    return jsonb_build_object('success', false, 'message', 'Escala não encontrada.');
  end if;

  if not public.profile_has_scale_type_access(public.current_session_profile_id(), v_tipo_escala_id, 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
  end if;

  delete from public.escalas_log
   where id = p_escala_log_id;

  return jsonb_build_object(
    'success', true,
    'message', format('Escala de %s em %s removida.', v_voluntario_nome, v_data_servico)
  );
end;
$$;

create or replace function public.cadastrar_voluntario_escala(
  p_tipo_escala_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_tipo_nome text;
  v_voluntario_id uuid;
  v_proxima_ordem integer;
begin
  if not public.profile_has_scale_type_access(public.current_session_profile_id(), p_tipo_escala_id, 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
  end if;

  if p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não informado.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  select te.nome
    into v_tipo_nome
    from public.tipos_escala te
   where te.id = p_tipo_escala_id
     and te.is_ativa = true
   limit 1;

  if v_tipo_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado ou inativo.');
  end if;

  select nullif(trim(p.full_name), '')
    into v_nome
    from public.profiles p
   where p.id = p_profile_id
   limit 1;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Perfil sem nome cadastrado.');
  end if;

  if exists (
    select 1
      from public.voluntarios_escala ve
     where ve.tipo_escala_id = p_tipo_escala_id
       and lower(trim(ve.nome)) = lower(trim(v_nome))
  ) then
    return jsonb_build_object('success', false, 'message', 'Este servo já está cadastrado neste tipo de escala.');
  end if;

  select coalesce(max(ve.ordem_sequencial), 0) + 1
    into v_proxima_ordem
    from public.voluntarios_escala ve
   where ve.tipo_escala_id = p_tipo_escala_id;

  insert into public.voluntarios_escala (tipo_escala_id, nome, is_ativo, ordem_sequencial)
  values (p_tipo_escala_id, trim(v_nome), true, v_proxima_ordem)
  returning id into v_voluntario_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Servo associado à escala com sucesso.',
    'voluntario_id', v_voluntario_id,
    'nome', trim(v_nome),
    'ordem_sequencial', v_proxima_ordem,
    'tipo_escala_nome', v_tipo_nome
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Este servo já está cadastrado neste tipo de escala.');
end;
$$;

create or replace function public.remover_voluntario_escala(
  p_tipo_escala_id uuid,
  p_voluntario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if not public.profile_has_scale_type_access(public.current_session_profile_id(), p_tipo_escala_id, 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
  end if;

  if p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não informado.');
  end if;

  if p_voluntario_id is null then
    return jsonb_build_object('success', false, 'message', 'Servo não informado.');
  end if;

  select ve.nome
    into v_nome
    from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id
   limit 1;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado neste tipo de escala.');
  end if;

  delete from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Servo removido da lista deste tipo de escala.',
    'nome', trim(v_nome)
  );
end;
$$;

create or replace function public.garantir_ordem_sequencial_voluntario(
  p_tipo_escala_id uuid,
  p_voluntario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ordem integer;
  v_proxima integer;
begin
  if not public.profile_has_scale_type_access(public.current_session_profile_id(), p_tipo_escala_id, 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
  end if;

  if p_tipo_escala_id is null or p_voluntario_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  select ve.ordem_sequencial
    into v_ordem
    from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado.');
  end if;

  if v_ordem is not null then
    return jsonb_build_object('success', true, 'ordem_sequencial', v_ordem, 'message', 'Ordem sequencial já definida.');
  end if;

  select coalesce(max(ve.ordem_sequencial), 0) + 1
    into v_proxima
    from public.voluntarios_escala ve
   where ve.tipo_escala_id = p_tipo_escala_id;

  update public.voluntarios_escala ve
  set ordem_sequencial = v_proxima
  where ve.id = p_voluntario_id
    and ve.tipo_escala_id = p_tipo_escala_id;

  return jsonb_build_object('success', true, 'ordem_sequencial', v_proxima, 'message', 'Ordem sequencial atribuída.');
end;
$$;

create or replace function public.listar_tipos_escala_manutencao()
returns table (
  id uuid,
  codigo text,
  nome text,
  is_ativa boolean,
  vagas_por_servico integer,
  modo_ciclo text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
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
      te.created_at,
      te.updated_at
      from public.tipos_escala te
     order by te.is_ativa desc, te.nome asc;
    return;
  end if;

  return;
end;
$$;

create or replace function public.cadastrar_tipo_escala(
  p_codigo text,
  p_nome text,
  p_vagas_por_servico integer default 1,
  p_modo_ciclo text default 'individual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nome text;
  v_vagas integer;
  v_modo text;
  v_id uuid;
  v_profile_id uuid;
begin
  v_profile_id := public.current_session_profile_id();

  if not public.is_super_admin_profile(v_profile_id)
     and not public.profile_has_access(v_profile_id, 'screen', 'maintenance.card.scale_types', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para cadastrar tipos de escala.');
  end if;

  v_codigo := lower(trim(regexp_replace(coalesce(p_codigo, ''), '\s+', '_', 'g')));
  v_nome := trim(coalesce(p_nome, ''));
  v_vagas := greatest(1, least(coalesce(p_vagas_por_servico, 1), 50));
  v_modo := lower(trim(coalesce(p_modo_ciclo, 'individual')));

  if v_modo not in ('individual', 'equipe') then
    return jsonb_build_object('success', false, 'message', 'Modo de ciclo inválido. Use individual ou equipe.');
  end if;

  if v_codigo = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o código da escala.');
  end if;

  if v_nome = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o nome da escala.');
  end if;

  if exists (select 1 from public.tipos_escala te where te.codigo = v_codigo) then
    return jsonb_build_object('success', false, 'message', 'Já existe uma escala com este código.');
  end if;

  insert into public.tipos_escala (codigo, nome, is_ativa, vagas_por_servico, modo_ciclo)
  values (v_codigo, v_nome, true, v_vagas, v_modo)
  returning id into v_id;

  perform public.sync_scale_type_access_resource(v_codigo, v_nome);

  return jsonb_build_object(
    'success', true,
    'message', 'Tipo de escala cadastrado.',
    'id', v_id,
    'codigo', v_codigo,
    'nome', v_nome,
    'vagas_por_servico', v_vagas,
    'modo_ciclo', v_modo
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Já existe uma escala com este código.');
end;
$$;

create or replace function public.atualizar_tipo_escala(
  p_id uuid,
  p_codigo text,
  p_nome text,
  p_is_ativa boolean default true,
  p_vagas_por_servico integer default null,
  p_modo_ciclo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nome text;
  v_vagas integer;
  v_modo text;
  v_profile_id uuid;
begin
  v_profile_id := public.current_session_profile_id();

  if not public.is_super_admin_profile(v_profile_id)
     and not public.profile_has_access(v_profile_id, 'screen', 'maintenance.card.scale_types', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para editar tipos de escala.');
  end if;

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Escala não informada.');
  end if;

  v_codigo := lower(trim(regexp_replace(coalesce(p_codigo, ''), '\s+', '_', 'g')));
  v_nome := trim(coalesce(p_nome, ''));

  if v_codigo = '' or v_nome = '' then
    return jsonb_build_object('success', false, 'message', 'Informe código e nome da escala.');
  end if;

  if exists (
    select 1 from public.tipos_escala te where te.codigo = v_codigo and te.id <> p_id
  ) then
    return jsonb_build_object('success', false, 'message', 'Já existe outra escala com este código.');
  end if;

  select coalesce(te.vagas_por_servico, 1), coalesce(te.modo_ciclo, 'individual')
    into v_vagas, v_modo
    from public.tipos_escala te
   where te.id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  if p_vagas_por_servico is not null then
    v_vagas := greatest(1, least(p_vagas_por_servico, 50));
  end if;

  if p_modo_ciclo is not null then
    v_modo := lower(trim(p_modo_ciclo));
    if v_modo not in ('individual', 'equipe') then
      return jsonb_build_object('success', false, 'message', 'Modo de ciclo inválido. Use individual ou equipe.');
    end if;
  end if;

  update public.tipos_escala te
  set
    codigo = v_codigo,
    nome = v_nome,
    is_ativa = coalesce(p_is_ativa, true),
    vagas_por_servico = v_vagas,
    modo_ciclo = v_modo,
    updated_at = now()
  where te.id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  perform public.sync_scale_type_access_resource(v_codigo, v_nome);

  return jsonb_build_object(
    'success', true,
    'message', 'Tipo de escala atualizado.',
    'id', p_id,
    'codigo', v_codigo,
    'nome', v_nome,
    'vagas_por_servico', v_vagas,
    'modo_ciclo', v_modo
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Já existe outra escala com este código.');
end;
$$;

create or replace function public.excluir_tipo_escala(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_profile_id uuid;
begin
  v_profile_id := public.current_session_profile_id();

  if not public.is_super_admin_profile(v_profile_id)
     and not public.profile_has_access(v_profile_id, 'screen', 'maintenance.card.scale_types', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir tipos de escala.');
  end if;

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Escala não informada.');
  end if;

  select te.nome into v_nome from public.tipos_escala te where te.id = p_id;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  delete from public.tipos_escala te where te.id = p_id;

  return jsonb_build_object('success', true, 'message', format('Escala «%s» removida.', v_nome));
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.scale_type_resource_key(text) to anon, authenticated;
grant execute on function public.profile_has_scale_type_access(uuid, uuid, text) to anon, authenticated;
grant execute on function public.listar_tipos_escala_permitidos(uuid, text) to anon, authenticated;
grant execute on function public.listar_liderancas_escala_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.salvar_lideranca_escala_admin(uuid, uuid, uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
