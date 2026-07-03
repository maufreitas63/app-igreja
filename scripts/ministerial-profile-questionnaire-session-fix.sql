-- Patch: corrige RPCs do questionário que referenciam assert_session_profile_matches inexistente.
-- Execute no SQL Editor do Supabase APÓS profile-sessions.sql (current_session_profile_id).
-- Depois: Settings → API → Reload schema.

create or replace function public.ministerial_require_session_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if public.current_session_profile_id() is null then
    raise exception 'Sessão não identificada.';
  end if;

  if p_profile_id <> public.current_session_profile_id() then
    raise exception 'Operação permitida apenas para o perfil da sessão atual.';
  end if;
end;
$$;

create or replace function public.obter_resultado_questionario_ministerial(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result record;
begin
  perform public.ministerial_require_session_profile(p_profile_id);

  select
    r.perfil_vencedor,
    r.completed_at
  into v_result
  from public.ministerial_resultados r
  where r.profile_id = p_profile_id
  limit 1;

  if not found then
    return jsonb_build_object('success', true, 'has_result', false);
  end if;

  return jsonb_build_object(
    'success', true,
    'has_result', true,
    'perfil_vencedor', v_result.perfil_vencedor,
    'perfil_label', public.ministerial_profile_label(v_result.perfil_vencedor),
    'completed_at', v_result.completed_at
  );
end;
$$;

create or replace function public.submeter_questionario_ministerial(
  p_profile_id uuid,
  p_respostas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_perguntas integer;
  v_answer record;
  v_scores jsonb;
  v_winner text;
  v_seen integer := 0;
begin
  perform public.ministerial_require_session_profile(p_profile_id);

  if p_respostas is null or jsonb_typeof(p_respostas) <> 'array' then
    return jsonb_build_object('success', false, 'message', 'Respostas inválidas.');
  end if;

  select count(*)::integer
    into v_total_perguntas
    from public.ministerial_perguntas;

  if v_total_perguntas <> 50 then
    return jsonb_build_object(
      'success', false,
      'message', 'Questionário incompleto no banco. Execute o seed das 50 perguntas.'
    );
  end if;

  if jsonb_array_length(p_respostas) <> v_total_perguntas then
    return jsonb_build_object(
      'success', false,
      'message', format('Informe as %s respostas do questionário.', v_total_perguntas)
    );
  end if;

  for v_answer in
    select
      nullif(trim(coalesce(value ->> 'pergunta_id', '')), '') as pergunta_id,
      nullif(trim(coalesce(value ->> 'opcao_id', '')), '') as opcao_id
    from jsonb_array_elements(p_respostas) as value
  loop
    if v_answer.pergunta_id is null or v_answer.opcao_id is null then
      return jsonb_build_object('success', false, 'message', 'Cada resposta precisa de pergunta e opção.');
    end if;

    if not exists (
      select 1
        from public.ministerial_perguntas p
       where p.id = v_answer.pergunta_id
    ) then
      return jsonb_build_object('success', false, 'message', 'Pergunta inválida: ' || v_answer.pergunta_id);
    end if;

    if not exists (
      select 1
        from public.ministerial_opcoes o
       where o.id = v_answer.opcao_id
         and o.pergunta_id = v_answer.pergunta_id
    ) then
      return jsonb_build_object('success', false, 'message', 'Opção inválida para a pergunta informada.');
    end if;

    v_seen := v_seen + 1;
  end loop;

  if v_seen <> v_total_perguntas then
    return jsonb_build_object('success', false, 'message', 'Há perguntas duplicadas ou ausentes.');
  end if;

  if (
    select count(distinct nullif(trim(coalesce(value ->> 'pergunta_id', '')), ''))
      from jsonb_array_elements(p_respostas) as value
  ) <> v_total_perguntas then
    return jsonb_build_object('success', false, 'message', 'Responda cada pergunta uma única vez.');
  end if;

  delete from public.ministerial_respostas where profile_id = p_profile_id;
  delete from public.ministerial_resultados where profile_id = p_profile_id;

  insert into public.ministerial_respostas (profile_id, pergunta_id, opcao_id)
  select
    p_profile_id,
    nullif(trim(coalesce(value ->> 'pergunta_id', '')), ''),
    nullif(trim(coalesce(value ->> 'opcao_id', '')), '')
  from jsonb_array_elements(p_respostas) as value;

  v_scores := public.compute_ministerial_profile_scores(p_profile_id);
  v_winner := public.resolve_ministerial_winner_profile(v_scores);

  if v_winner is null then
    return jsonb_build_object('success', false, 'message', 'Não foi possível calcular o perfil.');
  end if;

  insert into public.ministerial_resultados (profile_id, perfil_vencedor, pontuacao_detalhada)
  values (p_profile_id, v_winner, v_scores);

  return jsonb_build_object(
    'success', true,
    'perfil_vencedor', v_winner,
    'perfil_label', public.ministerial_profile_label(v_winner)
  );
end;
$$;

grant execute on function public.obter_resultado_questionario_ministerial(uuid) to anon, authenticated;
grant execute on function public.submeter_questionario_ministerial(uuid, jsonb) to anon, authenticated;
