-- Relatório Controle de Acesso: pessoas agrupadas por papel.
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador

create or replace function public.listar_pessoas_por_papel_access_admin(
  p_actor_profile_id uuid
)
returns table (
  role_id uuid,
  role_code text,
  role_name text,
  profile_id uuid,
  full_name text,
  phone text,
  codigo_membro text,
  desligado boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    ar.id as role_id,
    ar.code as role_code,
    ar.name as role_name,
    ppl.profile_id,
    ppl.full_name,
    ppl.phone,
    ppl.codigo_membro,
    ppl.desligado
  from public.access_roles ar
  left join lateral (
    select
      p.id as profile_id,
      coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
      coalesce(nullif(trim(p.phone), ''), null) as phone,
      coalesce(nullif(trim(p.codigo_membro), ''), null) as codigo_membro,
      (p.membership_out is not null) as desligado
    from public.profile_access_roles par
    join public.profiles p on p.id = par.profile_id
    where par.role_id = ar.id
      and p.tenant_id = v_tenant
      and (par.tenant_id is null or par.tenant_id = v_tenant)
      and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
  ) ppl on true
  where
    -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
    public.is_super_admin_profile(p_actor_profile_id)
    or ar.code <> 'super_admin'
  order by
    public.access_role_display_order(ar.code),
    ar.name asc,
    ppl.full_name asc nulls last;
end;
$$;

grant execute on function public.listar_pessoas_por_papel_access_admin(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
