-- =============================================================================
-- TstMax — carga massiva fictícia para testes integrados
-- =============================================================================
-- Execute no SQL Editor do Supabase (recomendado: role service / postgres).
--
-- Regras:
--   • Prefixo TstMax em nomes, eventos, e-mails, family_id, códigos de escala, placas.
--   • NÃO altera financials nem registros sem prefixo TstMax.
--   • NÃO chama reserve_next_family_id() — family_id manual TstMax0001.. para não
--     mexer no contador IBN de produção.
--   • Reexecutável: limpa apenas dados TstMax antes de inserir.
--
-- Pré-requisitos: register-member-atomic.sql, checkins-totem-flow.sql,
--   events-totem-ativo.sql, events-requer-quorum.sql, escalas-multi-vagas.sql,
--   pastoral-request-categories.sql (categorias UUID).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Limpeza (somente TstMax)
-- ---------------------------------------------------------------------------

delete from public.checkins c
where c.family_id like 'TstMax%';

delete from public.event_quorum_registry eqr
where eqr.event_id in (
  select e.id from public.events e where e.name like 'TstMax%'
);

delete from public.event_registrations er
where er.event_id in (
  select e.id from public.events e where e.name like 'TstMax%'
)
   or er.family_id like 'TstMax%';

delete from public.events e
where e.name like 'TstMax%';

delete from public.escalas_log el
where el.tipo_escala_id in (
  select te.id from public.tipos_escala te where te.codigo like 'tstmax%'
);

delete from public.voluntarios_escala ve
where ve.tipo_escala_id in (
  select te.id from public.tipos_escala te where te.codigo like 'tstmax%'
);

delete from public.tipos_escala te
where te.codigo like 'tstmax%';

delete from public.pastoral_requests pr
where coalesce(pr.motivo, '') like 'TstMax%'
   or coalesce(pr.description, '') like 'TstMax%';

delete from public.profile_vehicles pv
where upper(pv.placa) like 'TSTMAX%';

delete from public.profile_access_roles par
where par.profile_id in (
  select p.id
    from public.profiles p
   where p.family_id like 'TstMax%'
      or trim(coalesce(p.full_name, '')) ilike 'TstMax%'
      or lower(trim(coalesce(p.email, ''))) like '%@tstmax.demo'
);

delete from public.members m
where m.family_id like 'TstMax%'
   or m.full_name like 'TstMax%';

delete from public.profiles p
where p.family_id like 'TstMax%'
   or p.full_name like 'TstMax%'
   or coalesce(p.email, '') like '%@tstmax.demo';

-- ---------------------------------------------------------------------------
-- 1. Contexto temporário (IDs gerados nesta sessão)
-- ---------------------------------------------------------------------------

create temp table if not exists tstmax_ctx (
  key text primary key,
  id uuid,
  text_value text
) on commit drop;

truncate tstmax_ctx;

-- ---------------------------------------------------------------------------
-- 2. População massiva: 30 famílias + 20 individuais (mín. 80 pessoas)
--    CEPs em Caraguatatuba, Ubatuba e São Sebastião (rotação)
-- ---------------------------------------------------------------------------

do $$
declare
  v_sizes constant int[] := array[
    1, 2, 3, 2, 3, 4,
    2, 2, 3, 3, 2, 4, 1, 2, 3,
    2, 3, 2, 3, 1, 2, 4, 2, 3, 2, 3, 4, 2, 1, 3
  ];
  v_family_idx int;
  v_member_idx int;
  v_size int;
  v_family_id text;
  v_city_idx int;
  v_cep text;
  v_street text;
  v_neighborhood text;
  v_city text;
  v_phone text;
  v_name text;
  v_email text;
  v_birth date;
  v_pin text;
  v_id uuid;
  v_relationship text;
  v_accepted boolean;
  v_is_active boolean;
  v_individual_idx int;
  v_people_members int := 0;
begin
  -- 30 famílias (TstMaxF001 … TstMaxF030)
  for v_family_idx in 1..30 loop
    v_family_id := 'TstMaxF' || lpad(v_family_idx::text, 3, '0');
    v_size := v_sizes[v_family_idx];
    v_city_idx := (v_family_idx - 1) % 3;

    case v_city_idx
      when 0 then
        v_cep := lpad((11660010 + v_family_idx)::text, 8, '0');
        v_cep := substring(v_cep from 1 for 5) || '-' || substring(v_cep from 6 for 3);
        v_street := 'TstMax Rua Caraguatatuba ' || v_family_idx;
        v_neighborhood := 'Centro';
        v_city := 'Caraguatatuba';
      when 1 then
        v_cep := lpad((11680010 + v_family_idx)::text, 8, '0');
        v_cep := substring(v_cep from 1 for 5) || '-' || substring(v_cep from 6 for 3);
        v_street := 'TstMax Rua Ubatuba ' || v_family_idx;
        v_neighborhood := 'Centro';
        v_city := 'Ubatuba';
      else
        v_cep := lpad((11600010 + v_family_idx)::text, 8, '0');
        v_cep := substring(v_cep from 1 for 5) || '-' || substring(v_cep from 6 for 3);
        v_street := 'TstMax Rua Sao Sebastiao ' || v_family_idx;
        v_neighborhood := 'Centro';
        v_city := 'São Sebastião';
    end case;

    for v_member_idx in 1..v_size loop
      v_phone := public.format_phone_like_profiles(
        '12' || '99' || lpad((9000000 + v_family_idx * 100 + v_member_idx)::text, 7, '0')
      );
      v_accepted := true;
      v_is_active := false;

      if v_member_idx = 1 then
        v_name := format('TstMax F%s Representante', lpad(v_family_idx::text, 3, '0'));
        v_relationship := 'Representante Legal';
        v_birth := (date '1980-01-01' + ((v_family_idx * 37) % 5000))::date;
        v_pin := lpad((1000 + v_family_idx)::text, 4, '0');
        v_is_active := true;
      elsif v_member_idx = 2 and v_size = 2 and v_family_idx % 5 = 0 then
        v_name := format('TstMax F%s Conjuge', lpad(v_family_idx::text, 3, '0'));
        v_relationship := 'Cônjuge';
        v_birth := (date '1985-06-15' + ((v_family_idx * 11) % 3000))::date;
        v_pin := null;
      elsif v_member_idx = v_size and v_family_idx = 6 then
        v_name := format('TstMax F%s Pendente', lpad(v_family_idx::text, 3, '0'));
        v_relationship := 'Filho(a)';
        v_birth := (date '2015-03-10' + v_member_idx)::date;
        v_accepted := false;
        v_phone := null;
      elsif v_member_idx % 2 = 0 then
        v_name := format('TstMax F%s Filho Kids %s', lpad(v_family_idx::text, 3, '0'), v_member_idx);
        v_relationship := 'Filho(a)';
        v_birth := (date '2018-01-01' + ((v_family_idx + v_member_idx) % 800))::date;
        v_phone := null;
      else
        v_name := format('TstMax F%s Filho Teen %s', lpad(v_family_idx::text, 3, '0'), v_member_idx);
        v_relationship := 'Filho(a)';
        v_birth := (date '2010-01-01' + ((v_family_idx + v_member_idx) % 600))::date;
        v_phone := null;
      end if;

      v_email := lower(replace(v_name, ' ', '.')) || '@tstmax.demo';

      if v_member_idx = 1 or v_is_active then
        insert into public.profiles (
          full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state
        ) values (
          v_name, v_email, v_phone, v_birth, v_family_id, v_family_id,
          true, v_is_active, v_pin,
          v_cep, v_street, (10 + v_member_idx)::text, v_neighborhood, v_city, 'SP'
        ) returning id into v_id;

        if v_family_idx = 1 then
          insert into tstmax_ctx values ('profile_f1_pai', v_id, v_family_id);
        elsif v_family_idx = 3 and v_member_idx = 1 then
          insert into tstmax_ctx values ('profile_f3_pai', v_id, v_family_id);
        end if;
      elsif v_accepted then
        insert into public.profiles (
          full_name, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, is_active,
          cep, address_street, address_number, address_neighborhood, address_city, address_state
        ) values (
          v_name, v_phone, v_birth, v_family_id, v_family_id,
          true, false,
          v_cep, v_street, (10 + v_member_idx)::text, v_neighborhood, v_city, 'SP'
        );
      end if;

      insert into public.members (
        full_name, phone, birth_date, relationship, family_id, accepted
      ) values (
        v_name, v_phone, v_birth, v_relationship, v_family_id, v_accepted
      );

      v_people_members := v_people_members + 1;
    end loop;
  end loop;

  -- 20 perfis individuais (TstMaxI001 … TstMaxI020) — sem filhos
  for v_individual_idx in 1..20 loop
    v_family_id := 'TstMaxI' || lpad(v_individual_idx::text, 3, '0');
    v_city_idx := (v_individual_idx + 1) % 3;

    case v_city_idx
      when 0 then
        v_cep := '11660-' || lpad((200 + v_individual_idx)::text, 3, '0');
        v_street := 'TstMax Av Individual Caraguatatuba';
        v_neighborhood := 'Martim de Sá';
        v_city := 'Caraguatatuba';
      when 1 then
        v_cep := '11680-' || lpad((200 + v_individual_idx)::text, 3, '0');
        v_street := 'TstMax Av Individual Ubatuba';
        v_neighborhood := 'Itaguá';
        v_city := 'Ubatuba';
      else
        v_cep := '11600-' || lpad((200 + v_individual_idx)::text, 3, '0');
        v_street := 'TstMax Av Individual Sao Sebastiao';
        v_neighborhood := 'Topolândia';
        v_city := 'São Sebastião';
    end case;

    v_phone := public.format_phone_like_profiles(
      '1299005' || lpad(v_individual_idx::text, 4, '0')
    );
    v_name := format('TstMax I%s Individual', lpad(v_individual_idx::text, 3, '0'));
    v_email := lower(replace(v_name, ' ', '.')) || '@tstmax.demo';
    v_birth := (date '1975-01-01' + (v_individual_idx * 97))::date;
    v_pin := lpad((3000 + v_individual_idx)::text, 4, '0');

    insert into public.profiles (
      full_name, email, phone, birth_date, family_id, codigo_membro,
      lgpd_accepted, is_active, access_pin,
      cep, address_street, address_number, address_neighborhood, address_city, address_state
    ) values (
      v_name, v_email, v_phone, v_birth, v_family_id, v_family_id,
      true, true, v_pin,
      v_cep, v_street, v_individual_idx::text, v_neighborhood, v_city, 'SP'
    );

    insert into public.members (
      full_name, phone, birth_date, relationship, family_id, accepted
    ) values (
      v_name, v_phone, v_birth, 'Representante Legal', v_family_id, true
    );

    v_people_members := v_people_members + 1;
  end loop;

  insert into tstmax_ctx values ('people_members_total', null, v_people_members::text);
  raise notice 'TstMax membros inseridos: % (meta >= 80)', v_people_members;
end;
$$;

-- TstMax: perfis de teste permanecem sem papéis ACL (visitantes no app).
-- Execute também scripts/tstmax-visitantes-only.sql se perfis antigos tiverem papel member.

-- Veículos (amostra em famílias com endereço em Caraguatatuba)
insert into public.profile_vehicles (phone, placa, marca, modelo, cor, celular)
select
  p.phone,
  'TST' || lpad(row_number() over (order by p.full_name)::text, 4, '0'),
  'Fiat',
  'Uno',
  'Branco',
  p.phone
from public.profiles p
where p.full_name like 'TstMax F%Representante'
  and p.address_city = 'Caraguatatuba'
  and p.is_active is true
limit 10
on conflict (phone, placa) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Eventos (totem / quórum / kids / teens — combinações + mesmo dia 2 horários)
-- ---------------------------------------------------------------------------

do $$
declare
  v_day date;
  v_id uuid;
begin
  -- Próximo domingo (se hoje for domingo, usa o domingo seguinte)
  if extract(dow from current_date) = 0 then
    v_day := current_date + 7;
  else
    v_day := current_date + (7 - extract(dow from current_date)::int);
  end if;

  insert into public.events (
    name, event_date, event_local, max_capacity,
    kids_room, teens_room, parm_ofertas, totem_ativo, requer_quorum, is_locked
  ) values (
    'TstMax Culto Totem+Quorum+Salas',
    (v_day + time '10:00')::timestamptz,
    'TstMax Templo Principal', 400,
    true, true, true, true, true, false
  ) returning id into v_id;
  insert into tstmax_ctx values ('event_full', v_id, v_day::text);

  insert into public.events (
    name, event_date, event_local, max_capacity,
    kids_room, teens_room, parm_ofertas, totem_ativo, requer_quorum, is_locked
  ) values (
    'TstMax Culto So Totem',
    (v_day + interval '14 days' + time '10:00')::timestamptz,
    'TstMax Templo B', 300,
    true, false, false, true, false, false
  ) returning id into v_id;
  insert into tstmax_ctx values ('event_totem_only', v_id, null);

  insert into public.events (
    name, event_date, event_local, max_capacity,
    kids_room, teens_room, parm_ofertas, totem_ativo, requer_quorum, is_locked
  ) values (
    'TstMax Culto So Quorum',
    (v_day + interval '21 days' + time '10:00')::timestamptz,
    'TstMax Templo C', 250,
    false, true, false, false, true, false
  ) returning id into v_id;
  insert into tstmax_ctx values ('event_quorum_only', v_id, null);

  insert into public.events (
    name, event_date, event_local, max_capacity,
    kids_room, teens_room, parm_ofertas, totem_ativo, requer_quorum, is_locked
  ) values (
    'TstMax Encontro Simples',
    (v_day + interval '28 days' + time '15:00')::timestamptz,
    'TstMax Salao Social', 120,
    false, false, true, false, false, false
  ) returning id into v_id;
  insert into tstmax_ctx values ('event_plain', v_id, null);

  -- Mesmo dia, horários diferentes
  insert into public.events (
    name, event_date, event_local, max_capacity,
    kids_room, teens_room, parm_ofertas, totem_ativo, requer_quorum, is_locked
  ) values (
    'TstMax Duplo Dia Manha',
    (v_day + interval '35 days' + time '09:30')::timestamptz,
    'TstMax Campus A', 200,
    true, true, false, true, false, false
  ) returning id into v_id;
  insert into tstmax_ctx values ('event_double_am', v_id, null);

  insert into public.events (
    name, event_date, event_local, max_capacity,
    kids_room, teens_room, parm_ofertas, totem_ativo, requer_quorum, is_locked
  ) values (
    'TstMax Duplo Dia Noite',
    (v_day + interval '35 days' + time '19:00')::timestamptz,
    'TstMax Campus A', 180,
    false, true, true, true, true, false
  ) returning id into v_id;
  insert into tstmax_ctx values ('event_double_pm', v_id, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Audiência / inscrições (register_member_atomic) + totem em parte das famílias
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_event_id uuid;
  v_result jsonb;
begin
  select id into v_event_id from tstmax_ctx where key = 'event_full';

  for r in
    select m.id as member_id, m.family_id, m.full_name
    from public.members m
    where m.family_id like 'TstMax%'
      and m.accepted is true
      and m.full_name not like '%Pendente%'
    order by m.family_id, m.full_name
  loop
    v_result := public.register_member_atomic(v_event_id, r.member_id, r.family_id);
    if coalesce(v_result ->> 'success', 'false') <> 'true' then
      raise notice 'TstMax register_member_atomic % / %: %', r.full_name, r.family_id, v_result;
    end if;
  end loop;

  -- Evento só totem: amostra de 10 famílias
  select id into v_event_id from tstmax_ctx where key = 'event_totem_only';
  for r in
    select m.id as member_id, m.family_id, m.full_name
    from public.members m
    where m.family_id in (
      'TstMaxF001', 'TstMaxF002', 'TstMaxF003', 'TstMaxF004', 'TstMaxF005',
      'TstMaxF010', 'TstMaxF015', 'TstMaxF020', 'TstMaxF025', 'TstMaxF030'
    )
      and m.accepted is true
  loop
    perform public.register_member_atomic(v_event_id, r.member_id, r.family_id);
  end loop;

  -- Confirmar totem para amostra no evento completo
  select id into v_event_id from tstmax_ctx where key = 'event_full';
  perform public.confirm_totem_checkin(v_event_id, 'TstMaxF001');
  perform public.confirm_totem_checkin(v_event_id, 'TstMaxF004');
  perform public.confirm_totem_checkin(v_event_id, 'TstMaxF010');
  perform public.confirm_totem_checkin(v_event_id, 'TstMaxI005');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Escalas (multi-vagas: equipe 4 + individual 1)
-- ---------------------------------------------------------------------------

do $$
declare
  v_tipo_equipe uuid;
  v_tipo_ind uuid;
  v_vol uuid;
  v_sunday date;
  i int;
begin
  if extract(dow from current_date) = 0 then
    v_sunday := current_date + 7;
  else
    v_sunday := current_date + (7 - extract(dow from current_date)::int);
  end if;

  insert into public.tipos_escala (codigo, nome, is_ativa, vagas_por_servico, modo_ciclo)
  values ('tstmax_vigilancia', 'TstMax Vigilancia Equipe', true, 4, 'equipe')
  returning id into v_tipo_equipe;
  insert into tstmax_ctx values ('tipo_equipe', v_tipo_equipe, null);

  insert into public.tipos_escala (codigo, nome, is_ativa, vagas_por_servico, modo_ciclo)
  values ('tstmax_intercessao', 'TstMax Intercessao Individual', true, 1, 'individual')
  returning id into v_tipo_ind;
  insert into tstmax_ctx values ('tipo_individual', v_tipo_ind, null);

  for i in 1..6 loop
    insert into public.voluntarios_escala (tipo_escala_id, nome, is_ativo, ordem_sequencial)
    values (v_tipo_equipe, format('TstMax Servo Vigil %s', i), true, i)
    returning id into v_vol;
    if i <= 4 then
      insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico)
      values (v_tipo_equipe, v_vol, v_sunday);
    end if;
  end loop;

  for i in 1..3 loop
    insert into public.voluntarios_escala (tipo_escala_id, nome, is_ativo, ordem_sequencial)
    values (v_tipo_ind, format('TstMax Servo Inter %s', i), true, i)
    returning id into v_vol;
    insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico)
    values (v_tipo_ind, v_vol, v_sunday + (i - 1) * 7);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Pedidos pastorais (insert direto — evita exigência de auth_user_id na RPC)
-- ---------------------------------------------------------------------------

insert into public.pastoral_requests (
  profile_id, phone, motivo, situacao, description,
  category_id, subcategory_id, destination_label, confidential, request_for, status, urgency_level
)
select
  c.id,
  p.phone,
  'TstMax Pedido proprio',
  'TstMax Situacao teste',
  'TstMax Descricao pedido pastoral para carga massiva.',
  '10000000-0000-4000-8000-000000000001'::uuid,
  '20000000-0000-4000-8000-000000000006'::uuid,
  'Sigilo pastoral',
  true,
  'self',
  'new',
  1
from tstmax_ctx c
join public.profiles p on p.id = c.id
where c.key = 'profile_f1_pai'
  and not exists (
    select 1 from public.pastoral_requests pr
    where pr.profile_id = c.id and pr.motivo = 'TstMax Pedido proprio'
  );

insert into public.pastoral_requests (
  profile_id, phone, motivo, situacao, description,
  category_id, subcategory_id, destination_label, confidential, request_for,
  beneficiary_name, beneficiary_relationship, status, urgency_level
)
select
  c.id,
  p.phone,
  'TstMax Pedido familia',
  'TstMax Filho em crise',
  'TstMax Pedido em nome de familiar para teste integrado.',
  '10000000-0000-4000-8000-000000000002'::uuid,
  '20000000-0000-4000-8000-000000000015'::uuid,
  'Intercessao',
  false,
  'family',
  (select m.full_name from public.members m where m.family_id = 'TstMaxF003' and m.full_name like '%Teen%' limit 1),
  'Filho(a)',
  'new',
  2
from tstmax_ctx c
join public.profiles p on p.id = c.id
where c.key = 'profile_f3_pai'
  and not exists (
    select 1 from public.pastoral_requests pr
    where pr.profile_id = c.id and pr.motivo = 'TstMax Pedido familia'
  );

commit;

-- ---------------------------------------------------------------------------
-- 7. Conferência rápida
-- ---------------------------------------------------------------------------

select 'profiles' as entidade, count(*) as total
from public.profiles p where p.full_name like 'TstMax%' or p.family_id like 'TstMax%'
union all
select 'members', count(*) from public.members m where m.family_id like 'TstMax%'
union all
select 'events', count(*) from public.events e where e.name like 'TstMax%'
union all
select 'registrations', count(*) from public.event_registrations er where er.family_id like 'TstMax%'
union all
select 'checkins', count(*) from public.checkins c where c.family_id like 'TstMax%'
union all
select 'tipos_escala', count(*) from public.tipos_escala te where te.codigo like 'tstmax%'
union all
select 'escalas_log', count(*)
from public.escalas_log el
join public.tipos_escala te on te.id = el.tipo_escala_id
where te.codigo like 'tstmax%'
union all
select 'pastoral_requests', count(*) from public.pastoral_requests pr where pr.motivo like 'TstMax%'
union all
select 'vehicles', count(*) from public.profile_vehicles pv where upper(pv.placa) like 'TST%'
union all
select 'pessoas_members', count(*) from public.members m where m.family_id like 'TstMax%';

-- Distribuição por cidade (representantes ativos)
select
  p.address_city as cidade,
  count(*) as perfis_ativos
from public.profiles p
where p.full_name like 'TstMax%'
  and p.is_active is true
group by p.address_city
order by p.address_city;

-- Famílias vs individuais
select
  case
    when m.family_id like 'TstMaxF%' then 'familia'
    when m.family_id like 'TstMaxI%' then 'individual'
    else 'outro'
  end as tipo,
  count(*) as membros
from public.members m
where m.family_id like 'TstMax%'
group by 1
order by 1;

-- Detalhe: famílias x evento principal
select
  e.name as evento,
  m.family_id,
  m.full_name as membro,
  m.accepted,
  er.kids_status,
  c.status as checkin_status
from public.events e
join public.event_registrations er on er.event_id = e.id
join public.members m on lower(trim(m.full_name)) = lower(trim(er.full_name))
left join public.checkins c on c.event_registration_id = er.id
where e.name = 'TstMax Culto Totem+Quorum+Salas'
order by m.family_id, m.full_name;

notify pgrst, 'reload schema';
