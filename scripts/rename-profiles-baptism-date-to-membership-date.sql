-- Renomeia profiles.baptism_date → membership_date (coluna sem uso funcional no app).
-- Execute no SQL Editor do Supabase.

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'baptism_date'
  ) and not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'membership_date'
  ) then
    alter table public.profiles
      rename column baptism_date to membership_date;
  end if;
end;
$$;

comment on column public.profiles.membership_date is
  'Data de filiação/membro na igreja (antes baptism_date).';

notify pgrst, 'reload schema';
