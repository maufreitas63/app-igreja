-- Questionário de Perfil Ministerial (50 perguntas).
-- Execute no SQL Editor do Supabase APÓS profile-sessions.sql e access-control-security-hardening.sql.
-- Depois: Settings → API → Reload schema.
-- Seed: execute também scripts/ministerial-profile-questionnaire-seed.sql

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.ministerial_perguntas (
  id text primary key,
  texto_pergunta text not null,
  bloco_tema text not null default '',
  ordem integer not null,
  created_at timestamptz not null default now(),
  constraint ministerial_perguntas_ordem_check check (ordem > 0)
);

create table if not exists public.ministerial_opcoes (
  id text primary key,
  pergunta_id text not null references public.ministerial_perguntas (id) on delete cascade,
  texto_opcao text not null,
  perfil_pontuado text not null,
  ordem integer not null default 1,
  created_at timestamptz not null default now(),
  constraint ministerial_opcoes_perfil_check
    check (perfil_pontuado in ('PREGACAO', 'LOUVOR', 'PASTORAL', 'EVANGELISMO', 'DISCIPULADO', 'LIDERANCA'))
);

create index if not exists ministerial_opcoes_pergunta_idx
  on public.ministerial_opcoes (pergunta_id, ordem);

create table if not exists public.ministerial_respostas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pergunta_id text not null references public.ministerial_perguntas (id) on delete restrict,
  opcao_id text not null references public.ministerial_opcoes (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ministerial_respostas_profile_pergunta_unique unique (profile_id, pergunta_id)
);

create index if not exists ministerial_respostas_profile_idx
  on public.ministerial_respostas (profile_id);

create table if not exists public.ministerial_resultados (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  perfil_vencedor text not null,
  pontuacao_detalhada jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  constraint ministerial_resultados_perfil_check
    check (perfil_vencedor in ('PREGACAO', 'LOUVOR', 'PASTORAL', 'EVANGELISMO', 'DISCIPULADO', 'LIDERANCA')),
  constraint ministerial_resultados_profile_unique unique (profile_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ministerial_perguntas enable row level security;
alter table public.ministerial_opcoes enable row level security;
alter table public.ministerial_respostas enable row level security;
alter table public.ministerial_resultados enable row level security;

drop policy if exists ministerial_perguntas_select on public.ministerial_perguntas;
create policy ministerial_perguntas_select
  on public.ministerial_perguntas
  for select
  to anon, authenticated
  using (true);

-- Opções não são lidas diretamente (perfil_pontuado fica oculto) — apenas via RPC security definer.

drop policy if exists ministerial_respostas_select_own on public.ministerial_respostas;
create policy ministerial_respostas_select_own
  on public.ministerial_respostas
  for select
  to authenticated
  using (profile_id = public.current_session_profile_id());

drop policy if exists ministerial_resultados_select_own on public.ministerial_resultados;
create policy ministerial_resultados_select_own
  on public.ministerial_resultados
  for select
  to authenticated
  using (profile_id = public.current_session_profile_id());

-- Escritas somente via RPC security definer (sem policies de insert/update).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.ministerial_profile_label(p_code text)
returns text
language sql
immutable
as $$
  select case upper(trim(coalesce(p_code, '')))
    when 'PREGACAO' then 'Pregação'
    when 'LOUVOR' then 'Louvor'
    when 'PASTORAL' then 'Pastoral'
    when 'EVANGELISMO' then 'Evangelismo'
    when 'DISCIPULADO' then 'Discipulado'
    when 'LIDERANCA' then 'Liderança'
    else 'Indefinido'
  end;
$$;

create or replace function public.ministerial_profile_tiebreak_rank(p_code text)
returns integer
language sql
immutable
as $$
  -- Critério fixo de desempate (menor rank vence).
  select case upper(trim(coalesce(p_code, '')))
    when 'PREGACAO' then 1
    when 'DISCIPULADO' then 2
    when 'EVANGELISMO' then 3
    when 'PASTORAL' then 4
    when 'LIDERANCA' then 5
    when 'LOUVOR' then 6
    else 99
  end;
$$;

create or replace function public.compute_ministerial_profile_scores(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scores jsonb := '{}'::jsonb;
  v_row record;
begin
  for v_row in
    select o.perfil_pontuado as perfil, count(*)::integer as total
      from public.ministerial_respostas r
      join public.ministerial_opcoes o on o.id = r.opcao_id
     where r.profile_id = p_profile_id
     group by o.perfil_pontuado
  loop
    v_scores := v_scores || jsonb_build_object(v_row.perfil, v_row.total);
  end loop;

  return v_scores;
end;
$$;

create or replace function public.resolve_ministerial_winner_profile(p_scores jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_winner text := null;
  v_winner_score integer := -1;
  v_winner_rank integer := 999;
  v_code text;
  v_score integer;
  v_rank integer;
begin
  if p_scores is null or p_scores = '{}'::jsonb then
    return null;
  end if;

  for v_code in
    select * from unnest(array['PREGACAO','DISCIPULADO','EVANGELISMO','PASTORAL','LIDERANCA','LOUVOR'])
  loop
    v_score := coalesce((p_scores ->> v_code)::integer, 0);

    if v_score <= 0 then
      continue;
    end if;

    v_rank := public.ministerial_profile_tiebreak_rank(v_code);

    if v_score > v_winner_score
       or (v_score = v_winner_score and v_rank < v_winner_rank) then
      v_winner := v_code;
      v_winner_score := v_score;
      v_winner_rank := v_rank;
    end if;
  end loop;

  return v_winner;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs (leitura sem expor perfil_pontuado; escrita e cálculo no servidor)
-- ---------------------------------------------------------------------------

create or replace function public.listar_questionario_ministerial()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perguntas jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'texto', p.texto_pergunta,
        'bloco_tema', p.bloco_tema,
        'ordem', p.ordem,
        'opcoes', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', o.id,
                'texto', o.texto_opcao,
                'ordem', o.ordem
              )
              order by o.ordem
            ),
            '[]'::jsonb
          )
          from public.ministerial_opcoes o
          where o.pergunta_id = p.id
        )
      )
      order by p.ordem
    ),
    '[]'::jsonb
  )
  into v_perguntas
  from public.ministerial_perguntas p;

  return jsonb_build_object(
    'success', true,
    'total', jsonb_array_length(v_perguntas),
    'perguntas', v_perguntas
  );
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
  perform public.assert_session_profile_matches(p_profile_id);

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
  perform public.assert_session_profile_matches(p_profile_id);

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

grant execute on function public.listar_questionario_ministerial() to anon, authenticated;
grant execute on function public.obter_resultado_questionario_ministerial(uuid) to anon, authenticated;
grant execute on function public.submeter_questionario_ministerial(uuid, jsonb) to anon, authenticated;
