-- =============================================================================
-- Multi-tenancy — onda 1d: RPCs de escalas (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   vigilancia-escalas.sql                      → listar_tipos_escala, listar_escalas
--   access-control-lider-escala.sql             → listar_tipos_escala_manutencao,
--                                                 listar_tipos_escala_permitidos,
--                                                 cadastrar/atualizar/excluir_tipo_escala,
--                                                 listar_voluntarios_escala,
--                                                 cadastrar_voluntario_escala (ACL),
--                                                 excluir_escala (ACL)
--   escalas-volunteers-rpc.sql                  → remover_voluntario_escala (mais rica + ACL)
--   escalas-registrar-multi-vagas-acl-patch.sql → registrar_escala_manual
--   escalas-apply-cycle-batch.sql               → aplicar_ciclo_escala
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- listar_tipos_escala
-- ---------------------------------------------------------------------------
create or replace function public.listar_tipos_escala()
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
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    te.id,
    te.codigo,
    te.nome
  from public.tipos_escala te
  where te.tenant_id = v_tenant
    and te.is_ativa = true
  order by te.nome asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_escalas
-- ---------------------------------------------------------------------------
create or replace function public.listar_escalas()
returns table (
  id uuid,
  tipo_escala_id uuid,
  tipo_escala_codigo text,
  tipo_escala_nome text,
  data_servico date,
  voluntario_id uuid,
  volunteer_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    el.id,
    te.id as tipo_escala_id,
    te.codigo as tipo_escala_codigo,
    te.nome as tipo_escala_nome,
    el.data_servico,
    el.voluntario_id,
    ve.nome as volunteer_name
  from public.escalas_log el
  join public.tipos_escala te
    on te.id = el.tipo_escala_id
   and te.tenant_id = v_tenant
  join public.voluntarios_escala ve
    on ve.id = el.voluntario_id
   and ve.tenant_id = v_tenant
  where el.tenant_id = v_tenant
  order by te.nome asc, el.data_servico asc, el.created_at asc, ve.nome asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_tipos_escala_permitidos
-- ---------------------------------------------------------------------------
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
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select te.id, te.codigo, te.nome
    from public.tipos_escala te
   where te.tenant_id = v_tenant
     and te.is_ativa = true
     and public.profile_has_scale_type_access(p_profile_id, te.id, p_action)
   order by te.nome asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_tipos_escala_manutencao
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- cadastrar_tipo_escala
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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

  if exists (
    select 1
      from public.tipos_escala te
     where te.tenant_id = v_tenant
       and te.codigo = v_codigo
  ) then
    return jsonb_build_object('success', false, 'message', 'Já existe uma escala com este código.');
  end if;

  insert into public.tipos_escala (codigo, nome, is_ativa, vagas_por_servico, modo_ciclo, tenant_id)
  values (v_codigo, v_nome, true, v_vagas, v_modo, v_tenant)
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

-- ---------------------------------------------------------------------------
-- atualizar_tipo_escala
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
    select 1
      from public.tipos_escala te
     where te.tenant_id = v_tenant
       and te.codigo = v_codigo
       and te.id <> p_id
  ) then
    return jsonb_build_object('success', false, 'message', 'Já existe outra escala com este código.');
  end if;

  select coalesce(te.vagas_por_servico, 1), coalesce(te.modo_ciclo, 'individual')
    into v_vagas, v_modo
    from public.tipos_escala te
   where te.id = p_id
     and te.tenant_id = v_tenant;

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
  where te.id = p_id
    and te.tenant_id = v_tenant;

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

-- ---------------------------------------------------------------------------
-- excluir_tipo_escala
-- ---------------------------------------------------------------------------
create or replace function public.excluir_tipo_escala(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
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

  select te.nome
    into v_nome
    from public.tipos_escala te
   where te.id = p_id
     and te.tenant_id = v_tenant;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  delete from public.tipos_escala te
   where te.id = p_id
     and te.tenant_id = v_tenant;

  return jsonb_build_object('success', true, 'message', format('Escala «%s» removida.', v_nome));
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_voluntarios_escala
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
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not exists (
    select 1
      from public.tipos_escala te
     where te.id = p_tipo_escala_id
       and te.tenant_id = v_tenant
  ) then
    return;
  end if;

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
        and el.tenant_id = v_tenant
    ) as ultima_data_servico,
    ve.ordem_sequencial
  from public.voluntarios_escala ve
  where ve.tipo_escala_id = p_tipo_escala_id
    and ve.tenant_id = v_tenant
  order by ve.is_ativo desc, ve.ordem_sequencial asc nulls last, ve.nome asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- cadastrar_voluntario_escala (ACL)
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
     and te.tenant_id = v_tenant
     and te.is_ativa = true
   limit 1;

  if v_tipo_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado ou inativo.');
  end if;

  select nullif(trim(p.full_name), '')
    into v_nome
    from public.profiles p
   where p.id = p_profile_id
     and p.tenant_id = v_tenant
   limit 1;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Perfil sem nome cadastrado.');
  end if;

  if exists (
    select 1
      from public.voluntarios_escala ve
     where ve.tenant_id = v_tenant
       and ve.tipo_escala_id = p_tipo_escala_id
       and lower(trim(ve.nome)) = lower(trim(v_nome))
  ) then
    return jsonb_build_object('success', false, 'message', 'Este servo já está cadastrado neste tipo de escala.');
  end if;

  select coalesce(max(ve.ordem_sequencial), 0) + 1
    into v_proxima_ordem
    from public.voluntarios_escala ve
   where ve.tenant_id = v_tenant
     and ve.tipo_escala_id = p_tipo_escala_id;

  insert into public.voluntarios_escala (tipo_escala_id, nome, is_ativo, ordem_sequencial, tenant_id)
  values (p_tipo_escala_id, trim(v_nome), true, v_proxima_ordem, v_tenant)
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

-- ---------------------------------------------------------------------------
-- remover_voluntario_escala (ACL + corpo mais rico de escalas-volunteers-rpc)
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_nome text;
  v_removed_order integer;
  v_future_escalas_count integer := 0;
  v_message text;
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

  if not exists (
    select 1
      from public.tipos_escala te
     where te.id = p_tipo_escala_id
       and te.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  select ve.nome, ve.ordem_sequencial
    into v_nome, v_removed_order
    from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id
     and ve.tenant_id = v_tenant
   limit 1;

  if v_nome is null then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado neste tipo de escala.');
  end if;

  select count(*)
    into v_future_escalas_count
    from public.escalas_log el
   where el.tipo_escala_id = p_tipo_escala_id
     and el.voluntario_id = p_voluntario_id
     and el.tenant_id = v_tenant
     and el.data_servico >= current_date;

  delete from public.voluntarios_escala ve
   where ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id
     and ve.tenant_id = v_tenant;

  if v_removed_order is not null then
    update public.voluntarios_escala ve
       set ordem_sequencial = ve.ordem_sequencial - 1
     where ve.tipo_escala_id = p_tipo_escala_id
       and ve.tenant_id = v_tenant
       and ve.is_ativo = true
       and ve.ordem_sequencial > v_removed_order;
  end if;

  v_message := 'Servo removido da lista deste tipo de escala.';

  if coalesce(v_future_escalas_count, 0) > 0 then
    v_message := v_message
      || format(' Atenção: %s escala(s) futura(s) deste servo permanecem em escalas_log.', v_future_escalas_count);
  end if;

  return jsonb_build_object(
    'success', true,
    'message', v_message,
    'nome', trim(v_nome),
    'future_escalas_count', coalesce(v_future_escalas_count, 0),
    'reordered', v_removed_order is not null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- excluir_escala (ACL)
-- ---------------------------------------------------------------------------
create or replace function public.excluir_escala(p_escala_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
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
    join public.voluntarios_escala ve
      on ve.id = el.voluntario_id
     and ve.tenant_id = v_tenant
   where el.id = p_escala_log_id
     and el.tenant_id = v_tenant
   limit 1;

  if v_data_servico is null then
    return jsonb_build_object('success', false, 'message', 'Escala não encontrada.');
  end if;

  if not public.profile_has_scale_type_access(public.current_session_profile_id(), v_tipo_escala_id, 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
  end if;

  delete from public.escalas_log el
   where el.id = p_escala_log_id
     and el.tenant_id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'message', format('Escala de %s em %s removida.', v_voluntario_nome, v_data_servico)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- registrar_escala_manual (multi-vagas ACL patch)
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_voluntario_nome text;
  v_tipo_nome text;
  v_vagas integer := 1;
  v_ocupadas integer := 0;
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

  select te.nome, coalesce(te.vagas_por_servico, 1)
    into v_tipo_nome, v_vagas
    from public.tipos_escala te
   where te.id = p_tipo_escala_id
     and te.tenant_id = v_tenant
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
     and ve.tenant_id = v_tenant
     and ve.is_ativo = true
   limit 1;

  if v_voluntario_nome is null then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado ou inativo neste tipo de escala.');
  end if;

  if exists (
    select 1
      from public.escalas_log el
     where el.tenant_id = v_tenant
       and el.tipo_escala_id = p_tipo_escala_id
       and el.voluntario_id = p_voluntario_id
       and el.data_servico = p_data_servico
  ) then
    return jsonb_build_object('success', false, 'message', 'Este servo já está escalado para esta data.');
  end if;

  select count(*)
    into v_ocupadas
    from public.escalas_log el
   where el.tenant_id = v_tenant
     and el.tipo_escala_id = p_tipo_escala_id
     and el.data_servico = p_data_servico;

  if v_ocupadas >= v_vagas then
    return jsonb_build_object(
      'success', false,
      'message',
      format(
        'Domingo %s já possui %s/%s vaga(s) preenchida(s) neste tipo de escala.',
        p_data_servico,
        v_ocupadas,
        v_vagas
      )
    );
  end if;

  insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico, tenant_id)
  values (p_tipo_escala_id, p_voluntario_id, p_data_servico, v_tenant);

  return jsonb_build_object(
    'success', true,
    'message', 'Escala registrada com sucesso.',
    'voluntario_nome', v_voluntario_nome,
    'tipo_escala_nome', v_tipo_nome,
    'data_servico', p_data_servico,
    'vagas_por_servico', v_vagas,
    'ocupadas_apos_insert', v_ocupadas + 1
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'Este servo já está escalado para esta data.');
end;
$$;

-- ---------------------------------------------------------------------------
-- aplicar_ciclo_escala
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_ciclo_escala(
  p_tipo_escala_id uuid,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_entry jsonb;
  v_voluntario_id uuid;
  v_data_servico date;
  v_voluntario_nome text;
  v_tipo_nome text;
  v_inserted integer := 0;
  v_has_acl boolean := false;
  v_profile_id uuid;
  v_duplicate_in_batch integer := 0;
  v_conflict_existing integer := 0;
  v_invalid_volunteer integer := 0;
  v_vagas integer := 1;
begin
  if p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não informado.');
  end if;

  if p_entries is null
    or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhuma escala para gravar.');
  end if;

  select exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'profile_has_scale_type_access'
  )
  into v_has_acl;

  if v_has_acl then
    v_profile_id := public.current_session_profile_id();

    if not public.profile_has_scale_type_access(v_profile_id, p_tipo_escala_id, 'update') then
      return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
    end if;
  end if;

  select te.nome, coalesce(te.vagas_por_servico, 1)
    into v_tipo_nome, v_vagas
    from public.tipos_escala te
   where te.id = p_tipo_escala_id
     and te.tenant_id = v_tenant
     and te.is_ativa = true
   limit 1;

  if v_tipo_nome is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado ou inativo.');
  end if;

  for v_entry in
    select value
      from jsonb_array_elements(p_entries) as t(value)
  loop
    begin
      v_voluntario_id := nullif(trim(v_entry ->> 'voluntario_id'), '')::uuid;
      v_data_servico := nullif(trim(v_entry ->> 'data_servico'), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message', 'Entrada inválida no lote (voluntario_id ou data_servico).'
        );
    end;

    if v_voluntario_id is null then
      return jsonb_build_object('success', false, 'message', 'Servo não informado no lote.');
    end if;

    if v_data_servico is null then
      return jsonb_build_object('success', false, 'message', 'Data do serviço inválida no lote.');
    end if;

    if extract(dow from v_data_servico) <> 0 then
      return jsonb_build_object('success', false, 'message', 'Todas as datas do lote devem ser domingos.');
    end if;

    select ve.nome
      into v_voluntario_nome
      from public.voluntarios_escala ve
     where ve.id = v_voluntario_id
       and ve.tipo_escala_id = p_tipo_escala_id
       and ve.tenant_id = v_tenant
       and ve.is_ativo = true
     limit 1;

    if v_voluntario_nome is null then
      return jsonb_build_object(
        'success', false,
        'message', 'Servo não encontrado ou inativo neste tipo de escala.'
      );
    end if;
  end loop;

  select count(*)
    into v_duplicate_in_batch
    from (
      select
        nullif(trim(e.value ->> 'voluntario_id'), '') as voluntario_id,
        nullif(trim(e.value ->> 'data_servico'), '') as data_servico
      from jsonb_array_elements(p_entries) as e(value)
      group by 1, 2
      having count(*) > 1
    ) dup;

  if coalesce(v_duplicate_in_batch, 0) > 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Lote contém entradas duplicadas (mesmo servo e mesma data).'
    );
  end if;

  select count(*)
    into v_conflict_existing
    from (
      select
        batch.data_servico,
        batch.batch_count + coalesce(existing.existing_count, 0) as total_count
      from (
        select
          nullif(trim(e.value ->> 'data_servico'), '')::date as data_servico,
          count(*)::integer as batch_count
        from jsonb_array_elements(p_entries) as e(value)
        group by 1
      ) batch
      left join (
        select el.data_servico, count(*)::integer as existing_count
        from public.escalas_log el
        where el.tipo_escala_id = p_tipo_escala_id
          and el.tenant_id = v_tenant
        group by el.data_servico
      ) existing on existing.data_servico = batch.data_servico
      where batch.data_servico is not null
        and batch.batch_count + coalesce(existing.existing_count, 0) > v_vagas
    ) overflow_dates;

  if coalesce(v_conflict_existing, 0) > 0 then
    return jsonb_build_object(
      'success', false,
      'message',
      format(
        'Um ou mais domingos do lote excedem as %s vaga(s) por serviço deste tipo de escala.',
        v_vagas
      )
    );
  end if;

  insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico, tenant_id)
  select
    p_tipo_escala_id,
    nullif(trim(e.value ->> 'voluntario_id'), '')::uuid,
    nullif(trim(e.value ->> 'data_servico'), '')::date,
    v_tenant
  from jsonb_array_elements(p_entries) as e(value);

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'success', true,
    'message', v_inserted::text || ' escala(s) gravada(s) em escalas_log.',
    'inserted_count', v_inserted,
    'tipo_escala_nome', v_tipo_nome
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message', 'Conflito ao gravar o lote. Nenhuma escala foi registrada.'
    );
  when others then
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.listar_tipos_escala() to anon;
grant execute on function public.listar_tipos_escala() to authenticated;
grant execute on function public.listar_escalas() to anon;
grant execute on function public.listar_escalas() to authenticated;
grant execute on function public.listar_tipos_escala_permitidos(uuid, text) to anon, authenticated;
grant execute on function public.listar_tipos_escala_manutencao() to anon;
grant execute on function public.listar_tipos_escala_manutencao() to authenticated;
grant execute on function public.cadastrar_tipo_escala(text, text, integer, text) to anon;
grant execute on function public.cadastrar_tipo_escala(text, text, integer, text) to authenticated;
grant execute on function public.atualizar_tipo_escala(uuid, text, text, boolean, integer, text) to anon;
grant execute on function public.atualizar_tipo_escala(uuid, text, text, boolean, integer, text) to authenticated;
grant execute on function public.excluir_tipo_escala(uuid) to anon;
grant execute on function public.excluir_tipo_escala(uuid) to authenticated;
grant execute on function public.listar_voluntarios_escala(uuid) to anon;
grant execute on function public.listar_voluntarios_escala(uuid) to authenticated;
grant execute on function public.cadastrar_voluntario_escala(uuid, uuid) to anon;
grant execute on function public.cadastrar_voluntario_escala(uuid, uuid) to authenticated;
grant execute on function public.remover_voluntario_escala(uuid, uuid) to anon;
grant execute on function public.remover_voluntario_escala(uuid, uuid) to authenticated;
grant execute on function public.excluir_escala(uuid) to anon;
grant execute on function public.excluir_escala(uuid) to authenticated;
grant execute on function public.registrar_escala_manual(uuid, uuid, date) to anon, authenticated;
grant execute on function public.aplicar_ciclo_escala(uuid, jsonb) to anon;
grant execute on function public.aplicar_ciclo_escala(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
