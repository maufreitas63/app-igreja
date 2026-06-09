-- C3: gravação transacional do ciclo de escala em bloco (tudo ou nada).
-- Substitui inserções sequenciais no app (applyCicloCompleto).
-- Execute no SQL Editor do Supabase.

drop function if exists public.aplicar_ciclo_escala(uuid, jsonb);

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

  insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico)
  select
    p_tipo_escala_id,
    nullif(trim(e.value ->> 'voluntario_id'), '')::uuid,
    nullif(trim(e.value ->> 'data_servico'), '')::date
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

grant execute on function public.aplicar_ciclo_escala(uuid, jsonb) to anon;
grant execute on function public.aplicar_ciclo_escala(uuid, jsonb) to authenticated;

-- M9: contexto do ciclo sem varrer escalas_log inteiro no cliente.
drop function if exists public.get_scale_cycle_context(uuid);

create or replace function public.get_scale_cycle_context(p_tipo_escala_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_date date;
  v_scheduled_dates date[];
  v_occupancy jsonb := '{}'::jsonb;
  v_vagas integer := 1;
  v_modo_ciclo text := 'individual';
begin
  if p_tipo_escala_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Tipo de escala não informado.'
    );
  end if;

  select
    coalesce(te.vagas_por_servico, 1),
    coalesce(te.modo_ciclo, 'individual')
  into v_vagas, v_modo_ciclo
  from public.tipos_escala te
  where te.id = p_tipo_escala_id;

  select max(el.data_servico)
  into v_max_date
  from public.escalas_log el
  where el.tipo_escala_id = p_tipo_escala_id;

  select coalesce(
    array_agg(distinct el.data_servico order by el.data_servico),
    array[]::date[]
  )
  into v_scheduled_dates
  from public.escalas_log el
  where el.tipo_escala_id = p_tipo_escala_id;

  select coalesce(
    jsonb_object_agg(el.data_servico::text, el.cnt),
    '{}'::jsonb
  )
  into v_occupancy
  from (
    select el.data_servico, count(*)::integer as cnt
    from public.escalas_log el
    where el.tipo_escala_id = p_tipo_escala_id
    group by el.data_servico
  ) el;

  return jsonb_build_object(
    'success', true,
    'max_service_date', v_max_date,
    'scheduled_dates', to_jsonb(coalesce(v_scheduled_dates, array[]::date[])),
    'occupancy_by_date', v_occupancy,
    'vagas_por_servico', v_vagas,
    'modo_ciclo', v_modo_ciclo
  );
end;
$$;

grant execute on function public.get_scale_cycle_context(uuid) to anon;
grant execute on function public.get_scale_cycle_context(uuid) to authenticated;

notify pgrst, 'reload schema';
