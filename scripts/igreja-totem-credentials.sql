-- =============================================================================
-- Totem de check-in — celular e senha por instância
-- =============================================================================
-- Cada igreja define o celular do tablet no hall e a senha de 4 dígitos.
-- O login do kiosk e a leitura de QR usam exatamente estes dados da instância
-- ativa (código informado na tela inicial), não um PIN global 9999.
-- =============================================================================

begin;

alter table public.igrejas
  add column if not exists cel_totem text,
  add column if not exists senha_totem text;

comment on column public.igrejas.cel_totem is
  'Celular do dispositivo totem desta instância (somente dígitos ou máscara BR).';
comment on column public.igrejas.senha_totem is
  'Senha de 4 dígitos do totem desta instância. Vazio equivale a 9999.';

-- ---------------------------------------------------------------------------
-- Migrar app_parameters.cel_totem / senha_totem já existentes
-- ---------------------------------------------------------------------------
update public.igrejas i
   set cel_totem = public.canonical_br_phone_digits(ap.value)
  from public.app_parameters ap
 where ap.tenant_id = i.id
   and lower(trim(ap.parameter)) = 'cel_totem'
   and nullif(trim(coalesce(i.cel_totem, '')), '') is null
   and public.canonical_br_phone_digits(ap.value) is not null;

update public.igrejas i
   set senha_totem = nullif(trim(ap.value), '')
  from public.app_parameters ap
 where ap.tenant_id = i.id
   and lower(trim(ap.parameter)) = 'senha_totem'
   and nullif(trim(coalesce(i.senha_totem, '')), '') is null
   and nullif(trim(ap.value), '') is not null;

-- Parâmetro global (sem tenant) — aplica só na igreja padrão, se ainda vazio.
update public.igrejas i
   set cel_totem = public.canonical_br_phone_digits(ap.value)
  from public.app_parameters ap
 where ap.tenant_id is null
   and lower(trim(ap.parameter)) = 'cel_totem'
   and i.id = public.resolve_default_tenant_id()
   and nullif(trim(coalesce(i.cel_totem, '')), '') is null
   and public.canonical_br_phone_digits(ap.value) is not null;

-- ---------------------------------------------------------------------------
-- list_admin_igrejas — inclui credenciais do totem
-- ---------------------------------------------------------------------------
drop function if exists public.list_admin_igrejas();

create function public.list_admin_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  logo_url text,
  website_url text,
  instagram_url text,
  youtube_url text,
  cnpj text,
  pix_institution text,
  pix_key text,
  pix_key_secundaria text,
  pix_institution_secundaria text,
  is_active boolean,
  is_primary boolean,
  is_linked boolean,
  mae_tenant_id uuid,
  mae_code text,
  mae_name text,
  super_admin_geolocalizacao boolean,
  cel_totem text,
  senha_totem text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := public.current_session_profile_id();
begin
  if v_profile_id is null or not public.profile_has_super_admin_role(v_profile_id) then
    return;
  end if;

  return query
  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.logo_url), ''),
    nullif(trim(i.website_url), ''),
    nullif(trim(i.instagram_url), ''),
    nullif(trim(i.youtube_url), ''),
    nullif(trim(i.cnpj), ''),
    b1.institution,
    b1.pix_key,
    b2.pix_key,
    b2.institution,
    i.is_active,
    coalesce(v.is_primary, false),
    (v.id is not null),
    i.mae_tenant_id,
    mae.code,
    mae.name,
    coalesce(i.super_admin_geolocalizacao, true),
    public.canonical_br_phone_digits(i.cel_totem),
    nullif(trim(i.senha_totem), '')
  from public.igrejas i
  left join public.igrejas mae on mae.id = i.mae_tenant_id
  left join public.profile_igreja_vinculos v
    on v.tenant_id = i.id
   and v.profile_id = v_profile_id
   and v.is_active = true
  left join lateral (
    select
      nullif(trim(b.institution), '') as institution,
      nullif(trim(b.pix_key), '') as pix_key
      from public.bank_accounts b
     where b.tenant_id = i.id
     order by b.sort_order, b.created_at
     limit 1
  ) b1 on true
  left join lateral (
    select
      nullif(trim(b.institution), '') as institution,
      nullif(trim(b.pix_key), '') as pix_key
      from public.bank_accounts b
     where b.tenant_id = i.id
     order by b.sort_order, b.created_at
     offset 1
     limit 1
  ) b2 on true
  order by i.is_active desc, coalesce(v.is_primary, false) desc, i.name asc;
end;
$$;

grant execute on function public.list_admin_igrejas() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Setter (somente Superadministrador)
-- ---------------------------------------------------------------------------
create or replace function public.set_igreja_totem_credentials_admin(
  p_tenant_id uuid,
  p_phone text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_phone text;
  v_password text;
  v_other_code text;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;

  if p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não informada.');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  v_phone := public.canonical_br_phone_digits(p_phone);
  v_password := nullif(trim(coalesce(p_password, '')), '');

  if v_password is not null and v_password !~ '^\d{4}$' then
    return jsonb_build_object(
      'success', false,
      'message', 'A senha do totem deve ter 4 dígitos.'
    );
  end if;

  if v_phone is not null then
    select i.code
      into v_other_code
      from public.igrejas i
     where i.id <> p_tenant_id
       and public.canonical_br_phone_digits(i.cel_totem) = v_phone
     limit 1;

    if v_other_code is not null then
      return jsonb_build_object(
        'success', false,
        'message', 'Este celular já é o totem da instância ' || v_other_code || '.'
      );
    end if;
  end if;

  update public.igrejas
     set cel_totem = v_phone,
         senha_totem = v_password,
         updated_at = now()
   where id = p_tenant_id;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  update public.app_parameters
     set value = coalesce(v_phone, '')
   where tenant_id = p_tenant_id
     and lower(trim(parameter)) = 'cel_totem';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('cel_totem', coalesce(v_phone, ''), p_tenant_id);
  end if;

  update public.app_parameters
     set value = coalesce(v_password, '')
   where tenant_id = p_tenant_id
     and lower(trim(parameter)) = 'senha_totem';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('senha_totem', coalesce(v_password, ''), p_tenant_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'cel_totem', v_phone,
    'senha_totem', v_password,
    'message', case
      when v_phone is null then 'Totem desta instância sem celular vinculado.'
      else 'Celular e senha do totem salvos para esta instância.'
    end
  );
end;
$$;

grant execute on function public.set_igreja_totem_credentials_admin(uuid, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Detecção global (bloqueia cadastro de membro no celular do totem)
-- ---------------------------------------------------------------------------
create or replace function public.is_cel_totem_phone(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.igrejas i
     where public.canonical_br_phone_digits(i.cel_totem)
         = public.canonical_br_phone_digits(p_phone)
  )
  or exists (
    select 1
      from public.app_parameters ap
     where lower(trim(ap.parameter)) = 'cel_totem'
       and public.canonical_br_phone_digits(ap.value)
         = public.canonical_br_phone_digits(p_phone)
       and not exists (
         select 1
           from public.igrejas i
          where i.id = ap.tenant_id
            and public.canonical_br_phone_digits(i.cel_totem) is not null
       )
  );
$$;

create or replace function public.list_cel_totem_phones()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select array_agg(distinct phone)
        from (
          select public.canonical_br_phone_digits(i.cel_totem) as phone
            from public.igrejas i
           where public.canonical_br_phone_digits(i.cel_totem) is not null
          union
          select public.canonical_br_phone_digits(ap.value)
            from public.app_parameters ap
           where lower(trim(ap.parameter)) = 'cel_totem'
             and public.canonical_br_phone_digits(ap.value) is not null
             and not exists (
               select 1
                 from public.igrejas i
                where i.id = ap.tenant_id
                  and public.canonical_br_phone_digits(i.cel_totem) is not null
             )
        ) phones
       where phone is not null
    ),
    '{}'::text[]
  );
$$;

grant execute on function public.is_cel_totem_phone(text) to anon, authenticated;
grant execute on function public.list_cel_totem_phones() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Login do kiosk: celular + senha da instância ativa (x-tenant-id)
-- ---------------------------------------------------------------------------
create or replace function public.verify_totem_login(
  p_phone text,
  p_password text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_phone text;
  v_configured text;
  v_password text;
  v_expected text;
begin
  v_phone := public.canonical_br_phone_digits(p_phone);

  if v_tenant is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe o código da instância da igreja para usar o totem.'
    );
  end if;

  if v_phone is null then
    return jsonb_build_object('ok', false, 'message', 'Informe o celular do totem.');
  end if;

  select
    public.canonical_br_phone_digits(i.cel_totem),
    nullif(trim(i.senha_totem), '')
    into v_configured, v_password
    from public.igrejas i
   where i.id = v_tenant
     and i.is_active = true;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'message', 'Instância não encontrada ou inativa.'
    );
  end if;

  if v_configured is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Totem não configurado nesta instância. Cadastre o celular em Instâncias.'
    );
  end if;

  if v_configured <> v_phone then
    return jsonb_build_object(
      'ok', false,
      'message', 'Este celular não é o totem desta instância.'
    );
  end if;

  v_expected := coalesce(v_password, '9999');

  if trim(coalesce(p_password, '')) <> v_expected then
    return jsonb_build_object('ok', false, 'message', 'Senha do totem incorreta.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'phone', v_configured,
    'tenant_id', v_tenant,
    'message', 'Totem autenticado.'
  );
end;
$$;

grant execute on function public.verify_totem_login(text, text) to anon, authenticated;

create or replace function public.verify_totem_session_phone(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_phone text;
  v_configured text;
begin
  v_phone := public.canonical_br_phone_digits(p_phone);

  if v_tenant is null then
    return jsonb_build_object('ok', false, 'message', 'Instância da sessão não encontrada.');
  end if;

  select public.canonical_br_phone_digits(i.cel_totem)
    into v_configured
    from public.igrejas i
   where i.id = v_tenant;

  if v_configured is null or v_phone is null or v_configured <> v_phone then
    return jsonb_build_object(
      'ok', false,
      'message', 'O totem desta instância não está vinculado a este aparelho.'
    );
  end if;

  return jsonb_build_object('ok', true, 'phone', v_configured, 'tenant_id', v_tenant);
end;
$$;

grant execute on function public.verify_totem_session_phone(text) to anon, authenticated;

commit;
