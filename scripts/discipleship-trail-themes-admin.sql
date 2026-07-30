-- =============================================================================
-- Temas da Trilha — RPCs admin multi-tenant + ACL
-- =============================================================================
-- Editores (pastoral/líderes) atualizam título/conteúdo/vídeo/reflexão por igreja.
-- tenant_id sempre vem da sessão (require_session_tenant_id) — nunca do cliente.
-- Pré-requisito: scripts/discipleship-trail-schema.sql
-- =============================================================================

create or replace function public.list_discipleship_trail_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.can_manage_discipleship_trail(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'modules', '[]'::jsonb);
  end if;

  begin
    perform public.ensure_discipleship_trail_five_modules(v_tenant);
  exception
    when undefined_function then
      perform public.seed_default_discipleship_trail(v_tenant);
    when others then
      null;
  end;

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant,
    'modules',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'title', m.title,
            'description', m.description,
            'sort_order', m.sort_order,
            'is_active', m.is_active,
            'is_seed', m.is_seed,
            'lessons',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', l.id,
                    'module_id', l.module_id,
                    'title', l.title,
                    'content', l.content,
                    'video_url', l.video_url,
                    'reflection_question', l.reflection_question,
                    'sort_order', l.sort_order,
                    'is_active', l.is_active,
                    'is_seed', l.is_seed
                  )
                  order by l.sort_order, l.title
                )
                from public.discipleship_lessons l
                where l.module_id = m.id
                  and l.tenant_id = v_tenant
              ),
              '[]'::jsonb
            )
          )
          order by m.sort_order, m.title
        )
        from public.discipleship_modules m
        where m.tenant_id = v_tenant
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_discipleship_trail_admin() to anon, authenticated;

create or replace function public.upsert_discipleship_module_admin(
  p_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_sort_order integer default null,
  p_is_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
begin
  if v_actor is null or not public.can_manage_discipleship_trail(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para editar a Trilha.');
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  if p_id is null then
    if v_title is null then
      return jsonb_build_object('success', false, 'message', 'Informe o título do módulo.');
    end if;

    insert into public.discipleship_modules (
      tenant_id, title, description, sort_order, is_active, is_seed
    ) values (
      v_tenant,
      v_title,
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_sort_order, (
        select coalesce(max(m.sort_order), 0) + 1
          from public.discipleship_modules m
         where m.tenant_id = v_tenant
      )),
      coalesce(p_is_active, true),
      false
    )
    returning id into v_id;
  else
    update public.discipleship_modules m
       set title = coalesce(v_title, m.title),
           description = case
             when p_description is null then m.description
             else nullif(trim(p_description), '')
           end,
           sort_order = coalesce(p_sort_order, m.sort_order),
           is_active = coalesce(p_is_active, m.is_active),
           updated_at = now()
     where m.id = p_id
       and m.tenant_id = v_tenant
    returning m.id into v_id;

    if v_id is null then
      return jsonb_build_object('success', false, 'message', 'Módulo não encontrado nesta igreja.');
    end if;
  end if;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

grant execute on function public.upsert_discipleship_module_admin(uuid, text, text, integer, boolean)
  to anon, authenticated;

create or replace function public.upsert_discipleship_lesson_admin(
  p_id uuid default null,
  p_module_id uuid default null,
  p_title text default null,
  p_content text default null,
  p_video_url text default null,
  p_reflection_question text default null,
  p_sort_order integer default null,
  p_is_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
  v_module_id uuid;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
begin
  if v_actor is null or not public.can_manage_discipleship_trail(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para editar a Trilha.');
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  if p_id is null then
    if p_module_id is null or v_title is null then
      return jsonb_build_object('success', false, 'message', 'Informe o módulo e o título da lição.');
    end if;

    select m.id into v_module_id
      from public.discipleship_modules m
     where m.id = p_module_id
       and m.tenant_id = v_tenant;

    if v_module_id is null then
      return jsonb_build_object('success', false, 'message', 'Módulo não encontrado nesta igreja.');
    end if;

    insert into public.discipleship_lessons (
      tenant_id, module_id, title, content, video_url, reflection_question, sort_order, is_active, is_seed
    ) values (
      v_tenant,
      v_module_id,
      v_title,
      nullif(trim(coalesce(p_content, '')), ''),
      nullif(trim(coalesce(p_video_url, '')), ''),
      nullif(trim(coalesce(p_reflection_question, '')), ''),
      coalesce(p_sort_order, (
        select coalesce(max(l.sort_order), 0) + 1
          from public.discipleship_lessons l
         where l.module_id = v_module_id
      )),
      coalesce(p_is_active, true),
      false
    )
    returning id into v_id;
  else
    update public.discipleship_lessons l
       set title = coalesce(v_title, l.title),
           content = case
             when p_content is null then l.content
             else nullif(trim(p_content), '')
           end,
           video_url = case
             when p_video_url is null then l.video_url
             else nullif(trim(p_video_url), '')
           end,
           reflection_question = case
             when p_reflection_question is null then l.reflection_question
             else nullif(trim(p_reflection_question), '')
           end,
           sort_order = coalesce(p_sort_order, l.sort_order),
           is_active = coalesce(p_is_active, l.is_active),
           updated_at = now()
     where l.id = p_id
       and l.tenant_id = v_tenant
    returning l.id into v_id;

    if v_id is null then
      return jsonb_build_object('success', false, 'message', 'Lição não encontrada nesta igreja.');
    end if;
  end if;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

grant execute on function public.upsert_discipleship_lesson_admin(
  uuid, uuid, text, text, text, text, integer, boolean
) to anon, authenticated;

-- ACL
insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'maintenance.card.discipleship_themes',
  'Temas da Trilha',
  'Editar módulos e lições da Trilha de Discipulado da igreja',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.discipleship_themes'
 where r.code in ('super_admin', 'pastoral', 'lider', 'lider_geral')
   and not exists (
     select 1
       from public.access_grants g
      where g.role_id = r.id
        and g.resource_id = res.id
        and g.profile_id is null
   );

notify pgrst, 'reload schema';

select 'discipleship-trail-themes-admin: ok' as status;
