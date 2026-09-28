-- Alinha members.marriage_date entre Representante Legal e Cônjuge da mesma família.
-- Aplica: npx supabase db query --linked -f scripts/members-sync-couple-marriage-date.sql

create or replace function public.sync_couple_marriage_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id text;
  v_rel_key text;
  v_partner_key text;
  v_partner_date date;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_family_id := public.normalize_member_family_id(new.family_id);
  v_rel_key := public.normalize_member_name_for_sync(new.relationship);

  if v_family_id is null or v_rel_key not in ('representante legal', 'conjuge') then
    return new;
  end if;

  v_partner_key := case
    when v_rel_key = 'conjuge' then 'representante legal'
    else 'conjuge'
  end;

  if new.marriage_date is not null then
    update public.members m
       set marriage_date = new.marriage_date
     where public.normalize_member_family_id(m.family_id) = v_family_id
       and m.id is distinct from new.id
       and public.normalize_member_name_for_sync(m.relationship) = v_partner_key
       and m.marriage_date is distinct from new.marriage_date
       and m.tenant_id is not distinct from new.tenant_id;
    return new;
  end if;

  select m.marriage_date
    into v_partner_date
    from public.members m
   where public.normalize_member_family_id(m.family_id) = v_family_id
     and m.id is distinct from new.id
     and public.normalize_member_name_for_sync(m.relationship) = v_partner_key
     and m.marriage_date is not null
     and m.tenant_id is not distinct from new.tenant_id
   order by m.id
   limit 1;

  if v_partner_date is null then
    return new;
  end if;

  update public.members m
     set marriage_date = v_partner_date
   where m.id = new.id
     and m.marriage_date is distinct from v_partner_date;

  return new;
end;
$$;

drop trigger if exists trg_sync_couple_marriage_date on public.members;

create trigger trg_sync_couple_marriage_date
after insert or update of marriage_date, relationship, family_id
on public.members
for each row
execute function public.sync_couple_marriage_date();
