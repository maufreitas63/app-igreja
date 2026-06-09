-- Diagnóstico e deduplicação de members pelo telefone normalizado (somente dígitos, sem DDI 55).
-- Execute no SQL Editor do Supabase (bloco inteiro).
--
-- Ordem: função → listar duplicatas → deduplicar → criar índice único → conferência.

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

-- Duplicatas atuais (aceitos com telefone — as que bloqueiam o índice único):
select
  m.family_id,
  public.normalize_member_phone_local(m.phone) as phone_local,
  count(*) as total,
  count(*) filter (where m.accepted is true) as accepted_total
from public.members m
where m.accepted is true
  and nullif(trim(coalesce(m.phone, '')), '') is not null
  and length(public.normalize_member_phone_local(m.phone)) >= 10
group by m.family_id, public.normalize_member_phone_local(m.phone)
having count(*) > 1
order by count(*) desc, m.family_id;

-- Deduplicação: mantém o registro mais completo (aceito, birth_date, depois mais antigo).
do $$
declare
  r record;
  v_keep_id uuid;
  v_dup_id uuid;
begin
  for r in
    select
      m.family_id,
      public.normalize_member_phone_local(m.phone) as phone_local
    from public.members m
    where nullif(trim(coalesce(m.phone, '')), '') is not null
      and length(public.normalize_member_phone_local(m.phone)) >= 10
    group by m.family_id, public.normalize_member_phone_local(m.phone)
    having count(*) > 1
  loop
    select m.id
      into v_keep_id
      from public.members m
     where m.family_id = r.family_id
       and public.normalize_member_phone_local(m.phone) = r.phone_local
     order by
       case when m.accepted is true then 0 else 1 end,
       case when m.birth_date is not null then 0 else 1 end,
       m.created_at asc
     limit 1;

    for v_dup_id in
      select m.id
        from public.members m
       where m.family_id = r.family_id
         and public.normalize_member_phone_local(m.phone) = r.phone_local
         and m.id <> v_keep_id
    loop
      begin
        update public.event_registrations er
           set member_id = v_keep_id
         where er.member_id = v_dup_id
           and not exists (
             select 1
               from public.event_registrations er2
              where er2.event_id = er.event_id
                and er2.member_id = v_keep_id
           );

        delete from public.event_registrations er
         where er.member_id = v_dup_id;
      exception
        when undefined_column then
          null;
        when undefined_table then
          null;
      end;

      delete from public.members m where m.id = v_dup_id;
    end loop;
  end loop;
end
$$;

-- Índice único: um telefone por família (somente aceitos com telefone válido).
drop index if exists public.members_family_phone_local_uq;

create unique index members_family_phone_local_uq
  on public.members (
    family_id,
    public.normalize_member_phone_local(phone)
  )
  where accepted is true
    and nullif(trim(coalesce(phone, '')), '') is not null
    and length(public.normalize_member_phone_local(phone)) >= 10;

-- Conferência pós-limpeza (telefone reportado + amostra da família que falhou):
select
  m.id,
  m.full_name,
  m.family_id,
  m.phone,
  public.normalize_member_phone_local(m.phone) as phone_local,
  m.relationship,
  m.accepted,
  m.created_at
from public.members m
where public.normalize_member_phone_local(m.phone) in ('19996166161', '12997395413')
   or m.phone ilike '%99616-6161%'
order by m.family_id, m.created_at;
