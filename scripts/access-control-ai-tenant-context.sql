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
  v_eventos jsonb := '[]'::jsonb;
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
    public.session_has_resource_access('table', 'financials', 'view')
    or public.session_has_screen_access('maintenance.card.financials', 'view');

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
        cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
       where p.tenant_id = v_tenant
         and coalesce(
           nullif(trim(p.full_name), ''),
           nullif(trim(p.phone), ''),
           nullif(trim(p.codigo_membro), '')
         ) is not null
         and coalesce(eff.membership_out::text, '') = ''
         and (
           not v_is_gestor
           or not public.is_super_admin_profile(p.id)
         )
    ) pessoas;

  begin
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'nome', ev.name,
          'data', to_char(ev.event_date at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI'),
          'local', nullif(trim(coalesce(ev.event_local, '')), ''),
          'inscritos', ev.inscritos
        )
        order by ev.event_date
      ),
      '[]'::jsonb
    )
      into v_eventos
      from (
        select
          e.name,
          e.event_date,
          e.event_local,
          (
            select count(*)::int
              from public.event_registrations er
             where er.event_id = e.id
               and er.tenant_id = v_tenant
          ) as inscritos
          from public.events e
         where e.tenant_id = v_tenant
           and e.event_date >= (now() - interval '1 day')
         order by e.event_date
         limit 12
      ) ev;
  exception
    when undefined_table then
      v_eventos := '[]'::jsonb;
    when others then
      v_eventos := '[]'::jsonb;
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
      select jsonb_build_object(
        'disponivel', true,
        'moeda', 'BRL',
        'meses_realizado', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'mes', fin.mes,
                'entradas', fin.entradas,
                'saidas', fin.saidas
              )
              order by fin.mes
            )
              from (
                select
                  to_char(date_trunc('month', f.transaction_date), 'YYYY-MM') as mes,
                  round(
                    sum(
                      case
                        when upper(translate(f.transaction_kind, 'Íí', 'Ii')) like 'ENTRADA%'
                          then f.amount
                        else 0
                      end
                    ),
                    2
                  ) as entradas,
                  round(
                    sum(
                      case
                        when upper(translate(f.transaction_kind, 'Íí', 'Ii')) like 'SAIDA%'
                          then f.amount
                        else 0
                      end
                    ),
                    2
                  ) as saidas
                  from public.financials f
                 where f.tenant_id = v_tenant
                   and upper(translate(trim(f.budget_version), 'Íí', 'Ii')) like '%REALIZ%'
                   and f.transaction_date >= ((now() at time zone 'America/Sao_Paulo')::date - 365)
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
    'proximos_eventos', coalesce(v_eventos, '[]'::jsonb),
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
