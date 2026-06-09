-- Integridade de escalas: domingo obrigatório + limite de vagas por data.
-- Pré-requisito: scripts/escalas-multi-vagas.sql (colunas vagas_por_servico / modo_ciclo).
-- Execute no Supabase após scripts de escala instalados.

drop index if exists public.escalas_log_tipo_data_uq;

-- ---------------------------------------------------------------------------
-- registrar_escala_manual (sem ACL — base)
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
  v_voluntario_nome text;
  v_tipo_nome text;
  v_vagas integer := 1;
  v_ocupadas integer := 0;
begin
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
       and el.voluntario_id = p_voluntario_id
       and el.data_servico = p_data_servico
  ) then
    return jsonb_build_object('success', false, 'message', 'Este servo já está escalado para esta data.');
  end if;

  select count(*)
    into v_ocupadas
    from public.escalas_log el
   where el.tipo_escala_id = p_tipo_escala_id
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

  insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico)
  values (p_tipo_escala_id, p_voluntario_id, p_data_servico);

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
    return jsonb_build_object(
      'success', false,
      'message', 'Este servo já está escalado para esta data.'
    );
end;
$$;

grant execute on function public.registrar_escala_manual(uuid, uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';
