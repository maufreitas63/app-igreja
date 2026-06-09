-- Ordem dos papéis no painel Controle de Acesso (aba Papéis + lista no perfil).
-- Execute no SQL Editor do Supabase se a ordem não refletir no app antigo.

create or replace function public.access_role_display_order(p_code text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_code, '')))
    when 'visitantes' then 10
    when 'congregado' then 20
    when 'member' then 30
    when 'family_acceptor' then 40
    when 'lider' then 45
    when 'events_admin' then 50
    when 'pastoral' then 60
    when 'super_admin' then 70
    else 100
  end;
$$;

grant execute on function public.access_role_display_order(text) to anon, authenticated;

notify pgrst, 'reload schema';
