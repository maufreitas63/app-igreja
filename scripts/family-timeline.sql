-- Linha do tempo da família: costura recepção, régua, app, culto, célula,
-- trilha e (se tesouraria) PIX de campanha. Sem Coração Aberto, sem PIN.
-- Desligar nesta igreja: RPC set_family_timeline_feature(false).
-- Remover de vez: scripts/family-timeline-undo.sql
-- Execute: npx supabase db query --linked -f scripts/family-timeline.sql

begin;

create table if not exists public.family_timeline_settings (
  tenant_id uuid primary key references public.igrejas (id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles (id) on delete set null
);

alter table public.family_timeline_settings enable row level security;

drop policy if exists family_timeline_settings_deny_direct on public.family_timeline_settings;
create policy family_timeline_settings_deny_direct
  on public.family_timeline_settings for all using (false) with check (false);

revoke all on table public.family_timeline_settings from public, anon, authenticated;

create or replace function public.family_timeline_enabled_for_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.enabled from public.family_timeline_settings s where s.tenant_id = p_tenant),
    true
  );
$$;

create or replace function public.session_can_view_family_timeline()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.session_has_resource_access('screen', 'maintenance.card.family_timeline', 'view')
    or public.session_has_resource_access('screen', 'maintenance.card.visitor_followup', 'view')
    or public.session_has_resource_access('screen', 'maintenance.card.profile_cadastro', 'view'),
    false
  );
$$;

create or replace function public.session_can_see_family_timeline_giving()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.session_has_resource_access('screen', 'maintenance.card.financials', 'view')
    or public.profile_has_role_code(public.current_session_profile_id(), 'tesoureiro'),
    false
  );
$$;

create or replace function public.family_timeline_feature_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_sa boolean;
begin
  if v_profile is null then
    return jsonb_build_object('success', false, 'enabled', false, 'can_toggle', false);
  end if;

  v_tenant := public.require_session_tenant_id();
  v_sa := public.is_super_admin_profile(v_profile);

  if not public.session_can_view_family_timeline() then
    return jsonb_build_object('success', false, 'enabled', false, 'can_toggle', false);
  end if;

  return jsonb_build_object(
    'success', true,
    'enabled', public.family_timeline_enabled_for_tenant(v_tenant),
    'can_toggle', v_sa
  );
end;
$$;

create or replace function public.set_family_timeline_feature(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid;
begin
  if v_profile is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.is_super_admin_profile(v_profile) then
    return jsonb_build_object('success', false, 'message', 'Somente o Super Administrador oculta ou reativa este recurso.');
  end if;

  v_tenant := public.require_session_tenant_id();

  insert into public.family_timeline_settings (tenant_id, enabled, updated_at, updated_by)
  values (v_tenant, coalesce(p_enabled, false), now(), v_profile)
  on conflict (tenant_id) do update
    set enabled = excluded.enabled,
        updated_at = now(),
        updated_by = excluded.updated_by;

  return jsonb_build_object(
    'success', true,
    'enabled', coalesce(p_enabled, false),
    'message', case
      when coalesce(p_enabled, false)
        then 'Linha do tempo reativada nesta igreja.'
      else 'Linha do tempo oculta nesta igreja. O código permanece; reative aqui ou rode scripts/family-timeline-undo.sql para remover.'
    end
  );
end;
$$;

create or replace function public.search_family_timeline(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text;
begin
  if v_profile is null then
    return jsonb_build_object('success', false, 'families', '[]'::jsonb);
  end if;

  if not public.session_can_view_family_timeline() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para a linha do tempo da família.');
  end if;

  v_tenant := public.require_session_tenant_id();
  perform set_config('statement_timeout', '6000', true);

  if not public.family_timeline_enabled_for_tenant(v_tenant)
     and not public.is_super_admin_profile(v_profile) then
    return jsonb_build_object('success', true, 'enabled', false, 'families', '[]'::jsonb);
  end if;

  if v_q is null or char_length(v_q) < 2 then
    return jsonb_build_object(
      'success', true,
      'enabled', public.family_timeline_enabled_for_tenant(v_tenant),
      'families', '[]'::jsonb
    );
  end if;

  v_digits := nullif(regexp_replace(v_q, '\D', '', 'g'), '');

  return jsonb_build_object(
    'success', true,
    'enabled', public.family_timeline_enabled_for_tenant(v_tenant),
    'families',
    coalesce(
      (
        select jsonb_agg(item order by item->>'name')
        from (
          select jsonb_build_object(
            'family_id', g.family_id,
            'name', g.rep_name,
            'member_count', g.member_count,
            'roles', g.roles
          ) as item
          from (
            select
              p.family_id,
              min(p.full_name) filter (
                where p.full_name is not null and btrim(p.full_name) <> ''
              ) as rep_name,
              count(*)::int as member_count,
              string_agg(distinct coalesce(nullif(btrim(p.role), ''), 'visitante'), ', ') as roles
            from public.profiles p
           where p.tenant_id = v_tenant
             and p.family_id is not null
             and btrim(p.family_id) <> ''
             -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
             and public.profile_visible_to_access_actor(v_profile, p.id)
             and (
               p.family_id ilike v_q || '%'
               or p.full_name ilike '%' || v_q || '%'
               or (
                 char_length(coalesce(v_digits, '')) >= 4
                 and p.phone like '%' || v_digits || '%'
               )
             )
           group by p.family_id
           limit 20
          ) g
        ) x
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.get_family_timeline(p_family_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_family text := btrim(coalesce(p_family_id, ''));
  v_see_giving boolean;
  v_ids uuid[];
  v_members jsonb;
  v_events jsonb;
  v_next text;
  v_has_d1_pending boolean := false;
  v_has_d4_pending boolean := false;
  v_has_d8_pending boolean := false;
  v_has_group boolean := false;
  v_has_checkin boolean := false;
  v_has_visitor boolean := false;
begin
  if v_profile is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.session_can_view_family_timeline() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para a linha do tempo da família.');
  end if;

  v_tenant := public.require_session_tenant_id();
  perform set_config('statement_timeout', '8000', true);

  if not public.family_timeline_enabled_for_tenant(v_tenant)
     and not public.is_super_admin_profile(v_profile) then
    return jsonb_build_object('success', false, 'enabled', false, 'message', 'Linha do tempo oculta nesta igreja.');
  end if;

  if v_family = '' then
    return jsonb_build_object('success', false, 'message', 'Informe a família.');
  end if;

  v_see_giving := public.session_can_see_family_timeline_giving();

  select coalesce(array_agg(p.id), array[]::uuid[])
    into v_ids
    from public.profiles p
   where p.tenant_id = v_tenant
     and lower(btrim(p.family_id)) = lower(v_family)
     -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
     and public.profile_visible_to_access_actor(v_profile, p.id);

  if v_ids is null or coalesce(array_length(v_ids, 1), 0) = 0 then
    return jsonb_build_object('success', false, 'message', 'Família não encontrada nesta igreja.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', coalesce(nullif(btrim(p.full_name), ''), 'Sem nome'),
      'role', coalesce(nullif(btrim(p.role), ''), 'visitante'),
      'lgpd', coalesce(p.lgpd_accepted, false),
      'has_selfie', coalesce(p.selfie_url, '') <> ''
    ) order by p.full_name), '[]'::jsonb)
    into v_members
    from public.profiles p
   where p.id = any (v_ids);

  select coalesce(bool_or(lower(coalesce(p.role, '')) in ('visitor', 'visitante', 'visitantes')), false)
    into v_has_visitor
    from public.profiles p
   where p.id = any (v_ids);

  select coalesce(jsonb_agg(ev.item order by (nullif(ev.item->>'at', ''))::timestamptz nulls last, ev.item->>'kind'), '[]'::jsonb)
    into v_events
    from (
      select raw.item
      from (
      select jsonb_build_object(
        'kind', 'recepcao',
        'at', coalesce(l.processed_at, l.created_at),
        'title', 'Recebida na Recepção Familiar',
        'detail', 'Lote ' || coalesce(l.status, ''),
        'status', coalesce(l.status, '')
      ) as item
      from public.recepcao_cadastro_familiar_lote l
     where l.tenant_id = v_tenant
       and (
         lower(btrim(coalesce(l.detected_family_id, ''))) = lower(v_family)
         or exists (
           select 1
             from public.recepcao_cadastro_familiar r
            where r.submission_id = l.id
              and r.tenant_id = v_tenant
              and (
                lower(btrim(coalesce(r.applied_family_id, r.detected_family_id, ''))) = lower(v_family)
                or r.applied_profile_id = any (v_ids)
              )
         )
       )

      union all

      select jsonb_build_object(
        'kind', 'regua',
        'at', coalesce(t.completed_at, t.data_programada::timestamptz, t.created_at),
        'title', case t.tipo_tarefa
          when 'whatsapp_dia_1' then 'Régua D+1 — WhatsApp'
          when 'convite_celula_dia_4' then 'Régua D+4 — Convite à célula'
          when 'ligacao_pastor_dia_8' then 'Régua D+8 — Culto / pastor'
          else t.tipo_tarefa
        end,
        'detail', coalesce(nullif(btrim(p.full_name), ''), 'Visitante')
          || ' · ' || coalesce(t.status, ''),
        'status', coalesce(t.status, '')
      )
      from public.task_alerts t
      join public.profiles p on p.id = t.visitor_id
     where t.tenant_id = v_tenant
       and t.visitor_id = any (v_ids)

      union all

      select jsonb_build_object(
        'kind', 'lgpd',
        'at', coalesce(p.lgpd_accepted_at, p.created_at),
        'title', 'Aceitou LGPD e entrou no app',
        'detail', coalesce(nullif(btrim(p.full_name), ''), 'Membro'),
        'status', 'feito'
      )
      from public.profiles p
     where p.id = any (v_ids)
       and coalesce(p.lgpd_accepted, false)

      union all

      select jsonb_build_object(
        'kind', 'selfie',
        'at', p.created_at,
        'title', 'Selfie na carteirinha',
        'detail', coalesce(nullif(btrim(p.full_name), ''), 'Membro'),
        'status', 'feito'
      )
      from public.profiles p
     where p.id = any (v_ids)
       and coalesce(p.selfie_url, '') <> ''

      union all

      select item from (
      select jsonb_build_object(
        'kind', 'pre_checkin',
        'at', coalesce(er.check_in_time, er.created_at),
        'title', 'Pré-check-in na Agenda da Família',
        'detail', coalesce(e.name, 'Evento'),
        'status', coalesce(er.status, '')
      ) as item
      from public.event_registrations er
      left join public.events e
        on e.id = er.event_id
       and e.tenant_id = er.tenant_id
     where er.tenant_id = v_tenant
       and (
         er.profile_id = any (v_ids)
         or lower(btrim(coalesce(er.family_id, ''))) = lower(v_family)
       )
     order by coalesce(er.check_in_time, er.created_at) desc
     limit 8
      ) pre_cap

      union all

      select item from (
      select jsonb_build_object(
        'kind', 'totem',
        'at', coalesce(c.timestamp_confirmacao, c.created_at),
        'title', 'Confirmada no totem',
        'detail', coalesce(e.name, 'Culto'),
        'status', coalesce(c.status, '')
      ) as item
      from public.checkins c
      left join public.events e
        on e.id = c.event_id
       and e.tenant_id = c.tenant_id
     where c.tenant_id = v_tenant
       and (
         c.profile_id = any (v_ids)
         or lower(btrim(coalesce(c.family_id, ''))) = lower(v_family)
       )
     order by coalesce(c.timestamp_confirmacao, c.created_at) desc
     limit 8
      ) totem_cap

      union all

      select jsonb_build_object(
        'kind', 'celula',
        'at', coalesce(sgm.joined_at, sgm.created_at),
        'title', 'Entrou na célula',
        'detail', coalesce(sg.name, 'Pequeno grupo')
          || ' · ' || coalesce(nullif(btrim(p.full_name), ''), ''),
        'status', 'feito'
      )
      from public.small_group_members sgm
      join public.small_groups sg
        on sg.id = sgm.small_group_id
       and sg.tenant_id = sgm.tenant_id
      join public.profiles p on p.id = sgm.profile_id
     where sgm.tenant_id = v_tenant
       and sgm.profile_id = any (v_ids)

      union all

      select jsonb_build_object(
        'kind', 'trilha',
        'at', max(coalesce(udp.completed_at, udp.updated_at, udp.created_at)),
        'title', 'Trilha de discipulado',
        'detail', coalesce(nullif(btrim(p.full_name), ''), 'Membro')
          || ' · '
          || count(*) filter (where udp.completed_at is not null)::text
          || ' lição(ões) concluída(s)',
        'status', 'andamento'
      )
      from public.user_discipleship_progress udp
      join public.profiles p on p.id = udp.profile_id
     where udp.tenant_id = v_tenant
       and udp.profile_id = any (v_ids)
     group by p.id, p.full_name

      union all

      select item from (
      select jsonb_build_object(
        'kind', 'campanha',
        'at', i.created_at,
        'title', 'PIX de campanha',
        'detail', coalesce(cp.titulo, 'Campanha'),
        'status', 'feito'
      ) as item
      from public.campaign_contribution_intents i
      left join public.campaign_projects cp
        on cp.id = i.campaign_id
       and cp.tenant_id = i.tenant_id
     where v_see_giving
       and i.tenant_id = v_tenant
       and i.profile_id = any (v_ids)
     order by i.created_at desc
     limit 8
      ) camp_cap
      ) raw
      order by (nullif(raw.item->>'at', ''))::timestamptz desc nulls last
      limit 40
    ) ev;

  select coalesce(bool_or(t.tipo_tarefa = 'whatsapp_dia_1' and t.status = 'Pendente'), false),
         coalesce(bool_or(t.tipo_tarefa = 'convite_celula_dia_4' and t.status = 'Pendente'), false),
         coalesce(bool_or(t.tipo_tarefa = 'ligacao_pastor_dia_8' and t.status = 'Pendente'), false)
    into v_has_d1_pending, v_has_d4_pending, v_has_d8_pending
    from public.task_alerts t
   where t.tenant_id = v_tenant
     and t.visitor_id = any (v_ids);

  select exists (
    select 1 from public.small_group_members sgm
     where sgm.tenant_id = v_tenant and sgm.profile_id = any (v_ids)
  ) into v_has_group;

  select exists (
    select 1 from public.checkins c
     where c.tenant_id = v_tenant
       and (c.profile_id = any (v_ids) or lower(btrim(coalesce(c.family_id, ''))) = lower(v_family))
  ) into v_has_checkin;

  v_next := case
    when v_has_d1_pending then 'Próximo: WhatsApp D+1 na Régua de Acolhimento.'
    when v_has_d4_pending then 'Próximo: convite à célula (D+4) na Régua de Acolhimento.'
    when v_has_d8_pending then 'Próximo: conferir culto / alerta pastoral (D+8).'
    when not v_has_group then 'Próximo: encaminhar à célula (Gestão de Pequenos Grupos).'
    when v_has_visitor then 'Próximo: avaliar visitante → congregado/membro (Mudança de Papéis).'
    when not v_has_checkin then 'Próximo: presença no culto (Agenda da Família / totem).'
    else 'Família em acompanhamento. Nada urgente na régua.'
  end;

  return jsonb_build_object(
    'success', true,
    'enabled', public.family_timeline_enabled_for_tenant(v_tenant),
    'can_toggle', public.is_super_admin_profile(v_profile),
    'family_id', v_family,
    'members', v_members,
    'next_hint', v_next,
    'events', v_events
  );
end;
$$;

grant execute on function public.family_timeline_enabled_for_tenant(uuid) to anon, authenticated;
grant execute on function public.session_can_view_family_timeline() to anon, authenticated;
grant execute on function public.session_can_see_family_timeline_giving() to anon, authenticated;
grant execute on function public.family_timeline_feature_state() to anon, authenticated;
grant execute on function public.set_family_timeline_feature(boolean) to anon, authenticated;
grant execute on function public.search_family_timeline(text) to anon, authenticated;
grant execute on function public.get_family_timeline(text) to anon, authenticated;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'maintenance.card.family_timeline',
  'Linha do tempo da família',
  'Jornada da família nesta igreja: recepção, régua, app, culto, célula e trilha.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select g.role_id, dest.id, g.can_view, g.can_update
  from public.access_resources dest
  join public.access_resources src
    on src.resource_type = 'screen'
   and src.resource_key = 'maintenance.card.profile_cadastro'
  join public.access_grants g
    on g.resource_id = src.id
 where dest.resource_type = 'screen'
   and dest.resource_key = 'maintenance.card.family_timeline'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.family_timeline'
 where r.code in ('super_admin', 'secretaria', 'pastoral', 'lider', 'lider_geral', 'family_acceptor')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      updated_at = now();

create or replace function public._seed_knowledge_article(
  p_slug text,
  p_title text,
  p_question text,
  p_body text,
  p_route_key text,
  p_roles text[],
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.knowledge_articles
   where tenant_id is null
     and lower(slug) = lower(p_slug);

  if v_id is null then
    insert into public.knowledge_articles (
      slug, title, question, body, route_key, tenant_id, is_published, sort_order
    )
    values (p_slug, p_title, p_question, p_body, p_route_key, null, true, p_sort_order)
    returning id into v_id;
  else
    update public.knowledge_articles
       set title = p_title,
           question = p_question,
           body = p_body,
           route_key = p_route_key,
           is_published = true,
           sort_order = p_sort_order,
           updated_at = now()
     where id = v_id;
  end if;

  delete from public.knowledge_article_roles where article_id = v_id;
  insert into public.knowledge_article_roles (article_id, role_code)
  select v_id, code from unnest(p_roles) as code;
end;
$$;

select public._seed_knowledge_article(
  'linha-tempo-familia',
  'Linha do tempo da família',
  'Como vejo o caminho de uma família nesta igreja?',
  $body$## Quando usar
Acolhimento e secretaria: saber onde a família parou (recepção, régua, culto, célula) sem abrir seis telas.

## Passo a passo
1. Busque por nome, celular ou código da família (mínimo 2 caracteres).
2. Abra o núcleo. A linha começa na Recepção e segue D+1 / D+4 / D+8, app, totem, célula e trilha.
3. O recado no topo diz o próximo passo operacional.

## O que não aparece
Pedido do Coração Aberto (sigilo), PIN e valores de caixa. PIX de campanha só se o seu papel for tesouraria.

## Desfazer
O Super Administrador pode ocultar o recurso nesta igreja. Isso não apaga cadastros.$body$,
  'maintenance-dashboard?panel=family_timeline',
  array[
    'pastoral', 'tesoureiro', 'secretaria', 'events_admin',
    'gestor_controle_acesso', 'super_admin'
  ],
  285
);

drop function if exists public._seed_knowledge_article(text, text, text, text, text, text[], integer);

notify pgrst, 'reload schema';

commit;
