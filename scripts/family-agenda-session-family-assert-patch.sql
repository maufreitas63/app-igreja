-- Patch: Agenda da Família / sessão efetiva (Modo Ghost)
-- 1) session_profile_family_id também considera codigo_membro
-- 2) assert_session_can_manage_family compara família de forma canônica (upper/trim)
--
-- Execute no SQL Editor do Supabase após o deploy do app.

create or replace function public.session_profile_family_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_directory_family_code(p.family_id, p.codigo_membro)
    from public.profiles p
   where p.id = public.current_session_profile_id();
$$;

create or replace function public.assert_session_can_manage_family(p_family_group_id text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session_profile_id uuid;
  v_session_family text;
  v_normalized_family text;
begin
  v_session_profile_id := public.current_session_profile_id();

  if v_session_profile_id is null then
    raise exception 'Sessão não identificada.';
  end if;

  v_normalized_family := upper(nullif(trim(coalesce(p_family_group_id, '')), ''));

  if v_normalized_family is null then
    raise exception 'Família não informada.';
  end if;

  select public.profile_directory_family_code(p.family_id, p.codigo_membro)
    into v_session_family
  from public.profiles p
  where p.id = v_session_profile_id;

  if v_session_family is null or v_session_family <> v_normalized_family then
    raise exception 'Você só pode gerenciar o pré-cadastro da sua família.';
  end if;
end;
$$;

grant execute on function public.session_profile_family_id() to anon, authenticated;
grant execute on function public.assert_session_can_manage_family(text) to anon, authenticated;
