-- Falha se um Gestor que não é Super Admin enxergar o Super Administrador.
do $$
declare
  v_gestor uuid;
  v_super uuid;
  v_visible boolean;
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'profile_visible_to_access_actor'
   limit 1;

  if v_def is null or position('is_super_admin_profile' in v_def) = 0 then
    raise exception 'profile_visible_to_access_actor não blinda o Super Administrador';
  end if;

  select pg_get_functiondef(p.oid)
    into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'assert_gestor_super_admin_shield'
   limit 1;

  if v_def is null
     or position('is_gestor_controle_acesso_profile' in v_def) = 0
     or position('super_admin' in v_def) = 0 then
    raise exception 'assert_gestor_super_admin_shield ausente ou incompleto';
  end if;

  select par.profile_id
    into v_gestor
    from public.profile_access_roles par
    join public.access_roles r on r.id = par.role_id
   where r.code = 'gestor_controle_acesso'
     and not public.is_super_admin_profile(par.profile_id)
   limit 1;

  select par.profile_id
    into v_super
    from public.profile_access_roles par
    join public.access_roles r on r.id = par.role_id
   where r.code = 'super_admin'
   limit 1;

  if v_gestor is null or v_super is null then
    return;
  end if;

  v_visible := public.profile_visible_to_access_actor(v_gestor, v_super);

  if v_visible then
    raise exception 'Gestor puro enxerga o Super Administrador';
  end if;
end;
$$;
