-- =============================================================================
-- Trilha: gates server-side no progresso + ensure na sessão do membro
-- =============================================================================
-- Pré-requisitos:
--   scripts/discipleship-trail-schema.sql
--   scripts/discipleship-trail-badges-alerts.sql
--   scripts/discipleship-trail-five-modules-patch.sql
--   scripts/ministerial-profile-questionnaire.sql (ministerial_resultados)
-- =============================================================================

create or replace function public.is_discipleship_ministerial_gifts_lesson(
  p_module_sort integer,
  p_lesson_sort integer,
  p_lesson_title text
)
returns boolean
language sql
immutable
as $$
  select
    lower(trim(coalesce(p_lesson_title, ''))) like '%descobrindo meus dons%'
    or (coalesce(p_module_sort, 0) = 5 and coalesce(p_lesson_sort, 0) = 1);
$$;

comment on function public.is_discipleship_ministerial_gifts_lesson(integer, integer, text) is
  'Detecta a lição 5.1 Descobrindo meus Dons (Perfil Ministerial).';

grant execute on function public.is_discipleship_ministerial_gifts_lesson(integer, integer, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ensure 5 módulos para o tenant da sessão (chamado no fetch do membro)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_discipleship_trail_for_session()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
begin
  v_tenant := public.require_session_tenant_id();
  perform public.ensure_discipleship_trail_five_modules(v_tenant);
  return jsonb_build_object('success', true, 'tenant_id', v_tenant);
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

comment on function public.ensure_discipleship_trail_for_session() is
  'Garante seed 5×3 da Trilha no tenant da sessão (uso no fetch do membro).';

grant execute on function public.ensure_discipleship_trail_for_session()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Valida gates ao concluir lição (também protege upsert direto via RLS)
-- ---------------------------------------------------------------------------
create or replace function public.tg_user_discipleship_progress_gates()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_lesson record;
  v_answer text;
begin
  -- Preserva started_at na primeira transição para in_progress/completed
  if tg_op = 'UPDATE'
     and old.started_at is not null
     and new.status is distinct from 'not_started' then
    new.started_at := old.started_at;
  end if;

  if new.status is distinct from 'completed' then
    if new.status = 'not_started' then
      new.started_at := null;
      new.completed_at := null;
    elsif new.started_at is null then
      new.started_at := now();
    end if;
    if new.status is distinct from 'completed' then
      new.completed_at := null;
    end if;
    return new;
  end if;

  if new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.started_at is null then
    new.started_at := coalesce(
      case when tg_op = 'UPDATE' then old.started_at else null end,
      now()
    );
  end if;

  select
    l.id,
    l.title,
    l.reflection_question,
    l.sort_order as lesson_sort,
    l.is_active as lesson_active,
    m.sort_order as module_sort,
    m.is_active as module_active
  into v_lesson
  from public.discipleship_lessons l
  join public.discipleship_modules m on m.id = l.module_id
  where l.id = new.lesson_id
    and l.tenant_id = new.tenant_id
  limit 1;

  if not found then
    raise exception 'Lição da Trilha não encontrada para este tenant.';
  end if;

  if v_lesson.lesson_active is not true or v_lesson.module_active is not true then
    raise exception 'Esta lição não está disponível.';
  end if;

  v_answer := trim(coalesce(new.reflection_answer, ''));
  if nullif(trim(coalesce(v_lesson.reflection_question, '')), '') is not null
     and char_length(v_answer) < 3 then
    raise exception 'Responda a pergunta de reflexão antes de concluir.';
  end if;

  if public.is_discipleship_ministerial_gifts_lesson(
       v_lesson.module_sort,
       v_lesson.lesson_sort,
       v_lesson.title
     )
     and not exists (
       select 1
         from public.ministerial_resultados r
        where r.profile_id = new.profile_id
     ) then
    raise exception 'Preencha o Perfil Ministerial antes de concluir esta lição.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_discipleship_progress_gates
  on public.user_discipleship_progress;
create trigger trg_user_discipleship_progress_gates
  before insert or update on public.user_discipleship_progress
  for each row
  execute function public.tg_user_discipleship_progress_gates();

-- ---------------------------------------------------------------------------
-- RPC preferida do cliente: upsert + evaluate com mensagens claras
-- ---------------------------------------------------------------------------
create or replace function public.upsert_my_discipleship_lesson_progress(
  p_lesson_id uuid,
  p_status text,
  p_reflection_answer text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_profile uuid;
  v_lesson record;
  v_status text;
  v_now timestamptz := now();
  v_row public.user_discipleship_progress%rowtype;
  v_started timestamptz;
begin
  v_tenant := public.require_session_tenant_id();
  v_profile := public.current_session_profile_id();

  if v_profile is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida: perfil não identificado.');
  end if;

  v_status := lower(trim(coalesce(p_status, '')));
  if v_status not in ('not_started', 'in_progress', 'completed') then
    return jsonb_build_object('success', false, 'message', 'Status de progresso inválido.');
  end if;

  select
    l.id,
    l.tenant_id,
    l.title,
    l.reflection_question,
    l.sort_order as lesson_sort,
    l.is_active as lesson_active,
    m.sort_order as module_sort,
    m.is_active as module_active
  into v_lesson
  from public.discipleship_lessons l
  join public.discipleship_modules m on m.id = l.module_id
  where l.id = p_lesson_id
    and l.tenant_id = v_tenant
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Lição não encontrada nesta igreja.');
  end if;

  if v_lesson.lesson_active is not true or v_lesson.module_active is not true then
    return jsonb_build_object('success', false, 'message', 'Esta lição não está disponível.');
  end if;

  if v_status = 'completed' then
    if nullif(trim(coalesce(v_lesson.reflection_question, '')), '') is not null
       and char_length(trim(coalesce(p_reflection_answer, ''))) < 3 then
      return jsonb_build_object(
        'success', false,
        'message', 'Responda a pergunta de reflexão antes de concluir.'
      );
    end if;

    if public.is_discipleship_ministerial_gifts_lesson(
         v_lesson.module_sort,
         v_lesson.lesson_sort,
         v_lesson.title
       )
       and not exists (
         select 1 from public.ministerial_resultados r where r.profile_id = v_profile
       ) then
      return jsonb_build_object(
        'success', false,
        'message', 'Preencha o Perfil Ministerial antes de concluir esta lição.'
      );
    end if;
  end if;

  select p.started_at
    into v_started
    from public.user_discipleship_progress p
   where p.tenant_id = v_tenant
     and p.profile_id = v_profile
     and p.lesson_id = p_lesson_id;

  insert into public.user_discipleship_progress as p (
    tenant_id,
    profile_id,
    lesson_id,
    status,
    reflection_answer,
    started_at,
    completed_at
  ) values (
    v_tenant,
    v_profile,
    p_lesson_id,
    v_status,
    nullif(trim(coalesce(p_reflection_answer, '')), ''),
    case
      when v_status = 'not_started' then null
      else coalesce(v_started, v_now)
    end,
    case when v_status = 'completed' then v_now else null end
  )
  on conflict (tenant_id, profile_id, lesson_id) do update
    set status = excluded.status,
        reflection_answer = excluded.reflection_answer,
        started_at = case
          when excluded.status = 'not_started' then null
          else coalesce(p.started_at, excluded.started_at, v_now)
        end,
        completed_at = excluded.completed_at,
        updated_at = v_now
  returning * into v_row;

  perform public.evaluate_discipleship_achievements(
    v_tenant,
    v_profile,
    p_lesson_id
  );

  return jsonb_build_object(
    'success', true,
    'progress', jsonb_build_object(
      'id', v_row.id,
      'tenant_id', v_row.tenant_id,
      'profile_id', v_row.profile_id,
      'lesson_id', v_row.lesson_id,
      'status', v_row.status,
      'reflection_answer', v_row.reflection_answer,
      'started_at', v_row.started_at,
      'completed_at', v_row.completed_at
    )
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

comment on function public.upsert_my_discipleship_lesson_progress(uuid, text, text) is
  'Atualiza progresso da Trilha do perfil efetivo; exige reflexão e Perfil Ministerial na 5.1.';

grant execute on function public.upsert_my_discipleship_lesson_progress(uuid, text, text)
  to anon, authenticated, service_role;
