-- Recepção de cadastro familiar (formulário público) antes de profiles/members.
-- Execute no SQL Editor do Supabase após register-member-atomic.sql.
--
-- Fluxo:
--   1. submit_family_registration_public → grava em recepcao_* (status pending)
--   2. Equipe revisa na manutenção
--   3. process_recepcao_cadastro_familiar_batch → promove para profiles + members
--
-- Membros já existentes em profiles/members são detectados por telefone/nome;
-- o lote usa o mesmo family_id detectado nas tabelas finais.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.recepcao_cadastro_familiar_lote (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'rejected')),
  detected_family_id text null,
  has_family_conflict boolean not null default false,
  member_count integer not null default 0,
  process_message text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists idx_recepcao_cadastro_familiar_lote_status
  on public.recepcao_cadastro_familiar_lote (status, created_at desc);

create table if not exists public.recepcao_cadastro_familiar (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.recepcao_cadastro_familiar_lote (id) on delete cascade,
  is_informant boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'rejected', 'skipped')),
  full_name text not null,
  birth_date date not null,
  phone text null,
  relationship text not null,
  cep text null,
  address_number text null,
  address_complement text null,
  medical_food_alerts text null,
  detected_family_id text null,
  matched_profile_id uuid null references public.profiles (id) on delete set null,
  matched_member_id uuid null references public.members (id) on delete set null,
  applied_family_id text null,
  process_message text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists idx_recepcao_cadastro_familiar_submission
  on public.recepcao_cadastro_familiar (submission_id);

create index if not exists idx_recepcao_cadastro_familiar_status
  on public.recepcao_cadastro_familiar (status, created_at desc);

alter table public.recepcao_cadastro_familiar_lote enable row level security;
alter table public.recepcao_cadastro_familiar enable row level security;

drop policy if exists recepcao_cadastro_familiar_lote_select on public.recepcao_cadastro_familiar_lote;
create policy recepcao_cadastro_familiar_lote_select
  on public.recepcao_cadastro_familiar_lote
  for select
  to anon, authenticated
  using (true);

drop policy if exists recepcao_cadastro_familiar_select on public.recepcao_cadastro_familiar;
create policy recepcao_cadastro_familiar_select
  on public.recepcao_cadastro_familiar
  for select
  to anon, authenticated
  using (true);

grant select on public.recepcao_cadastro_familiar_lote to anon, authenticated;
grant select on public.recepcao_cadastro_familiar to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers de correspondência
-- ---------------------------------------------------------------------------

-- Na recepção, NUNCA vincular só pelo telefone: famílias costumam compartilhar o mesmo celular.
-- Exige nome igual (case-insensitive); se houver telefone informado, ele também deve coincidir.
create or replace function public.find_profile_id_for_recepcao_match(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      nullif(trim(coalesce(p_full_name, '')), '') as full_name,
      nullif(trim(coalesce(p_phone, '')), '') as phone
  )
  select p.id
  from public.profiles p
  cross join normalized n
  where n.full_name is not null
    and lower(trim(coalesce(p.full_name, ''))) = lower(n.full_name)
    and (
      n.phone is null
      or p.phone = n.phone
      or public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(n.phone)
    )
  order by
    case
      when n.phone is not null and p.phone = n.phone then 0
      when n.phone is not null
        and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(n.phone) then 1
      else 2
    end,
    p.id
  limit 1;
$$;

create or replace function public.find_member_id_for_recepcao_match(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      nullif(trim(coalesce(p_full_name, '')), '') as full_name,
      nullif(trim(coalesce(p_phone, '')), '') as phone
  )
  select m.id
  from public.members m
  cross join normalized n
  where n.full_name is not null
    and lower(trim(coalesce(m.full_name, ''))) = lower(n.full_name)
    and (
      n.phone is null
      or m.phone = n.phone
      or public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(n.phone)
    )
  order by
    case when m.accepted is true then 0 else 1 end,
    case
      when n.phone is not null and m.phone = n.phone then 0
      when n.phone is not null
        and public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(n.phone) then 1
      else 2
    end,
    m.created_at desc nulls last,
    m.id
  limit 1;
$$;

create or replace function public.resolve_family_id_for_recepcao_person(
  p_phone text,
  p_full_name text,
  out matched_profile_id uuid,
  out matched_member_id uuid,
  out detected_family_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_family text;
  v_member_family text;
begin
  matched_profile_id := public.find_profile_id_for_recepcao_match(p_phone, p_full_name);
  matched_member_id := public.find_member_id_for_recepcao_match(p_phone, p_full_name);

  if matched_profile_id is not null then
    select nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')
      into v_profile_family
      from public.profiles p
     where p.id = matched_profile_id;
  end if;

  if matched_member_id is not null then
    select nullif(trim(coalesce(m.family_id, '')), '')
      into v_member_family
      from public.members m
     where m.id = matched_member_id;
  end if;

  detected_family_id := coalesce(v_member_family, v_profile_family);
end;
$$;

-- ---------------------------------------------------------------------------
-- Envio público → recepção
-- ---------------------------------------------------------------------------

create or replace function public.submit_family_registration_public(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_informant jsonb;
  v_dependent jsonb;
  v_informant_name text;
  v_informant_birth date;
  v_dependent_name text;
  v_birth date;
  v_phone text;
  v_relationship text;
  v_cep text;
  v_address_number text;
  v_address_complement text;
  v_food_alerts text;
  v_member_count int := 0;
  v_detected_family_id text;
  v_person_family_id text;
  v_matched_profile_id uuid;
  v_matched_member_id uuid;
  v_distinct_family_count int;
  v_allowed_relationships text[] := array[
    'Cônjuge', 'Filho(a)', 'Representante Legal', 'Pai', 'Mãe', 'Outros'
  ];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Payload inválido.');
  end if;

  v_informant := p_payload -> 'informant';

  if v_informant is null or jsonb_typeof(v_informant) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Informe os dados do representante legal.');
  end if;

  v_informant_name := nullif(trim(coalesce(v_informant ->> 'full_name', '')), '');

  if v_informant_name is null then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do representante legal.');
  end if;

  begin
    v_informant_birth := nullif(trim(coalesce(v_informant ->> 'birth_date', '')), '')::date;
  exception
    when others then
      return jsonb_build_object('success', false, 'message', 'Data de nascimento do representante legal inválida.');
  end;

  v_phone := nullif(trim(coalesce(v_informant ->> 'phone', '')), '');
  v_cep := nullif(trim(coalesce(v_informant ->> 'cep', '')), '');
  v_address_number := nullif(trim(coalesce(v_informant ->> 'address_number', '')), '');
  v_address_complement := nullif(trim(coalesce(v_informant ->> 'address_complement', '')), '');
  v_food_alerts := nullif(trim(coalesce(v_informant ->> 'medical_food_alerts', '')), '');

  for v_dependent in
    select value
      from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb))
  loop
    v_dependent_name := nullif(trim(coalesce(v_dependent ->> 'full_name', '')), '');

    if v_dependent_name is null then
      continue;
    end if;

    begin
      perform nullif(trim(coalesce(v_dependent ->> 'birth_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de nascimento inválida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');

    if v_relationship is null or not (v_relationship = any (v_allowed_relationships)) then
      return jsonb_build_object(
        'success', false,
        'message',
        format('Vínculo familiar inválido para o dependente "%s".', v_dependent_name)
      );
    end if;

    if v_relationship = 'Representante Legal' then
      return jsonb_build_object(
        'success', false,
        'message',
        'Apenas o informante pode ser Representante Legal.'
      );
    end if;
  end loop;

  insert into public.recepcao_cadastro_familiar_lote (status, member_count)
  values ('pending', 0)
  returning id into v_submission_id;

  select
    r.matched_profile_id,
    r.matched_member_id,
    r.detected_family_id
  into v_matched_profile_id, v_matched_member_id, v_person_family_id
  from public.resolve_family_id_for_recepcao_person(v_phone, v_informant_name) r;

  insert into public.recepcao_cadastro_familiar (
    submission_id,
    is_informant,
    full_name,
    birth_date,
    phone,
    relationship,
    cep,
    address_number,
    address_complement,
    medical_food_alerts,
    detected_family_id,
    matched_profile_id,
    matched_member_id
  ) values (
    v_submission_id,
    true,
    v_informant_name,
    v_informant_birth,
    v_phone,
    'Representante Legal',
    v_cep,
    v_address_number,
    v_address_complement,
    v_food_alerts,
    v_person_family_id,
    v_matched_profile_id,
    v_matched_member_id
  );

  v_member_count := v_member_count + 1;

  for v_dependent in
    select value
      from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb))
  loop
    v_dependent_name := nullif(trim(coalesce(v_dependent ->> 'full_name', '')), '');

    if v_dependent_name is null then
      continue;
    end if;

    begin
      v_birth := nullif(trim(coalesce(v_dependent ->> 'birth_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de nascimento inválida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');
    v_phone := nullif(trim(coalesce(v_dependent ->> 'phone', '')), '');
    v_food_alerts := nullif(trim(coalesce(v_dependent ->> 'medical_food_alerts', '')), '');

    select
      r.matched_profile_id,
      r.matched_member_id,
      r.detected_family_id
    into v_matched_profile_id, v_matched_member_id, v_person_family_id
    from public.resolve_family_id_for_recepcao_person(v_phone, v_dependent_name) r;

    insert into public.recepcao_cadastro_familiar (
      submission_id,
      is_informant,
      full_name,
      birth_date,
      phone,
      relationship,
      cep,
      address_number,
      address_complement,
      medical_food_alerts,
      detected_family_id,
      matched_profile_id,
      matched_member_id
    ) values (
      v_submission_id,
      false,
      v_dependent_name,
      v_birth,
      v_phone,
      v_relationship,
      v_cep,
      v_address_number,
      v_address_complement,
      v_food_alerts,
      v_person_family_id,
      v_matched_profile_id,
      v_matched_member_id
    );

    v_member_count := v_member_count + 1;
  end loop;

  select count(distinct nullif(trim(detected_family_id), ''))
    into v_distinct_family_count
    from public.recepcao_cadastro_familiar
   where submission_id = v_submission_id;

  select nullif(trim(detected_family_id), '')
    into v_detected_family_id
    from public.recepcao_cadastro_familiar
   where submission_id = v_submission_id
     and detected_family_id is not null
   order by is_informant desc, created_at
   limit 1;

  update public.recepcao_cadastro_familiar_lote
     set member_count = v_member_count,
         detected_family_id = v_detected_family_id,
         has_family_conflict = v_distinct_family_count > 1
   where id = v_submission_id;

  return jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'member_count', v_member_count,
    'detected_family_id', v_detected_family_id,
    'has_family_conflict', v_distinct_family_count > 1,
    'awaiting_review', true,
    'message',
      case
        when v_distinct_family_count > 1 then
          'Cadastro recebido. Há divergência de códigos familiares entre integrantes — a equipe analisará antes de gravar.'
        when v_detected_family_id is not null then
          format(
            'Cadastro recebido e aguardando análise. Código familiar detectado nas tabelas finais: %s.',
            v_detected_family_id
          )
        else
          'Cadastro recebido e aguardando análise da equipe antes de gravar nas tabelas finais.'
      end
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'Não foi possível registrar o cadastro na recepção.')
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Listagem para manutenção
-- ---------------------------------------------------------------------------

create or replace function public.list_recepcao_cadastro_familiar_pending(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
        'submission_id', l.id,
        'created_at', l.created_at,
        'member_count', l.member_count,
        'detected_family_id', l.detected_family_id,
        'has_family_conflict', l.has_family_conflict,
        'members', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'full_name', m.full_name,
              'is_informant', m.is_informant,
              'relationship', m.relationship,
              'phone', m.phone,
              'birth_date', m.birth_date,
              'detected_family_id', m.detected_family_id,
              'matched_profile_id', m.matched_profile_id,
              'matched_member_id', m.matched_member_id
            )
            order by m.is_informant desc, m.full_name
          ), '[]'::jsonb)
          from public.recepcao_cadastro_familiar m
          where m.submission_id = l.id
            and m.status = 'pending'
        )
      ) as row_data,
      l.created_at
      from public.recepcao_cadastro_familiar_lote l
      where l.status = 'pending'
      order by l.created_at desc
      limit greatest(coalesce(p_limit, 50), 1)
    ) q;

  return jsonb_build_object('success', true, 'submissions', v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- Gravação em lote → profiles + members
-- ---------------------------------------------------------------------------

create or replace function public.process_recepcao_cadastro_familiar_batch(
  p_submission_ids uuid[] default null,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission record;
  v_member record;
  v_family_id text;
  v_processed_submissions int := 0;
  v_processed_members int := 0;
  v_skipped_conflicts int := 0;
  v_messages text[] := array[]::text[];
  v_apply_profile_id uuid;
  v_apply_member_id uuid;
  v_existing_profile_name text;
  v_existing_member_name text;
begin
  for v_submission in
    select l.*
      from public.recepcao_cadastro_familiar_lote l
     where l.status = 'pending'
       and (
         p_submission_ids is null
         or cardinality(p_submission_ids) = 0
         or l.id = any (p_submission_ids)
       )
     order by l.created_at
  loop
    if v_submission.has_family_conflict then
      v_skipped_conflicts := v_skipped_conflicts + 1;
      v_messages := array_append(
        v_messages,
        format('Lote %s ignorado: códigos familiares divergentes entre integrantes.', v_submission.id)
      );
      continue;
    end if;

    v_family_id := nullif(trim(coalesce(v_submission.detected_family_id, '')), '');

    if v_family_id is null then
      v_family_id := public.reserve_next_family_id();
    end if;

    for v_member in
      select *
        from public.recepcao_cadastro_familiar r
       where r.submission_id = v_submission.id
         and r.status = 'pending'
       order by r.is_informant desc, r.created_at
    loop
      v_apply_profile_id := v_member.matched_profile_id;
      v_apply_member_id := v_member.matched_member_id;

      if v_apply_profile_id is not null then
        select nullif(trim(coalesce(p.full_name, '')), '')
          into v_existing_profile_name
          from public.profiles p
         where p.id = v_apply_profile_id;

        if v_existing_profile_name is null
           or lower(v_existing_profile_name) <> lower(trim(v_member.full_name)) then
          v_apply_profile_id := null;
        end if;
      end if;

      if v_apply_member_id is not null then
        select nullif(trim(coalesce(m.full_name, '')), '')
          into v_existing_member_name
          from public.members m
         where m.id = v_apply_member_id;

        if v_existing_member_name is null
           or lower(v_existing_member_name) <> lower(trim(v_member.full_name)) then
          v_apply_member_id := null;
        end if;
      end if;

      if v_apply_profile_id is not null then
        update public.profiles p
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               phone = coalesce(v_member.phone, p.phone),
               family_id = v_family_id,
               codigo_membro = v_family_id,
               cep = coalesce(v_member.cep, p.cep),
               address_number = coalesce(v_member.address_number, p.address_number),
               address_complement = coalesce(v_member.address_complement, p.address_complement),
               medical_food_alerts = coalesce(v_member.medical_food_alerts, p.medical_food_alerts),
               is_active = false
         where p.id = v_apply_profile_id;
      else
        insert into public.profiles (
          full_name,
          birth_date,
          phone,
          family_id,
          codigo_membro,
          cep,
          address_number,
          address_complement,
          medical_food_alerts,
          is_active
        ) values (
          v_member.full_name,
          v_member.birth_date,
          v_member.phone,
          v_family_id,
          v_family_id,
          v_member.cep,
          v_member.address_number,
          v_member.address_complement,
          v_member.medical_food_alerts,
          false
        );
      end if;

      if v_apply_member_id is not null then
        update public.members m
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               phone = coalesce(v_member.phone, m.phone),
               relationship = v_member.relationship,
               family_id = v_family_id
         where m.id = v_apply_member_id;
      else
        insert into public.members (
          full_name,
          birth_date,
          phone,
          relationship,
          family_id,
          accepted
        ) values (
          v_member.full_name,
          v_member.birth_date,
          v_member.phone,
          v_member.relationship,
          v_family_id,
          false
        );
      end if;

      update public.recepcao_cadastro_familiar
         set status = 'processed',
             applied_family_id = v_family_id,
             processed_at = now(),
             process_message = 'Gravado em profiles e members.'
       where id = v_member.id;

      v_processed_members := v_processed_members + 1;
    end loop;

    update public.recepcao_cadastro_familiar_lote
       set status = 'processed',
           detected_family_id = coalesce(v_submission.detected_family_id, v_family_id),
           processed_at = now(),
           process_message = format('Processado por lote. family_id=%s', v_family_id)
     where id = v_submission.id;

    v_processed_submissions := v_processed_submissions + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'processed_submissions', v_processed_submissions,
    'processed_members', v_processed_members,
    'skipped_conflicts', v_skipped_conflicts,
    'messages', v_messages
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'Não foi possível processar a recepção em lote.')
    );
end;
$$;

create or replace function public.reject_recepcao_cadastro_familiar_batch(
  p_submission_ids uuid[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if p_submission_ids is null or cardinality(p_submission_ids) = 0 then
    return jsonb_build_object('success', false, 'message', 'Informe ao menos um lote.');
  end if;

  update public.recepcao_cadastro_familiar
     set status = 'rejected',
         processed_at = now(),
         process_message = coalesce(nullif(trim(p_reason), ''), 'Rejeitado pela equipe.')
   where submission_id = any (p_submission_ids)
     and status = 'pending';

  get diagnostics v_count = row_count;

  update public.recepcao_cadastro_familiar_lote
     set status = 'rejected',
         processed_at = now(),
         process_message = coalesce(nullif(trim(p_reason), ''), 'Rejeitado pela equipe.')
   where id = any (p_submission_ids)
     and status = 'pending';

  return jsonb_build_object(
    'success', true,
    'rejected_members', v_count
  );
end;
$$;

grant execute on function public.find_profile_id_for_recepcao_match(text, text) to anon, authenticated;
grant execute on function public.find_member_id_for_recepcao_match(text, text) to authenticated;
grant execute on function public.resolve_family_id_for_recepcao_person(text, text) to anon, authenticated;
grant execute on function public.submit_family_registration_public(jsonb) to anon, authenticated;
grant execute on function public.list_recepcao_cadastro_familiar_pending(integer) to authenticated;
grant execute on function public.process_recepcao_cadastro_familiar_batch(uuid[], uuid) to authenticated;
grant execute on function public.reject_recepcao_cadastro_familiar_batch(uuid[], text) to authenticated;
