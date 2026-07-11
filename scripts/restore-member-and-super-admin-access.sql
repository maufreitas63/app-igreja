-- =============================================================================
-- Restaura acesso: super_admin + membro ativo + vínculos IBN/IBEP
-- =============================================================================
-- Use quando o login “perdeu” privilégios de membro/SA após multi-tenant
-- (tenant bloqueado na sessão, vínculo ausente, membership_out preenchido, etc.).
--
-- 1) Ajuste o telefone em params (só dígitos).
-- 2) Execute no SQL Editor do Supabase.
-- 3) No app: sair / limpar dados do site / login de novo → escolher IBN se pedir.
-- =============================================================================

begin;

-- CONFIGURE AQUI
create temporary table if not exists _restore_access_params (
  phone_digits text primary key
);
delete from _restore_access_params;
insert into _restore_access_params (phone_digits)
values ('19996166161'); -- << telefone do Maurício / seu login

-- Perfil que o LOGIN realmente usa
create temporary table if not exists _restore_login_profile (
  profile_id uuid primary key
);
delete from _restore_login_profile;
insert into _restore_login_profile (profile_id)
select public.find_profile_id_by_phone((select phone_digits from _restore_access_params))
where public.find_profile_id_by_phone((select phone_digits from _restore_access_params)) is not null;

-- (a) Papéis super_admin + member no perfil de login
insert into public.profile_access_roles (profile_id, role_id)
select lp.profile_id, ar.id
  from _restore_login_profile lp
  cross join public.access_roles ar
 where ar.code in ('super_admin', 'member')
on conflict (profile_id, role_id) do nothing;

-- Se a tabela tiver tenant_id (wave3a), alinha ao tenant padrão
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profile_access_roles'
       and column_name = 'tenant_id'
  ) then
    update public.profile_access_roles par
       set tenant_id = coalesce(par.tenant_id, public.resolve_default_tenant_id())
      from _restore_login_profile lp
     where par.profile_id = lp.profile_id
       and par.tenant_id is null;
  end if;
end $$;

-- (b) Membro ativo no app (drawer exige membership_out nulo)
update public.profiles p
   set membership_out = null,
       is_active = true,
       tenant_id = coalesce(p.tenant_id, public.resolve_default_tenant_id())
  from _restore_login_profile lp
 where p.id = lp.profile_id;

-- (c) Garantir igrejas ativas IBN / IBEP (não bloqueia IBN; libera IBEP se bloqueada)
update public.igrejas
   set is_active = true,
       updated_at = now()
 where upper(trim(code)) in ('IBN', 'IBEP')
   and is_active is distinct from true;

-- (d) Vínculos ativos; primary = IBN
insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
select
  lp.profile_id,
  i.id,
  (upper(trim(i.code)) = 'IBN'),
  true
from _restore_login_profile lp
cross join public.igrejas i
where upper(trim(i.code)) in ('IBN', 'IBEP')
  and i.is_active = true
on conflict (profile_id, tenant_id) do update
  set is_active = true,
      updated_at = now();

update public.profile_igreja_vinculos v
   set is_primary = (upper(trim(i.code)) = 'IBN'),
       updated_at = now()
  from public.igrejas i, _restore_login_profile lp
 where v.tenant_id = i.id
   and v.profile_id = lp.profile_id
   and v.is_active = true
   and upper(trim(i.code)) in ('IBN', 'IBEP');

-- profiles.tenant_id → IBN (padrão)
update public.profiles p
   set tenant_id = i.id
  from _restore_login_profile lp
  join public.igrejas i on upper(trim(i.code)) = 'IBN' and i.is_active = true
 where p.id = lp.profile_id;

commit;

-- Conferência
select
  p.id,
  p.full_name,
  p.phone,
  p.membership_out,
  p.is_active,
  p.tenant_id,
  i.code as tenant_code,
  public.is_super_admin_profile(p.id) as is_super_admin,
  exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p.id
       and ar.code = 'member'
  ) as has_member_role,
  (
    select string_agg(ix.code || case when vx.is_primary then '(P)' else '' end, ', ' order by ix.code)
      from public.profile_igreja_vinculos vx
      join public.igrejas ix on ix.id = vx.tenant_id
     where vx.profile_id = p.id
       and vx.is_active = true
  ) as vinculos_ativos,
  case
    when public.is_super_admin_profile(p.id)
     and p.membership_out is null
     and exists (
           select 1 from public.profile_igreja_vinculos v
            where v.profile_id = p.id and v.is_active = true and v.is_primary = true
         )
    then 'OK — SA + membro ativo + vínculo primary'
    else 'REVISAR — veja colunas acima'
  end as status
from public.profiles p
join _restore_login_profile lp on lp.profile_id = p.id
left join public.igrejas i on i.id = p.tenant_id;
