-- Alinha RLS da família da sessão ao cliente: family_id ?? codigo_membro.
create or replace function public.session_profile_family_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    trim(
      coalesce(
        nullif(trim(p.family_id), ''),
        nullif(trim(p.codigo_membro), '')
      )
    ),
    ''
  )
    from public.profiles p
   where p.id = public.current_session_profile_id();
$$;

comment on function public.session_profile_family_id() is
  'Família efetiva da sessão: profiles.family_id, com fallback em codigo_membro.';
