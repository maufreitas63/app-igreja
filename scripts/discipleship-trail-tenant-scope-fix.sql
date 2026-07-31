-- =============================================================================
-- Trilha: SELECT só da igreja da sessão (evita SA misturar IBN + IBEP)
-- + mensagem clara no upsert se a lição for de outro tenant
-- =============================================================================

drop policy if exists discipleship_modules_select_tenant on public.discipleship_modules;
create policy discipleship_modules_select_tenant
  on public.discipleship_modules
  for select
  using (public.session_tenant_matches(tenant_id));

drop policy if exists discipleship_lessons_select_tenant on public.discipleship_lessons;
create policy discipleship_lessons_select_tenant
  on public.discipleship_lessons
  for select
  using (public.session_tenant_matches(tenant_id));

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
  v_other_tenant uuid;
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
    select l.tenant_id
      into v_other_tenant
      from public.discipleship_lessons l
     where l.id = p_lesson_id
     limit 1;

    if v_other_tenant is not null then
      return jsonb_build_object(
        'success', false,
        'message',
        'Esta lição pertence a outra igreja. Confirme a igreja ativa e reabra a Trilha.'
      );
    end if;

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
