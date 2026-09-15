-- =============================================================================
-- Assistente IA: snapshot operacional da instância da sessão
-- =============================================================================
-- Isolamento: tenant_id vem SOMENTE de current_session_tenant_id().
-- Nunca aceita tenant informado pelo cliente/modelo.
-- SECURITY DEFINER + liderança + assert_actor_matches_session.
-- Agregados e listas curtas — sem dump de PII, PIN, PIX, totem ou pastoral.
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- =============================================================================

create or replace function public.obter_contexto_ia_lideranca(p_actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_is_gestor boolean := false;
  v_can_finance boolean := false;
  v_can_pastoral boolean := false;
  v_igreja jsonb;
  v_pessoas jsonb;
  v_eventos jsonb;
  v_eventos_recentes jsonb := '[]'::jsonb;
  v_eventos_proximos jsonb := '[]'::jsonb;
  v_grupos jsonb := '[]'::jsonb;
  v_financas jsonb;
  v_pastoral jsonb;
  v_despesas jsonb;
begin
  if p_actor_profile_id is null then
    raise exception 'nao autorizado para esta funçao';
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.profile_is_leadership(p_actor_profile_id) then
    raise exception 'nao autorizado para esta funçao';
  end if;

  -- Fonte única de isolamento: sessão (header autorizado ou igreja do perfil efetivo).
  v_tenant := public.current_session_tenant_id();

  if v_tenant is null then
    raise exception 'Sessão sem igreja (tenant) vinculada.';
  end if;

  if not public.profile_can_use_tenant(p_actor_profile_id, v_tenant) then
    raise exception 'nao autorizado para esta funçao';
  end if;

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  v_is_gestor :=
    public.profile_has_role_code(p_actor_profile_id, 'gestor_controle_acesso')
    and not public.is_super_admin_profile(p_actor_profile_id);

  v_can_finance :=
    public.is_super_admin_profile(p_actor_profile_id)
    or public.profile_has_role_code(p_actor_profile_id, 'tesoureiro')
    or public.session_has_resource_access('table', 'financials', 'view')
    or public.session_has_screen_access('maintenance.card.financials', 'view')
    or public.session_has_screen_access('/financial', 'view');

  v_can_pastoral :=
    public.profile_has_role_code(p_actor_profile_id, 'pastoral')
    or public.is_super_admin_profile(p_actor_profile_id)
    or public.session_has_screen_access('maintenance.card.pastoral_care', 'view');

  select jsonb_build_object(
    'codigo', i.code,
    'nome', i.name,
    'ativa', i.is_active,
    'site', nullif(trim(coalesce(i.website_url, '')), ''),
    'instagram', nullif(trim(coalesce(i.instagram_url, '')), ''),
    'youtube', nullif(trim(coalesce(i.youtube_url, '')), '')
  )
    into v_igreja
    from public.igrejas i
   where i.id = v_tenant;

  if v_igreja is null then
    raise exception 'Igreja da sessão não encontrada.';
  end if;

  begin
    select jsonb_build_object(
      'membros_ativos', count(*) filter (where papel = 'member'),
      'congregados_ativos', count(*) filter (where papel = 'congregado'),
      'visitantes', count(*) filter (where papel = 'visitante'),
      'outros', count(*) filter (where papel is null or papel not in ('member', 'congregado', 'visitante')),
      'familias', count(distinct nullif(trim(coalesce(family_id, '')), '')),
      'aniversariantes_mes', count(*) filter (
        where birth_date is not null
          and extract(month from birth_date) = extract(month from (now() at time zone 'America/Sao_Paulo'))
      ),
      'total_cadastros_visiveis', count(*)
    )
      into v_pessoas
      from (
        select
          p.family_id,
          p.birth_date,
          public.resolve_basic_role_code_for_profile(p.id) as papel
          from public.profiles p
         where p.tenant_id = v_tenant
           and coalesce(
             nullif(trim(p.full_name), ''),
             nullif(trim(p.phone), ''),
             nullif(trim(p.codigo_membro), '')
           ) is not null
           and coalesce(p.membership_out::text, '') = ''
           and (
             not v_is_gestor
             or not public.is_super_admin_profile(p.id)
           )
      ) pessoas;
  exception
    when others then
      v_pessoas := jsonb_build_object(
        'total_cadastros_visiveis', (
          select count(*)::int
            from public.profiles p
           where p.tenant_id = v_tenant
        )
      );
  end;

  begin
    select jsonb_build_object(
      'na_instancia', count(*)::int,
      'realizados_90_dias', count(*) filter (
        where e.event_date >= (now() - interval '90 days') and e.event_date < now()
      )::int,
      'proximos_30_dias', count(*) filter (
        where e.event_date >= now() and e.event_date < (now() + interval '30 days')
      )::int
    )
      into v_eventos
      from public.events e
     where e.tenant_id = v_tenant;

    select coalesce(jsonb_agg(ev.item order by ev.sort_date desc), '[]'::jsonb)
      into v_eventos_recentes
      from (
        select
          e.event_date as sort_date,
          jsonb_build_object(
            'nome', e.name,
            'data', to_char(e.event_date at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI'),
            'local', nullif(trim(coalesce(e.event_local, '')), ''),
            'inscritos', (
              select count(*)::int
                from public.event_registrations er
               where er.event_id = e.id
                 and er.tenant_id = v_tenant
            )
          ) as item
          from public.events e
         where e.tenant_id = v_tenant
           and e.event_date < now()
         order by e.event_date desc
         limit 12
      ) ev;

    select coalesce(jsonb_agg(ev.item order by ev.sort_date), '[]'::jsonb)
      into v_eventos_proximos
      from (
        select
          e.event_date as sort_date,
          jsonb_build_object(
            'nome', e.name,
            'data', to_char(e.event_date at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI'),
            'local', nullif(trim(coalesce(e.event_local, '')), ''),
            'inscritos', (
              select count(*)::int
                from public.event_registrations er
               where er.event_id = e.id
                 and er.tenant_id = v_tenant
            )
          ) as item
          from public.events e
         where e.tenant_id = v_tenant
           and e.event_date >= now()
         order by e.event_date
         limit 12
      ) ev;
  exception
    when others then
      v_eventos := jsonb_build_object('na_instancia', 0, 'realizados_90_dias', 0, 'proximos_30_dias', 0);
      v_eventos_recentes := '[]'::jsonb;
      v_eventos_proximos := '[]'::jsonb;
  end;

  if to_regclass('public.small_groups') is not null then
    begin
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'nome', g.name,
            'ativo', g.is_active
          )
          order by g.is_active desc, g.name
        ),
        '[]'::jsonb
      )
        into v_grupos
        from (
          select sg.name, sg.is_active
            from public.small_groups sg
           where sg.tenant_id = v_tenant
           order by sg.is_active desc, sg.name
           limit 30
        ) g;
    exception
      when others then
        v_grupos := '[]'::jsonb;
    end;
  end if;

  if v_can_finance then
    begin
      with lanc as (
        select
          f.transaction_date,
          f.amount,
          f.ministry,
          upper(translate(trim(f.transaction_kind), 'Íí', 'Ii')) as kind_n,
          case
            when upper(translate(trim(f.movement), 'ÁáÉéÍíÓóÚú', 'AaEeIiOoUu')) like '%EXTRAORDIN%'
              then 'EXTRAORDINARIO'
            else 'ORDINARIO'
          end as bloco,
          case
            when upper(translate(trim(f.transaction_kind), 'Íí', 'Ii')) like 'ENTRADA%' then f.amount
            when upper(translate(trim(f.transaction_kind), 'Íí', 'Ii')) like 'SAIDA%' then -abs(f.amount)
            else f.amount
          end as signed_amount
          from public.financials f
         where f.tenant_id = v_tenant
           and upper(translate(trim(f.budget_version), 'Íí', 'Ii')) like '%REALIZ%'
      )
      select jsonb_build_object(
        'disponivel', true,
        'moeda', 'BRL',
        'resultado_historico', jsonb_build_object(
          'nome', 'RESULTADO HISTÓRICO',
          'periodo',
            'Início das operações · até '
            || to_char((now() at time zone 'America/Sao_Paulo'), 'MM / YYYY'),
          'primeiro_lancamento', (select min(l.transaction_date) from lanc l),
          'ultimo_lancamento', (select max(l.transaction_date) from lanc l),
          'quantidade_lancamentos', (select count(*)::int from lanc l),
          'saldo_inicial', 0,
          'saldo_atual', (select round(coalesce(sum(l.signed_amount), 0), 2) from lanc l),
          'ordinario', jsonb_build_object(
            'receitas', (
              select round(coalesce(sum(l.amount), 0), 2)
                from lanc l
               where l.bloco = 'ORDINARIO' and l.kind_n like 'ENTRADA%'
            ),
            'despesas', (
              select round(coalesce(sum(l.signed_amount), 0), 2)
                from lanc l
               where l.bloco = 'ORDINARIO' and l.kind_n like 'SAIDA%'
            ),
            'entre_contas', (
              select round(coalesce(sum(l.signed_amount), 0), 2)
                from lanc l
               where l.bloco = 'ORDINARIO' and l.kind_n like '%ENTRE CONTAS%'
            ),
            'resultado', (
              select round(coalesce(sum(l.signed_amount), 0), 2)
                from lanc l
               where l.bloco = 'ORDINARIO'
            )
          ),
          'extraordinario', jsonb_build_object(
            'receitas', (
              select round(coalesce(sum(l.amount), 0), 2)
                from lanc l
               where l.bloco = 'EXTRAORDINARIO' and l.kind_n like 'ENTRADA%'
            ),
            'despesas', (
              select round(coalesce(sum(l.signed_amount), 0), 2)
                from lanc l
               where l.bloco = 'EXTRAORDINARIO' and l.kind_n like 'SAIDA%'
            ),
            'entre_contas', (
              select round(coalesce(sum(l.signed_amount), 0), 2)
                from lanc l
               where l.bloco = 'EXTRAORDINARIO' and l.kind_n like '%ENTRE CONTAS%'
            ),
            'resultado', (
              select round(coalesce(sum(l.signed_amount), 0), 2)
                from lanc l
               where l.bloco = 'EXTRAORDINARIO'
            )
          )
        ),
        'meses_realizado', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'mes', fin.mes,
                'entradas', fin.entradas,
                'saidas', fin.saidas,
                'resultado', fin.resultado
              )
              order by fin.mes
            )
              from (
                select
                  to_char(date_trunc('month', l.transaction_date), 'YYYY-MM') as mes,
                  round(coalesce(sum(l.amount) filter (where l.kind_n like 'ENTRADA%'), 0), 2) as entradas,
                  round(coalesce(sum(l.signed_amount) filter (where l.kind_n like 'SAIDA%'), 0), 2) as saidas,
                  round(coalesce(sum(l.signed_amount), 0), 2) as resultado
                  from lanc l
                 where l.transaction_date >= ((now() at time zone 'America/Sao_Paulo')::date - 365)
                 group by 1
                 order by 1
              ) fin
          ),
          '[]'::jsonb
        )
      )
        into v_financas;
    exception
      when others then
        v_financas := jsonb_build_object('disponivel', false, 'motivo', 'financeiro indisponível');
    end;

    if to_regclass('public.expense_reports') is not null then
      begin
        select jsonb_build_object(
          'por_status', coalesce(
            jsonb_object_agg(st.status, st.qtd),
            '{}'::jsonb
          )
        )
          into v_despesas
          from (
            select coalesce(nullif(trim(er.status), ''), 'sem_status') as status, count(*)::int as qtd
              from public.expense_reports er
             where er.tenant_id = v_tenant
             group by 1
          ) st;
      exception
        when others then
          v_despesas := null;
      end;
    end if;
  else
    v_financas := jsonb_build_object(
      'disponivel', false,
      'motivo', 'sem permissão financeira nesta sessão'
    );
  end if;

  if v_can_pastoral then
    begin
      -- Somente totais. Nunca description, motivo, telefone, beneficiário.
      select jsonb_build_object(
        'disponivel', true,
        'totais_por_status', coalesce(
          jsonb_object_agg(st.status, st.qtd),
          '{}'::jsonb
        )
      )
        into v_pastoral
        from (
          select coalesce(nullif(trim(pr.status), ''), 'sem_status') as status, count(*)::int as qtd
            from public.pastoral_requests pr
           where pr.tenant_id = v_tenant
           group by 1
        ) st;
    exception
      when others then
        v_pastoral := jsonb_build_object('disponivel', false, 'motivo', 'pastoral indisponível');
    end;
  else
    v_pastoral := jsonb_build_object(
      'disponivel', false,
      'motivo', 'sem permissão pastoral nesta sessão'
    );
  end if;

  return jsonb_build_object(
    'isolamento', jsonb_build_object(
      'escopo', 'somente_instancia_da_sessao',
      'gerado_em', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI'),
      'proibido', jsonb_build_array(
        'outras_igrejas',
        'chaves_e_pins',
        'conteudo_pastoral',
        'exportar_para_fora_do_app'
      )
    ),
    'igreja', v_igreja,
    'operador', jsonb_build_object(
      'papeis', public.profile_role_names_csv(p_actor_profile_id)
    ),
    'pessoas', coalesce(v_pessoas, jsonb_build_object()),
    'eventos', jsonb_build_object(
      'totais', coalesce(
        v_eventos,
        jsonb_build_object('na_instancia', 0, 'realizados_90_dias', 0, 'proximos_30_dias', 0)
      ),
      'recentes', coalesce(v_eventos_recentes, '[]'::jsonb),
      'proximos', coalesce(v_eventos_proximos, '[]'::jsonb)
    ),
    'proximos_eventos', coalesce(v_eventos_proximos, '[]'::jsonb),
    'pequenos_grupos', coalesce(v_grupos, '[]'::jsonb),
    'financas', v_financas,
    'relatorios_despesa', v_despesas,
    'cuidado_pastoral', v_pastoral
  );
end;
$$;

comment on function public.obter_contexto_ia_lideranca(uuid) is
  'Snapshot operacional da igreja da sessão para o assistente de IA. Isolado por current_session_tenant_id(); sem PII, PIN, PIX ou conteúdo pastoral.';

revoke all on function public.obter_contexto_ia_lideranca(uuid) from public;
grant execute on function public.obter_contexto_ia_lideranca(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
