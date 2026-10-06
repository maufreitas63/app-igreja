-- =============================================================================
-- Assistente IA: consulta sob demanda (tool calling) da instância da sessão
-- =============================================================================
-- Isolamento: tenant_id vem SOMENTE de current_session_tenant_id().
-- Nunca aceita tenant informado pelo cliente/modelo.
-- SECURITY DEFINER + liderança + assert_actor_matches_session.
-- Sem dump de tabelas no prompt: a IA pede só o recorte necessário.
-- Sem PIN, senha, CPF, PIX, totem ou conteúdo pastoral.
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- =============================================================================

create or replace view public.vw_ia_cadastros_instancia as
select
  p.id as profile_id,
  p.tenant_id,
  nullif(trim(p.full_name), '') as nome,
  nullif(trim(p.church_function), '') as cargo,
  nullif(trim(p.phone), '') as telefone,
  nullif(trim(p.email), '') as email,
  nullif(trim(p.codigo_membro), '') as codigo,
  nullif(trim(p.family_id), '') as familia,
  p.birth_date as nascimento,
  p.membership_date as data_membresia,
  nullif(trim(p.address_neighborhood), '') as bairro,
  nullif(trim(p.address_city), '') as cidade,
  nullif(trim(p.address_state), '') as uf,
  nullif(trim(p.cep), '') as cep,
  nullif(trim(p.address_street), '') as logradouro,
  nullif(trim(p.address_number), '') as numero,
  case
    when p.birth_date is null then null
    else (
      extract(year from age((now() at time zone 'America/Sao_Paulo')::date, p.birth_date))
    )::int
  end as idade,
  p.first_visit_date as primeira_visita,
  nullif(trim(p.invited_by), '') as convidado_por,
  nullif(trim(p.follow_up_status), '') as acompanhamento
  from public.profiles p
 where coalesce(p.membership_out::text, '') = ''
   and coalesce(
     nullif(trim(p.full_name), ''),
     nullif(trim(p.phone), ''),
     nullif(trim(p.codigo_membro), '')
   ) is not null;

comment on view public.vw_ia_cadastros_instancia is
  'Cadastros visíveis à IA de liderança (sem PIN, senha, CPF, PIX). Sempre filtrar por tenant_id da sessão.';

grant select on public.vw_ia_cadastros_instancia to service_role;

create or replace function public.ia_escape_like(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(coalesce(p_text, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

revoke all on function public.ia_escape_like(text) from public;
grant execute on function public.ia_escape_like(text) to anon, authenticated, service_role;

create or replace function public.ia_norm_text(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    lower(trim(coalesce(p_text, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
$$;

revoke all on function public.ia_norm_text(text) from public;
grant execute on function public.ia_norm_text(text) to service_role;

create or replace function public.ia_phone_digits(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(regexp_replace(coalesce(p_text, ''), '\D', '', 'g'), '');
$$;

revoke all on function public.ia_phone_digits(text) from public;
grant execute on function public.ia_phone_digits(text) to service_role;

create or replace function public.ia_same_phone(p_left text, p_right text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    length(coalesce(public.ia_phone_digits(p_left), '')) >= 8
    and right(public.ia_phone_digits(p_left), 8) = right(public.ia_phone_digits(p_right), 8);
$$;

revoke all on function public.ia_same_phone(text, text) from public;
grant execute on function public.ia_same_phone(text, text) to service_role;

revoke all on public.vw_ia_cadastros_instancia from public, anon, authenticated;

create or replace function public.ia_escopo_lideranca(p_actor_profile_id uuid)
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
begin
  if p_actor_profile_id is null then
    raise exception 'nao autorizado para esta funçao';
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.profile_is_leadership(p_actor_profile_id) then
    raise exception 'nao autorizado para esta funçao';
  end if;

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

  return jsonb_build_object(
    'tenant_id', v_tenant,
    'is_gestor', v_is_gestor,
    'can_finance', v_can_finance,
    'can_pastoral', v_can_pastoral
  );
end;
$$;

revoke all on function public.ia_escopo_lideranca(uuid) from public;
grant execute on function public.ia_escopo_lideranca(uuid) to anon, authenticated, service_role;

create or replace function public.consultar_ferramenta_ia_lideranca(
  p_actor_profile_id uuid,
  p_ferramenta text,
  p_parametros jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope jsonb;
  v_tenant uuid;
  v_is_gestor boolean := false;
  v_can_finance boolean := false;
  v_can_pastoral boolean := false;
  v_tool text;
  v_params jsonb := coalesce(p_parametros, '{}'::jsonb);
  v_busca text;
  v_papel text;
  v_recorte text;
  v_limite int;
  v_idade_min int;
  v_idade_max int;
  v_menos_de int;
  v_mes_nasc int;
  v_ano_nasc int;
  v_bairro_f text;
  v_cidade_f text;
  v_cargo_f text;
  v_familia_f text;
  v_parentesco text;
  v_fonte text;
  v_ordem text;
  v_ordem_alfa boolean;
  v_listar boolean;
  v_filtro_idade boolean;
  v_result jsonb;
  v_igreja jsonb;
begin
  v_scope := public.ia_escopo_lideranca(p_actor_profile_id);
  v_tenant := (v_scope->>'tenant_id')::uuid;
  v_is_gestor := coalesce((v_scope->>'is_gestor')::boolean, false);
  v_can_finance := coalesce((v_scope->>'can_finance')::boolean, false);
  v_can_pastoral := coalesce((v_scope->>'can_pastoral')::boolean, false);

  v_tool := lower(trim(coalesce(p_ferramenta, '')));
  v_busca := nullif(trim(coalesce(v_params->>'busca', '')), '');
  v_papel := nullif(lower(trim(coalesce(v_params->>'papel', ''))), '');
  v_recorte := nullif(lower(trim(coalesce(v_params->>'recorte', ''))), '');
  v_limite := least(
    greatest(
      case
        when coalesce(v_params->>'limite', '') ~ '^[0-9]{1,4}$' then (v_params->>'limite')::int
        else 500
      end,
      1
    ),
    500
  );
  v_idade_min := case
    when coalesce(v_params->>'idade_min', '') ~ '^[0-9]{1,3}$' then (v_params->>'idade_min')::int
    else null
  end;
  v_idade_max := case
    when coalesce(v_params->>'idade_max', '') ~ '^[0-9]{1,3}$' then (v_params->>'idade_max')::int
    else null
  end;
  v_menos_de := case
    when coalesce(v_params->>'menos_de_anos', '') ~ '^[0-9]{1,3}$' then (v_params->>'menos_de_anos')::int
    else null
  end;
  v_mes_nasc := case
    when coalesce(v_params->>'mes_nascimento', '') ~ '^(0?[1-9]|1[0-2])$' then (v_params->>'mes_nascimento')::int
    else null
  end;
  v_ano_nasc := case
    when coalesce(v_params->>'ano_nascimento', '') ~ '^[0-9]{4}$' then (v_params->>'ano_nascimento')::int
    else null
  end;
  v_bairro_f := nullif(trim(coalesce(v_params->>'bairro', '')), '');
  v_cidade_f := nullif(trim(coalesce(v_params->>'cidade', '')), '');
  v_cargo_f := nullif(trim(coalesce(v_params->>'cargo', '')), '');
  v_familia_f := nullif(trim(coalesce(v_params->>'familia', '')), '');
  v_parentesco := nullif(trim(coalesce(v_params->>'parentesco', '')), '');
  v_fonte := nullif(public.ia_norm_text(coalesce(v_params->>'fonte', '')), '');
  v_ordem := nullif(public.ia_norm_text(coalesce(v_params->>'ordem', '')), '');
  v_listar := lower(coalesce(nullif(trim(v_params->>'listar'), ''), 'true'))
    not in ('false', '0', 'nao', 'não', 'n');
  v_filtro_idade := v_idade_min is not null
    or v_idade_max is not null
    or v_menos_de is not null
    or v_mes_nasc is not null
    or v_ano_nasc is not null;
  v_ordem_alfa := coalesce(v_ordem, '') in ('alfabetica', 'nome', 'a-z')
    or v_parentesco is not null
    or (
      v_papel is not null
      and v_papel not in ('member', 'congregado', 'visitante')
      and not v_filtro_idade
    );

  if v_tool = '' then
    return jsonb_build_object('ok', false, 'erro', 'ferramenta_obrigatoria');
  end if;

  -- ---------------------------------------------------------------------------
  -- resumo_instancia: totais leves (sem listas)
  -- ---------------------------------------------------------------------------
  if v_tool = 'resumo_instancia' then
    select jsonb_build_object(
      'codigo', i.code,
      'nome', i.name,
      'ativa', i.is_active
    )
      into v_igreja
      from public.igrejas i
     where i.id = v_tenant;

    if v_igreja is null then
      raise exception 'Igreja da sessão não encontrada.';
    end if;

    begin
      with visiveis as (
        select
          c.profile_id as id,
          c.familia as family_id,
          c.nascimento as birth_date,
          c.idade
          from public.vw_ia_cadastros_instancia c
         where c.tenant_id = v_tenant
           and (
             not v_is_gestor
             or not public.is_super_admin_profile(c.profile_id)
           )
      ),
      papeis as (
        select
          par.profile_id,
          bool_or(ar.code = 'member') as is_member,
          bool_or(ar.code = 'congregado') as is_congregado
          from public.profile_access_roles par
          join public.access_roles ar on ar.id = par.role_id
          join visiveis v on v.id = par.profile_id
         group by par.profile_id
      )
      select jsonb_build_object(
        'membros_ativos', count(*) filter (where coalesce(pap.is_member, false)),
        'congregados_ativos', count(*) filter (
          where coalesce(pap.is_congregado, false) and not coalesce(pap.is_member, false)
        ),
        'visitantes', count(*) filter (
          where not coalesce(pap.is_member, false) and not coalesce(pap.is_congregado, false)
        ),
        'familias', count(distinct nullif(trim(coalesce(v.family_id, '')), '')),
        'aniversariantes_mes', count(*) filter (
          where v.birth_date is not null
            and extract(month from v.birth_date) = extract(month from (now() at time zone 'America/Sao_Paulo'))
        ),
        'faixas_etarias', jsonb_build_object(
          'sem_nascimento', count(*) filter (where v.idade is null),
          'menos_de_10', count(*) filter (where v.idade < 10),
          'de_10_a_17', count(*) filter (where v.idade between 10 and 17),
          'de_18_a_29', count(*) filter (where v.idade between 18 and 29),
          'de_30_a_59', count(*) filter (where v.idade between 30 and 59),
          'de_60_ou_mais', count(*) filter (where v.idade >= 60)
        ),
        'total_cadastros_visiveis', count(*)
      )
        into v_result
        from visiveis v
        left join papeis pap on pap.profile_id = v.id;
    exception
      when others then
        raise warning 'ia.resumo_pessoas falhou: %', sqlerrm;
        v_result := jsonb_build_object(
          'total_cadastros_visiveis', (
            select count(*)::int
              from public.vw_ia_cadastros_instancia c
             where c.tenant_id = v_tenant
          ),
          'aviso', 'totais parciais'
        );
    end;

    return jsonb_build_object(
      'ok', true,
      'isolamento', jsonb_build_object(
        'escopo', 'somente_instancia_da_sessao',
        'gerado_em', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI')
      ),
      'igreja', v_igreja,
      'operador', jsonb_build_object(
        'papeis', public.profile_role_names_csv(p_actor_profile_id),
        'pode_financas', v_can_finance,
        'pode_pastoral', v_can_pastoral
      ),
      'pessoas', coalesce(v_result, jsonb_build_object()),
      'eventos', (
        select jsonb_build_object(
          'na_instancia', count(*)::int,
          'realizados_90_dias', count(*) filter (
            where e.event_date >= (now() - interval '90 days') and e.event_date < now()
          )::int,
          'proximos_30_dias', count(*) filter (
            where e.event_date >= now() and e.event_date < (now() + interval '30 days')
          )::int
        )
          from public.events e
         where e.tenant_id = v_tenant
      )
    );
  end if;

  -- ---------------------------------------------------------------------------
  -- buscar_pessoas / consultar_cadastros
  -- Bases da instância: perfis, integrantes da família e recepção pendente.
  -- ---------------------------------------------------------------------------
  if v_tool in ('buscar_pessoas', 'consultar_cadastros') then
    if (v_busca is null or char_length(v_busca) < 2)
       and v_papel is null
       and v_parentesco is null
       and not v_filtro_idade
       and v_bairro_f is null
       and v_cidade_f is null
       and v_cargo_f is null
       and v_familia_f is null
       and coalesce(v_fonte, '') <> 'recepcao'
    then
      return jsonb_build_object(
        'ok', false,
        'erro', 'informe_filtro',
        'dica', 'Informe busca, papel (member, congregado, visitante ou nome do papel), parentesco (Representante Legal, Cônjuge, Filho(a)...), idade, bairro, cidade, cargo ou família.'
      );
    end if;

    begin
      with perfil as (
        select
          c.nome,
          c.cargo,
          c.telefone,
          c.email,
          c.codigo,
          c.familia,
          c.bairro,
          c.cidade,
          c.nascimento,
          c.idade,
          case
            when bool_or(ar.code = 'member') then 'member'
            when bool_or(ar.code = 'congregado') then 'congregado'
            else 'visitante'
          end as papel,
          nullif(
            string_agg(ar.name, ', ' order by public.access_role_display_order(ar.code), ar.name)
              filter (where ar.code not in ('member', 'congregado', 'visitante')),
            ''
          ) as cargos_acesso,
          (
            select string_agg(distinct nullif(trim(m.relationship), ''), ', ')
              from public.members m
             where m.tenant_id = c.tenant_id
               and m.accepted is true
               and public.ia_norm_text(m.full_name) = public.ia_norm_text(c.nome)
               and (
                 public.ia_same_phone(m.phone, c.telefone)
                 or (
                   public.ia_norm_text(m.family_id) = public.ia_norm_text(c.familia)
                   and public.ia_norm_text(c.familia) <> ''
                 )
               )
          ) as parentesco,
          'perfil'::text as fonte,
          'ativo'::text as situacao
          from public.vw_ia_cadastros_instancia c
          left join public.profile_access_roles par on par.profile_id = c.profile_id
          left join public.access_roles ar on ar.id = par.role_id
         where c.tenant_id = v_tenant
           and coalesce(v_fonte, 'todos') in ('todos', 'perfil')
           and (
             not v_is_gestor
             or not public.is_super_admin_profile(c.profile_id)
           )
           and (v_idade_min is null or c.idade >= v_idade_min)
           and (v_idade_max is null or c.idade <= v_idade_max)
           and (v_menos_de is null or c.idade < v_menos_de)
           and (v_mes_nasc is null or extract(month from c.nascimento) = v_mes_nasc)
           and (v_ano_nasc is null or extract(year from c.nascimento) = v_ano_nasc)
           and (
             v_bairro_f is null
             or coalesce(c.bairro, '') ilike '%' || public.ia_escape_like(v_bairro_f) || '%' escape '\'
           )
           and (
             v_cidade_f is null
             or coalesce(c.cidade, '') ilike '%' || public.ia_escape_like(v_cidade_f) || '%' escape '\'
           )
           and (
             v_cargo_f is null
             or coalesce(c.cargo, '') ilike '%' || public.ia_escape_like(v_cargo_f) || '%' escape '\'
           )
           and (
             v_familia_f is null
             or coalesce(c.familia, '') ilike '%' || public.ia_escape_like(v_familia_f) || '%' escape '\'
           )
         group by
           c.tenant_id, c.profile_id, c.nome, c.cargo, c.telefone, c.email, c.codigo, c.familia,
           c.bairro, c.cidade, c.nascimento, c.idade
      ),
      familia as (
        select
          nullif(trim(m.full_name), '') as nome,
          null::text as cargo,
          nullif(trim(m.phone), '') as telefone,
          null::text as email,
          null::text as codigo,
          nullif(trim(m.family_id), '') as familia,
          null::text as bairro,
          null::text as cidade,
          m.birth_date as nascimento,
          case
            when m.birth_date is null then null
            else extract(year from age((now() at time zone 'America/Sao_Paulo')::date, m.birth_date))::int
          end as idade,
          (
            select case
              when bool_or(ar.code = 'member') then 'member'
              when bool_or(ar.code = 'congregado') then 'congregado'
              when count(ar.code) > 0 then 'visitante'
              else null
            end
              from public.profiles p
              left join public.profile_access_roles par on par.profile_id = p.id
              left join public.access_roles ar on ar.id = par.role_id
             where p.tenant_id = m.tenant_id
               and coalesce(p.membership_out::text, '') = ''
               and (
                 public.ia_same_phone(p.phone, m.phone)
                 or (
                   public.ia_norm_text(p.full_name) = public.ia_norm_text(m.full_name)
                   and public.ia_norm_text(p.family_id) = public.ia_norm_text(m.family_id)
                   and public.ia_norm_text(m.family_id) <> ''
                 )
               )
          ) as papel,
          null::text as cargos_acesso,
          nullif(trim(m.relationship), '') as parentesco,
          'familia'::text as fonte,
          'ativo'::text as situacao
          from public.members m
         where m.tenant_id = v_tenant
           and m.accepted is true
           and nullif(trim(m.full_name), '') is not null
           and coalesce(v_fonte, 'todos') in ('todos', 'familia')
           and v_bairro_f is null
           and v_cidade_f is null
           and v_cargo_f is null
           and (
             v_familia_f is null
             or coalesce(m.family_id, '') ilike '%' || public.ia_escape_like(v_familia_f) || '%' escape '\'
           )
           and (
             not v_is_gestor
             or not exists (
               select 1
                 from public.profiles p
                where p.tenant_id = m.tenant_id
                  and public.is_super_admin_profile(p.id)
                  and (
                    public.ia_same_phone(p.phone, m.phone)
                    or (
                      public.ia_norm_text(p.full_name) = public.ia_norm_text(m.full_name)
                      and public.ia_norm_text(p.family_id) = public.ia_norm_text(m.family_id)
                    )
                  )
             )
           )
      ),
      recepcao as (
        select
          nullif(trim(r.full_name), '') as nome,
          null::text as cargo,
          nullif(trim(r.phone), '') as telefone,
          null::text as email,
          null::text as codigo,
          coalesce(nullif(trim(r.applied_family_id), ''), nullif(trim(r.detected_family_id), '')) as familia,
          nullif(trim(r.address_neighborhood), '') as bairro,
          nullif(trim(r.address_city), '') as cidade,
          r.birth_date as nascimento,
          case
            when r.birth_date is null then null
            else extract(year from age((now() at time zone 'America/Sao_Paulo')::date, r.birth_date))::int
          end as idade,
          null::text as papel,
          null::text as cargos_acesso,
          nullif(trim(r.relationship), '') as parentesco,
          'recepcao'::text as fonte,
          'recepcao_pendente'::text as situacao
          from public.recepcao_cadastro_familiar r
         where r.tenant_id = v_tenant
           and r.status = 'pending'
           and nullif(trim(r.full_name), '') is not null
           and coalesce(v_fonte, 'todos') in ('todos', 'recepcao')
           and (
             not v_is_gestor
             or r.matched_profile_id is null
             or not public.is_super_admin_profile(r.matched_profile_id)
           )
           and (
             v_bairro_f is null
             or coalesce(r.address_neighborhood, '') ilike '%' || public.ia_escape_like(v_bairro_f) || '%' escape '\'
           )
           and (
             v_cidade_f is null
             or coalesce(r.address_city, '') ilike '%' || public.ia_escape_like(v_cidade_f) || '%' escape '\'
           )
           and v_cargo_f is null
           and (
             v_familia_f is null
             or coalesce(r.applied_family_id, r.detected_family_id, '') ilike '%' || public.ia_escape_like(v_familia_f) || '%' escape '\'
           )
      ),
      uniao as (
        select * from perfil
        union all
        select * from familia
        union all
        select * from recepcao
      ),
      dedup as (
        select distinct on (u.chave)
          u.nome,
          u.cargo,
          u.telefone,
          u.email,
          u.codigo,
          u.familia,
          u.bairro,
          u.cidade,
          u.nascimento,
          u.idade,
          u.papel,
          u.cargos_acesso,
          u.parentesco,
          u.fonte,
          u.situacao
          from (
            select
              uniao.*,
              (
                public.ia_norm_text(uniao.nome)
                || '|'
                || case
                  when length(coalesce(public.ia_phone_digits(uniao.telefone), '')) >= 8
                    then right(public.ia_phone_digits(uniao.telefone), 8)
                  else public.ia_norm_text(coalesce(uniao.familia, ''))
                end
              ) as chave,
              case uniao.fonte
                when 'perfil' then 0
                when 'familia' then 1
                else 2
              end as prioridade
              from uniao
          ) u
         order by u.chave, u.prioridade
      ),
      filtrados as (
        select
          d.*,
          row_number() over (
            partition by d.situacao
            order by
              case when v_ordem_alfa then 0 else coalesce(d.idade, 999) end,
              d.nome
          ) as ord_n
          from dedup d
         where (v_idade_min is null or d.idade >= v_idade_min)
           and (v_idade_max is null or d.idade <= v_idade_max)
           and (v_menos_de is null or d.idade < v_menos_de)
           and (v_mes_nasc is null or extract(month from d.nascimento) = v_mes_nasc)
           and (v_ano_nasc is null or extract(year from d.nascimento) = v_ano_nasc)
           and (
             v_busca is null
             or char_length(v_busca) < 2
             or public.ia_norm_text(coalesce(d.nome, '')) like '%' || public.ia_norm_text(v_busca) || '%'
             or coalesce(d.telefone, '') ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
             or public.ia_norm_text(coalesce(d.codigo, '')) like '%' || public.ia_norm_text(v_busca) || '%'
             or public.ia_norm_text(coalesce(d.cargo, '')) like '%' || public.ia_norm_text(v_busca) || '%'
             or public.ia_norm_text(coalesce(d.email, '')) like '%' || public.ia_norm_text(v_busca) || '%'
             or public.ia_norm_text(coalesce(d.parentesco, '')) like '%' || public.ia_norm_text(v_busca) || '%'
             or public.ia_norm_text(coalesce(d.familia, '')) like '%' || public.ia_norm_text(v_busca) || '%'
             or public.ia_norm_text(coalesce(d.cargos_acesso, '')) like '%' || public.ia_norm_text(v_busca) || '%'
             or public.ia_norm_text(coalesce(d.papel, '')) like '%' || public.ia_norm_text(v_busca) || '%'
           )
           and (
             v_papel is null
             or (
               v_papel in ('member', 'congregado', 'visitante')
               and d.papel = v_papel
             )
             or (
               v_papel not in ('member', 'congregado', 'visitante')
               and (
                 public.ia_norm_text(coalesce(d.parentesco, '')) like '%' || public.ia_norm_text(v_papel) || '%'
                 or public.ia_norm_text(coalesce(d.cargos_acesso, '')) like '%' || public.ia_norm_text(v_papel) || '%'
                 or public.ia_norm_text(coalesce(d.papel, '')) = public.ia_norm_text(v_papel)
               )
             )
           )
           and (
             v_parentesco is null
             or public.ia_norm_text(coalesce(d.parentesco, '')) like '%' || public.ia_norm_text(v_parentesco) || '%'
           )
      )
      select jsonb_build_object(
        'ok', true,
        'escopo', 'somente_instancia_da_sessao',
        'bases', jsonb_build_array('perfis', 'familia', 'recepcao_familiar'),
        'ordem', case when v_ordem_alfa then 'alfabetica' else 'idade' end,
        'quantidade', count(*) filter (where f.situacao = 'ativo')::int,
        'quantidade_recepcao_pendente', count(*) filter (where f.situacao = 'recepcao_pendente')::int,
        'cadastros_sem_nascimento', case
          when v_filtro_idade then (
            select count(*)::int
              from public.vw_ia_cadastros_instancia s
             where s.tenant_id = v_tenant
               and s.nascimento is null
               and (
                 not v_is_gestor
                 or not public.is_super_admin_profile(s.profile_id)
               )
          )
          else null
        end,
        'instrucao', 'Reproduza lista_texto na íntegra, uma pessoa por linha, sem resumir e sem omitir nomes. Se lista_recepcao tiver texto, mostre depois, em bloco separado, como recepção pendente desta instância.',
        'lista_texto', coalesce(
          string_agg(
            format(
              '%s. %s',
              f.ord_n,
              concat_ws(
                ' — ',
                f.nome,
                nullif(f.parentesco, ''),
                case when f.familia is not null then 'família ' || f.familia end,
                nullif(f.papel, '')
              )
            ),
            E'\n'
            order by f.ord_n
          ) filter (where f.situacao = 'ativo' and f.ord_n <= v_limite),
          ''
        ),
        'lista_recepcao', coalesce(
          string_agg(
            format(
              '%s. %s',
              f.ord_n,
              concat_ws(
                ' — ',
                f.nome,
                nullif(f.parentesco, ''),
                case when f.familia is not null then 'família ' || f.familia end
              )
            ),
            E'\n'
            order by f.ord_n
          ) filter (where f.situacao = 'recepcao_pendente' and f.ord_n <= v_limite),
          ''
        ),
        'itens', case
          when not v_listar or count(*) filter (where f.situacao = 'ativo') > 25 then '[]'::jsonb
          else coalesce(
            jsonb_agg(
              jsonb_build_object(
                'nome', f.nome,
                'idade', f.idade,
                'nascimento', f.nascimento,
                'papel', f.papel,
                'parentesco', f.parentesco,
                'cargo', f.cargo,
                'papeis_acesso', f.cargos_acesso,
                'telefone', f.telefone,
                'codigo', f.codigo,
                'familia', f.familia,
                'bairro', f.bairro,
                'cidade', f.cidade,
                'fonte', f.fonte
              )
              order by f.ord_n
            ) filter (where f.situacao = 'ativo' and f.ord_n <= v_limite),
            '[]'::jsonb
          )
        end,
        'lista_parcial', count(*) filter (where f.situacao = 'ativo') > v_limite
      )
        into v_result
        from filtrados f;
    exception
      when others then
        raise warning 'ia.buscar_pessoas falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_pessoas_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'quantidade', 0, 'itens', '[]'::jsonb));
  end if;

  -- ---------------------------------------------------------------------------
  -- buscar_lideranca
  -- ---------------------------------------------------------------------------
  if v_tool = 'buscar_lideranca' then
    begin
      with lideres as (
        select
          c.profile_id,
          c.nome,
          c.cargo,
          c.telefone,
          c.codigo,
          string_agg(ar.name, ', ' order by public.access_role_display_order(ar.code), ar.name) as papeis
          from public.vw_ia_cadastros_instancia c
          join public.profile_access_roles par on par.profile_id = c.profile_id
          join public.access_roles ar on ar.id = par.role_id
         where c.tenant_id = v_tenant
           and ar.code in (
             'secretaria',
             'tesoureiro',
             'pastoral',
             'gestor_controle_acesso',
             'super_admin',
             'lider',
             'lider_geral',
             'events_admin',
             'orquestrador_evento'
           )
           and (
             not v_is_gestor
             or ar.code <> 'super_admin'
           )
           and (
             v_busca is null
             or c.nome ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
             or ar.code ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
             or ar.name ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
             or coalesce(c.cargo, '') ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
           )
         group by c.profile_id, c.nome, c.cargo, c.telefone, c.codigo
      )
      select jsonb_build_object(
        'ok', true,
        'quantidade', count(*)::int,
        'itens', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'nome', l.nome,
              'cargo', l.cargo,
              'papeis', l.papeis,
              'telefone', l.telefone,
              'codigo', l.codigo
            )
            order by l.nome
          ) filter (where l.ord_n <= least(v_limite, 40)),
          '[]'::jsonb
        )
      )
        into v_result
        from (
          select lideres.*, row_number() over (order by lideres.nome) as ord_n
            from lideres
        ) l;
    exception
      when others then
        raise warning 'ia.buscar_lideranca falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_lideranca_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'quantidade', 0, 'itens', '[]'::jsonb));
  end if;

  -- ---------------------------------------------------------------------------
  -- cadastro_detalhe
  -- ---------------------------------------------------------------------------
  if v_tool = 'cadastro_detalhe' then
    if v_busca is null or char_length(v_busca) < 2 then
      return jsonb_build_object('ok', false, 'erro', 'informe_busca');
    end if;

    begin
      with matches as (
        select
          c.profile_id,
          c.nome,
          c.cargo,
          c.telefone,
          c.email,
          c.codigo,
          c.familia,
          c.nascimento,
          c.idade,
          c.data_membresia,
          c.bairro,
          c.cidade,
          c.uf,
          c.cep,
          c.logradouro,
          c.numero,
          case
            when exists (
              select 1
                from public.profile_access_roles par
                join public.access_roles ar on ar.id = par.role_id
               where par.profile_id = c.profile_id and ar.code = 'member'
            ) then 'member'
            when exists (
              select 1
                from public.profile_access_roles par
                join public.access_roles ar on ar.id = par.role_id
               where par.profile_id = c.profile_id and ar.code = 'congregado'
            ) then 'congregado'
            else 'visitante'
          end as papel,
          (
            select string_agg(ar.name, ', ' order by public.access_role_display_order(ar.code), ar.name)
              from public.profile_access_roles par
              join public.access_roles ar on ar.id = par.role_id
             where par.profile_id = c.profile_id
               and (
                 not v_is_gestor
                 or ar.code <> 'super_admin'
               )
          ) as papeis
          from public.vw_ia_cadastros_instancia c
         where c.tenant_id = v_tenant
           and (
             not v_is_gestor
             or not public.is_super_admin_profile(c.profile_id)
           )
           and (
             coalesce(c.nome, '') ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
             or coalesce(c.telefone, '') ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
             or coalesce(c.codigo, '') ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
           )
         order by c.nome
         limit 5
      )
      select jsonb_build_object(
        'ok', true,
        'quantidade', count(*)::int,
        'itens', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'nome', m.nome,
              'papel', m.papel,
              'cargo', m.cargo,
              'papeis', m.papeis,
              'parentesco', (
                select string_agg(distinct nullif(trim(fm.relationship), ''), ', ')
                  from public.members fm
                 where fm.tenant_id = v_tenant
                   and fm.accepted is true
                   and public.ia_norm_text(fm.full_name) = public.ia_norm_text(m.nome)
                   and (
                     public.ia_same_phone(fm.phone, m.telefone)
                     or (
                       public.ia_norm_text(fm.family_id) = public.ia_norm_text(m.familia)
                       and public.ia_norm_text(m.familia) <> ''
                     )
                   )
              ),
              'telefone', m.telefone,
              'email', m.email,
              'codigo', m.codigo,
              'familia', m.familia,
              'nascimento', m.nascimento,
              'idade', m.idade,
              'data_membresia', m.data_membresia,
              'endereco', jsonb_build_object(
                'logradouro', m.logradouro,
                'numero', m.numero,
                'bairro', m.bairro,
                'cidade', m.cidade,
                'uf', m.uf,
                'cep', m.cep
              )
            )
            order by m.nome
          ),
          '[]'::jsonb
        )
      )
        into v_result
        from matches m;
    exception
      when others then
        raise warning 'ia.cadastro_detalhe falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_cadastro_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'quantidade', 0, 'itens', '[]'::jsonb));
  end if;

  -- ---------------------------------------------------------------------------
  -- buscar_eventos
  -- ---------------------------------------------------------------------------
  if v_tool = 'buscar_eventos' then
    begin
      with base as (
        select
          e.name as nome,
          to_char(e.event_date at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') as data,
          e.event_date,
          nullif(trim(coalesce(e.event_local, '')), '') as local,
          (
            select count(*)::int
              from public.event_registrations er
             where er.event_id = e.id
               and er.tenant_id = v_tenant
          ) as inscritos
          from public.events e
         where e.tenant_id = v_tenant
           and (
             v_busca is null
             or e.name ilike '%' || public.ia_escape_like(v_busca) || '%' escape '\'
           )
           and (
             v_recorte is null
             or v_recorte = 'todos'
             or (v_recorte = 'recentes' and e.event_date < now())
             or (v_recorte = 'proximos' and e.event_date >= now())
           )
      )
      select jsonb_build_object(
        'ok', true,
        'quantidade', count(*)::int,
        'itens', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'nome', b.nome,
              'data', b.data,
              'local', b.local,
              'inscritos', b.inscritos
            )
            order by
              case when v_recorte = 'recentes' then b.event_date end desc,
              case when v_recorte is distinct from 'recentes' then b.event_date end asc
          ) filter (where b.ord_n <= least(v_limite, 12)),
          '[]'::jsonb
        )
      )
        into v_result
        from (
          select
            base.*,
            row_number() over (
              order by
                case when v_recorte = 'recentes' then base.event_date end desc,
                case when v_recorte is distinct from 'recentes' then base.event_date end asc
            ) as ord_n
            from base
        ) b;
    exception
      when others then
        raise warning 'ia.buscar_eventos falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_eventos_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'quantidade', 0, 'itens', '[]'::jsonb));
  end if;

  -- ---------------------------------------------------------------------------
  -- financas_resumo
  -- ---------------------------------------------------------------------------
  if v_tool = 'financas_resumo' then
    if not v_can_finance then
      return jsonb_build_object(
        'ok', true,
        'disponivel', false,
        'motivo', 'sem permissão financeira nesta sessão'
      );
    end if;

    begin
      with lanc as (
        select
          f.transaction_date,
          f.amount,
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
        'ok', true,
        'disponivel', true,
        'moeda', 'BRL',
        'resultado_historico', jsonb_build_object(
          'periodo',
            'Início das operações · até '
            || to_char((now() at time zone 'America/Sao_Paulo'), 'MM / YYYY'),
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
            'resultado', (
              select round(coalesce(sum(l.signed_amount), 0), 2)
                from lanc l
               where l.bloco = 'EXTRAORDINARIO'
            )
          )
        )
      )
        into v_result
        from (select 1) dummy;
    exception
      when others then
        raise warning 'ia.financas_resumo falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_financeira_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'disponivel', false));
  end if;

  -- ---------------------------------------------------------------------------
  -- cuidado_pastoral_totais
  -- ---------------------------------------------------------------------------
  if v_tool = 'cuidado_pastoral_totais' then
    if not v_can_pastoral then
      return jsonb_build_object(
        'ok', true,
        'disponivel', false,
        'motivo', 'sem permissão pastoral nesta sessão'
      );
    end if;

    begin
      select jsonb_build_object(
        'ok', true,
        'disponivel', true,
        'totais_por_status', coalesce(jsonb_object_agg(st.status, st.qtd), '{}'::jsonb)
      )
        into v_result
        from (
          select coalesce(nullif(trim(pr.status), ''), 'sem_status') as status, count(*)::int as qtd
            from public.pastoral_requests pr
           where pr.tenant_id = v_tenant
           group by 1
        ) st;
    exception
      when others then
        raise warning 'ia.cuidado_pastoral falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_pastoral_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'disponivel', true, 'totais_por_status', '{}'::jsonb));
  end if;

  -- ---------------------------------------------------------------------------
  -- pequenos_grupos
  -- ---------------------------------------------------------------------------
  if v_tool = 'pequenos_grupos' then
    if to_regclass('public.small_groups') is null then
      return jsonb_build_object('ok', true, 'itens', '[]'::jsonb);
    end if;

    begin
      select jsonb_build_object(
        'ok', true,
        'itens', coalesce(
          jsonb_agg(
            jsonb_build_object('nome', g.name, 'ativo', g.is_active)
            order by g.is_active desc, g.name
          ),
          '[]'::jsonb
        )
      )
        into v_result
        from (
          select sg.name, sg.is_active
            from public.small_groups sg
           where sg.tenant_id = v_tenant
           order by sg.is_active desc, sg.name
           limit least(v_limite, 30)
        ) g;
    exception
      when others then
        raise warning 'ia.pequenos_grupos falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_grupos_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'itens', '[]'::jsonb));
  end if;

  -- ---------------------------------------------------------------------------
  -- aniversariantes
  -- ---------------------------------------------------------------------------
  if v_tool = 'aniversariantes' then
    if v_mes_nasc is null then
      v_mes_nasc := extract(month from (now() at time zone 'America/Sao_Paulo'))::int;
    end if;

    begin
      select jsonb_build_object(
        'ok', true,
        'mes', v_mes_nasc,
        'itens', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'nome', a.nome,
              'dia', a.dia,
              'idade', a.idade,
              'telefone', a.telefone
            )
            order by a.dia, a.nome
          ),
          '[]'::jsonb
        )
      )
        into v_result
        from (
          select
            c.nome,
            extract(day from c.nascimento)::int as dia,
            c.idade,
            c.telefone
            from public.vw_ia_cadastros_instancia c
           where c.tenant_id = v_tenant
             and c.nascimento is not null
             and extract(month from c.nascimento) = v_mes_nasc
             and (
               not v_is_gestor
               or not public.is_super_admin_profile(c.profile_id)
             )
           order by extract(day from c.nascimento), c.nome
           limit least(v_limite, 80)
        ) a;
    exception
      when others then
        raise warning 'ia.aniversariantes falhou: %', sqlerrm;
        return jsonb_build_object('ok', false, 'erro', 'consulta_aniversariantes_indisponivel');
    end;

    return coalesce(v_result, jsonb_build_object('ok', true, 'itens', '[]'::jsonb));
  end if;

  return jsonb_build_object('ok', false, 'erro', 'ferramenta_desconhecida', 'ferramenta', v_tool);
end;
$$;

comment on function public.consultar_ferramenta_ia_lideranca(uuid, text, jsonb) is
  'Consultas da igreja da sessão para a Abigail. Cadastros: perfis, família e recepção pendente. Isolado por current_session_tenant_id().';

revoke all on function public.consultar_ferramenta_ia_lideranca(uuid, text, jsonb) from public;
grant execute on function public.consultar_ferramenta_ia_lideranca(uuid, text, jsonb) to anon, authenticated, service_role;

-- Snapshot leve: só totais. Listas e cadastros passam a ser sob demanda.
create or replace function public.obter_contexto_ia_lideranca(p_actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.consultar_ferramenta_ia_lideranca(
    p_actor_profile_id,
    'resumo_instancia',
    '{}'::jsonb
  );
end;
$$;

comment on function public.obter_contexto_ia_lideranca(uuid) is
  'Resumo operacional da igreja da sessão para o assistente de IA. Listas e cadastros via consultar_ferramenta_ia_lideranca.';

notify pgrst, 'reload schema';
