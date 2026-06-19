-- Deduplica integrantes em public.members e impede novos duplicados na mesma família.
-- Execute no SQL Editor do Supabase (bloco inteiro).
--
-- Causas comuns de duplicata:
--   • inserts diretos sem upsert (Gerenciar Família, audiência do evento, vínculo de família);
--   • telefone em formatos diferentes ((19) 99999-9999 x 5519999999999);
--   • family_id com capitalização diferente (ibn0001 x IBN0001).
--
-- Ordem: funções → normalizar family_id → listar duplicatas → deduplicar → índices → RPC upsert.

-- ---------------------------------------------------------------------------
-- 1) Funções auxiliares
-- ---------------------------------------------------------------------------

create or replace function public.normalize_profile_phone(p_phone text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
$$;

create or replace function public.phones_match_for_sync(p_phone_a text, p_phone_b text)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  with normalized as (
    select
      public.normalize_profile_phone(p_phone_a) as a_digits,
      public.normalize_profile_phone(p_phone_b) as b_digits
  ),
  variants as (
    select
      a_digits,
      b_digits,
      case
        when a_digits like '55%' and length(a_digits) >= 12 then substring(a_digits from 3)
        else a_digits
      end as a_local,
      case
        when b_digits like '55%' and length(b_digits) >= 12 then substring(b_digits from 3)
        else b_digits
      end as b_local
    from normalized
  )
  select
    a_digits is not null
    and b_digits is not null
    and (
      a_digits = b_digits
      or a_digits = b_local
      or a_local = b_digits
      or a_local = b_local
      or a_digits = '55' || b_local
      or b_digits = '55' || a_local
      or trim(coalesce(p_phone_a, '')) = trim(coalesce(p_phone_b, ''))
    )
  from variants;
$$;

create or replace function public.normalize_member_phone_local(p_value text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select case
    when length(d) >= 12 and left(d, 2) = '55' then substring(d from 3)
    else d
  end
  from (
    select regexp_replace(coalesce(p_value, ''), '\D', '', 'g') as d
  ) s;
$$;

create or replace function public.normalize_member_name_for_sync(p_value text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select lower(trim(translate(
    coalesce(p_value, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  )));
$$;

create or replace function public.member_has_valid_phone(p_phone text)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  select length(public.normalize_member_phone_local(p_phone)) >= 10;
$$;

create or replace function public.normalize_member_family_id(p_family_id text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select upper(nullif(trim(coalesce(p_family_id, '')), ''));
$$;

create or replace function public.members_match_for_dedupe(
  p_left_phone text,
  p_left_name text,
  p_right_phone text,
  p_right_name text
)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  select
    (
      public.member_has_valid_phone(p_left_phone)
      and public.member_has_valid_phone(p_right_phone)
      and public.phones_match_for_sync(p_left_phone, p_right_phone)
    )
    or (
      public.normalize_member_name_for_sync(p_left_name) <> ''
      and public.normalize_member_name_for_sync(p_left_name)
        = public.normalize_member_name_for_sync(p_right_name)
      and (
        not public.member_has_valid_phone(p_left_phone)
        or not public.member_has_valid_phone(p_right_phone)
        or public.phones_match_for_sync(p_left_phone, p_right_phone)
      )
    );
$$;

create or replace function public.find_member_id_in_family(
  p_family_id text,
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
    from public.members m
   where public.normalize_member_family_id(m.family_id)
       = public.normalize_member_family_id(p_family_id)
     and public.members_match_for_dedupe(
       m.phone,
       m.full_name,
       p_phone,
       p_full_name
     )
   order by
     case when m.accepted is true then 0 else 1 end,
     case when m.birth_date is not null then 0 else 1 end,
     case when public.member_has_valid_phone(m.phone) then 0 else 1 end,
     m.created_at asc,
     m.id
   limit 1;
$$;

create or replace function public.member_keep_score(
  p_accepted boolean,
  p_birth_date date,
  p_phone text,
  p_created_at timestamptz
)
returns bigint
language sql
immutable
as $$
  select
    (case when p_accepted is true then 1000000000000000 else 0 end)::bigint
    + (case when p_birth_date is not null then 100000000000000 else 0 end)::bigint
    + (case when public.member_has_valid_phone(p_phone) then 10000000000000 else 0 end)::bigint
    - coalesce(extract(epoch from p_created_at), 0)::bigint;
$$;

create or replace function public.merge_members_keep_loser(
  p_keep_id uuid,
  p_drop_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_keep_id is null or p_drop_id is null or p_keep_id = p_drop_id then
    return;
  end if;

  begin
    update public.event_registrations er
       set member_id = p_keep_id
     where er.member_id = p_drop_id
       and not exists (
         select 1
           from public.event_registrations er2
          where er2.event_id = er.event_id
            and er2.member_id = p_keep_id
       );

    delete from public.event_registrations er
     where er.member_id = p_drop_id;
  exception
    when undefined_column then
      null;
    when undefined_table then
      null;
  end;

  begin
    update public.recepcao_cadastro_familiar r
       set applied_member_id = p_keep_id
     where r.applied_member_id = p_drop_id;
  exception
    when undefined_column then
      null;
    when undefined_table then
      null;
  end;

  delete from public.members m where m.id = p_drop_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Normalizar family_id (IBN0001 canônico)
-- ---------------------------------------------------------------------------

update public.members m
   set family_id = public.normalize_member_family_id(m.family_id)
 where m.family_id is not null
   and m.family_id is distinct from public.normalize_member_family_id(m.family_id);

-- ---------------------------------------------------------------------------
-- 3) Diagnóstico — duplicatas por telefone na mesma família
-- ---------------------------------------------------------------------------

select
  public.normalize_member_family_id(m.family_id) as family_id,
  public.normalize_member_phone_local(m.phone) as phone_local,
  count(*) as total,
  count(*) filter (where m.accepted is true) as accepted_total
from public.members m
where public.member_has_valid_phone(m.phone)
  and public.normalize_member_family_id(m.family_id) is not null
group by 1, 2
having count(*) > 1
order by count(*) desc, 1, 2;

-- ---------------------------------------------------------------------------
-- 4) Deduplicação — mantém o registro mais completo/antigo
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_keep_id uuid;
  v_drop_id uuid;
begin
  for r in
    select
      public.normalize_member_family_id(m.family_id) as family_id,
      public.normalize_member_phone_local(m.phone) as phone_local
    from public.members m
    where public.member_has_valid_phone(m.phone)
      and public.normalize_member_family_id(m.family_id) is not null
    group by 1, 2
    having count(*) > 1
  loop
    select m.id
      into v_keep_id
      from public.members m
     where public.normalize_member_family_id(m.family_id) = r.family_id
       and public.normalize_member_phone_local(m.phone) = r.phone_local
     order by
       public.member_keep_score(m.accepted, m.birth_date, m.phone, m.created_at) desc,
       m.id
     limit 1;

    for v_drop_id in
      select m.id
        from public.members m
       where public.normalize_member_family_id(m.family_id) = r.family_id
         and public.normalize_member_phone_local(m.phone) = r.phone_local
         and m.id <> v_keep_id
    loop
      perform public.merge_members_keep_loser(v_keep_id, v_drop_id);
    end loop;
  end loop;

  for r in
    with ranked as (
      select
        m.id,
        public.normalize_member_family_id(m.family_id) as family_id,
        public.normalize_member_name_for_sync(m.full_name) as member_name,
        row_number() over (
          partition by
            public.normalize_member_family_id(m.family_id),
            public.normalize_member_name_for_sync(m.full_name)
          order by
            public.member_keep_score(m.accepted, m.birth_date, m.phone, m.created_at) desc,
            m.id
        ) as rn
      from public.members m
      where public.normalize_member_family_id(m.family_id) is not null
        and public.normalize_member_name_for_sync(m.full_name) <> ''
    )
    select id as drop_id, family_id, member_name
      from ranked
     where rn > 1
  loop
    select m.id
      into v_keep_id
      from public.members m
     where public.normalize_member_family_id(m.family_id) = r.family_id
       and public.normalize_member_name_for_sync(m.full_name) = r.member_name
       and m.id <> r.drop_id
       and public.members_match_for_dedupe(
         m.phone,
         m.full_name,
         (select phone from public.members where id = r.drop_id),
         (select full_name from public.members where id = r.drop_id)
       )
     order by
       public.member_keep_score(m.accepted, m.birth_date, m.phone, m.created_at) desc,
       m.id
     limit 1;

    if v_keep_id is not null then
      perform public.merge_members_keep_loser(v_keep_id, r.drop_id);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 5) Índices únicos parciais (impedem novas duplicatas)
-- ---------------------------------------------------------------------------

drop index if exists public.members_family_phone_local_uq;
drop index if exists public.members_family_name_uq;

create unique index members_family_phone_local_uq
  on public.members (
    (public.normalize_member_family_id(family_id)),
    (public.normalize_member_phone_local(phone))
  )
  where accepted is true
    and public.normalize_member_family_id(family_id) is not null
    and public.member_has_valid_phone(phone);

create unique index members_family_name_uq
  on public.members (
    (public.normalize_member_family_id(family_id)),
    (public.normalize_member_name_for_sync(full_name))
  )
  where accepted is true
    and public.normalize_member_family_id(family_id) is not null
    and public.normalize_member_name_for_sync(full_name) <> ''
    and not public.member_has_valid_phone(phone);

-- ---------------------------------------------------------------------------
-- 6) RPC upsert usada pelo app (lib/upsertFamilyMember.ts)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_family_member(
  p_family_id text,
  p_full_name text,
  p_phone text default null,
  p_birth_date date default null,
  p_relationship text default 'Outros',
  p_accepted boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id text;
  v_full_name text;
  v_phone text;
  v_relationship text;
  v_member_id uuid;
  v_created boolean := false;
  v_member public.members%rowtype;
begin
  v_family_id := public.normalize_member_family_id(p_family_id);
  v_full_name := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone := nullif(trim(coalesce(p_phone, '')), '');
  v_relationship := nullif(trim(coalesce(p_relationship, '')), '');

  if v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Código de família inválido.'
    );
  end if;

  if v_full_name is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nome do integrante é obrigatório.'
    );
  end if;

  if v_relationship is null then
    v_relationship := 'Outros';
  end if;

  v_member_id := public.find_member_id_in_family(v_family_id, v_phone, v_full_name);

  if v_member_id is not null then
    update public.members m
       set full_name = v_full_name,
           phone = coalesce(v_phone, m.phone),
           birth_date = coalesce(p_birth_date, m.birth_date),
           relationship = coalesce(v_relationship, m.relationship),
           family_id = v_family_id,
           accepted = coalesce(p_accepted, m.accepted)
     where m.id = v_member_id
     returning * into v_member;
  else
    insert into public.members (
      full_name,
      phone,
      birth_date,
      relationship,
      family_id,
      accepted
    ) values (
      v_full_name,
      v_phone,
      p_birth_date,
      v_relationship,
      v_family_id,
      coalesce(p_accepted, true)
    )
    returning * into v_member;

    v_created := true;
  end if;

  return jsonb_build_object(
    'success', true,
    'created', v_created,
    'member_id', v_member.id,
    'member', to_jsonb(v_member)
  );
exception
  when unique_violation then
    v_member_id := public.find_member_id_in_family(v_family_id, v_phone, v_full_name);

    if v_member_id is null then
      return jsonb_build_object(
        'success', false,
        'message', sqlerrm
      );
    end if;

    select * into v_member from public.members where id = v_member_id;

    return jsonb_build_object(
      'success', true,
      'created', false,
      'member_id', v_member.id,
      'member', to_jsonb(v_member)
    );
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.upsert_family_member(text, text, text, date, text, boolean)
  to anon, authenticated;
grant execute on function public.find_member_id_in_family(text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) Conferência pós-limpeza
-- ---------------------------------------------------------------------------

select
  public.normalize_member_family_id(m.family_id) as family_id,
  coalesce(
    public.normalize_member_phone_local(m.phone),
    public.normalize_member_name_for_sync(m.full_name)
  ) as identity_key,
  count(*) as total
from public.members m
where m.accepted is true
  and public.normalize_member_family_id(m.family_id) is not null
group by 1, 2
having count(*) > 1
order by count(*) desc, 1, 2;
