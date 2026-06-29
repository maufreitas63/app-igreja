-- Temas de Sugestões e Melhorias: tabela de referência + coluna tema_id nas solicitações.
-- Execute no SQL Editor do Supabase após maintenance-support-suggestions.sql.

-- ---------------------------------------------------------------------------
-- Tabela de temas
-- ---------------------------------------------------------------------------

create table if not exists public.maintenance_support_themes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint maintenance_support_themes_titulo_check
    check (char_length(trim(titulo)) > 0),
  constraint maintenance_support_themes_titulo_unique unique (titulo)
);

create index if not exists maintenance_support_themes_sort_idx
  on public.maintenance_support_themes (is_active, sort_order, titulo);

insert into public.maintenance_support_themes (titulo, sort_order)
values
  ('Modelo SaaS e Limites de Customização', 1),
  ('Evolução do Produto e Roadmap', 2),
  ('Gestão de Feedback e Centralização de Sugestões', 3),
  ('Governança e Transparência do Processo', 4),
  ('Participação da Instituição e Modelo de Validação', 5)
on conflict (titulo) do update
  set sort_order = excluded.sort_order,
      is_active = true;

alter table public.maintenance_support_requests
  add column if not exists tema_id uuid null
    references public.maintenance_support_themes (id) on delete set null;

create index if not exists maintenance_support_requests_tema_idx
  on public.maintenance_support_requests (tema_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- ACL da tabela de temas
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'table',
  'maintenance_support_themes',
  'Tabela — Temas de suporte',
  'Temas classificatórios das solicitações em Sugestões e Melhorias.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code = 'super_admin'
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'table'
   and res.resource_key = 'maintenance_support_themes'
 where r.code in ('super_admin', 'events_admin', 'pastoral', 'tesoureiro')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.maintenance_support_themes enable row level security;

drop policy if exists maintenance_support_themes_select on public.maintenance_support_themes;
create policy maintenance_support_themes_select
  on public.maintenance_support_themes
  for select
  to anon, authenticated
  using (
    is_active = true
    and (
      public.can_manage_maintenance_support()
      or public.session_has_screen_access('maintenance.card.suggestions_improvements', 'view')
      or public.current_session_profile_id() is not null
    )
  );

grant select on public.maintenance_support_themes to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Relatório: incluir tema nas solicitações
-- ---------------------------------------------------------------------------

create or replace function public._report_support_suggestions(p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_summary jsonb;
  v_table_exists boolean;
begin
  select exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'maintenance_support_requests'
  )
    into v_table_exists;

  if not v_table_exists then
    return jsonb_build_object(
      'success', false,
      'report_code', 'support_suggestions',
      'message', 'Execute no Supabase: scripts/maintenance-support-suggestions.sql'
    );
  end if;

  with base_requests as (
    select
      r.id,
      r.requester_name,
      r.requester_phone,
      r.record_type,
      r.description,
      r.status,
      r.developer_action,
      r.developer_guidance,
      r.estimated_completion_date,
      r.whatsapp_authorized,
      r.notify_in_app,
      r.created_at,
      r.updated_at,
      r.responded_at,
      coalesce(nullif(trim(t.titulo), ''), '') as tema
    from public.maintenance_support_requests r
    left join public.maintenance_support_themes t on t.id = r.tema_id
  ),
  attachment_summary as (
    select
      a.request_id,
      count(*)::int as anexos_qtd,
      coalesce(
        jsonb_agg(
          coalesce(nullif(trim(a.file_name), ''), 'imagem')
          order by a.sort_order, a.created_at
        ),
        '[]'::jsonb
      ) as anexos_nomes
    from public.maintenance_support_attachments a
    where a.is_active = true
    group by a.request_id
  ),
  all_events as (
    select
      br.id as request_id,
      br.created_at as data_hora,
      'Abertura'::text as tipo,
      'App'::text as canal,
      br.requester_name as autor,
      'Usuário'::text as papel,
      br.description as mensagem
    from base_requests br

    union all

    select
      br.id,
      i.created_at,
      case i.channel::text
        when 'status' then 'Tratamento'
        when 'attachment' then 'Anexo'
        else 'Interação'
      end,
      case i.channel::text
        when 'app' then 'App'
        when 'whatsapp' then 'WhatsApp'
        when 'status' then 'Status'
        when 'attachment' then 'Anexo'
        else i.channel::text
      end,
      i.actor_name,
      case i.actor_role::text
        when 'user' then 'Usuário'
        when 'developer' then 'Desenvolvedor'
        when 'system' then 'Sistema'
        else i.actor_role::text
      end,
      i.message
    from public.maintenance_support_interactions i
    join base_requests br on br.id = i.request_id

    union all

    select
      br.id,
      c.sent_at,
      'Comunicação',
      case c.channel::text
        when 'in_app' then 'Notificação no app'
        when 'whatsapp' then 'WhatsApp'
        else c.channel::text
      end,
      coalesce(nullif(trim(p.full_name), ''), 'Desenvolvedor'),
      'Desenvolvedor',
      trim(
        both E'\n'
        from concat_ws(
          E'\n',
          nullif(trim(c.subject), ''),
          nullif(trim(c.message), '')
        )
      )
    from public.maintenance_support_communications c
    join base_requests br on br.id = c.request_id
    left join public.profiles p on p.id = c.sent_by_profile_id
  ),
  historico_by_request as (
    select
      e.request_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'data_hora', e.data_hora,
            'tipo', e.tipo,
            'canal', e.canal,
            'autor', e.autor,
            'papel', e.papel,
            'mensagem', e.mensagem
          )
          order by e.data_hora asc, e.tipo asc
        ),
        '[]'::jsonb
      ) as historico
    from all_events e
    group by e.request_id
  ),
  requests_enriched as (
    select
      br.requester_name as solicitante,
      coalesce(nullif(trim(br.requester_phone), ''), '') as telefone,
      case br.record_type::text
        when 'suggestion' then 'Sugestão'
        when 'question' then 'Dúvida'
        when 'comment' then 'Comentário'
        when 'incident' then 'Problema/Incidente'
        else br.record_type::text
      end as tipo,
      br.tema,
      case br.status::text
        when 'received' then 'Recebida'
        when 'in_review' then 'Em análise'
        when 'in_development' then 'Em desenvolvimento'
        when 'awaiting_validation' then 'Aguardando validação'
        when 'completed' then 'Concluída'
        when 'not_applicable' then 'Não aplicável'
        else br.status::text
      end as status,
      br.created_at as abertura_em,
      br.updated_at as atualizado_em,
      br.responded_at as respondido_em,
      br.description as descricao,
      br.developer_action as acao_desenvolvedor,
      br.developer_guidance as orientacoes,
      to_char(br.estimated_completion_date, 'DD/MM/YYYY') as previsao_conclusao,
      coalesce(asum.anexos_qtd, 0) as anexos,
      coalesce(asum.anexos_nomes, '[]'::jsonb) as anexos_nomes,
      br.whatsapp_authorized as whatsapp_autorizado,
      br.notify_in_app as notificar_app,
      coalesce(h.historico, '[]'::jsonb) as historico
    from base_requests br
    left join attachment_summary asum on asum.request_id = br.id
    left join historico_by_request h on h.request_id = br.id
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'solicitante', re.solicitante,
          'telefone', re.telefone,
          'tipo', re.tipo,
          'tema', re.tema,
          'status', re.status,
          'abertura_em', re.abertura_em,
          'atualizado_em', re.atualizado_em,
          'respondido_em', re.respondido_em,
          'descricao', re.descricao,
          'acao_desenvolvedor', re.acao_desenvolvedor,
          'orientacoes', re.orientacoes,
          'previsao_conclusao', re.previsao_conclusao,
          'anexos', re.anexos,
          'anexos_nomes', re.anexos_nomes,
          'whatsapp_autorizado', re.whatsapp_autorizado,
          'notificar_app', re.notificar_app,
          'historico', re.historico
        )
        order by re.abertura_em asc
      ),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'total_solicitacoes', (select count(*) from base_requests),
      'interacoes', (select count(*) from public.maintenance_support_interactions),
      'comunicacoes', (select count(*) from public.maintenance_support_communications),
      'eventos_historico', (select count(*) from all_events)
    )
  into v_rows, v_summary
  from requests_enriched re;

  return public._maintenance_report_payload(
    'support_suggestions',
    array[
      'solicitante',
      'telefone',
      'tipo',
      'tema',
      'status',
      'abertura_em',
      'atualizado_em',
      'respondido_em',
      'descricao',
      'acao_desenvolvedor',
      'orientacoes',
      'previsao_conclusao',
      'anexos',
      'anexos_nomes',
      'whatsapp_autorizado',
      'notificar_app',
      'historico'
    ],
    v_rows,
    v_summary
  );
end;
$$;

notify pgrst, 'reload schema';
