-- =============================================================================
-- Contas bancárias ilimitadas por tenant (substitui app_parameters de Pix)
-- =============================================================================
-- Tabela public.bank_accounts, migração, RPCs e limpeza das chaves EAV.
-- Aplica: npx supabase db query --linked -f scripts/bank-accounts-schema.sql
-- =============================================================================

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  label text not null default 'Conta Pix',
  institution text null,
  holder_name text null,
  document text null,
  agency text null,
  account_number text null,
  account_type text null,
  pix_key text null,
  is_active boolean not null default true,
  is_default_offerings boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_profile_id uuid null references public.profiles (id) on delete set null,
  constraint bank_accounts_label_check check (length(trim(label)) >= 1),
  constraint bank_accounts_account_type_check check (
    account_type is null
    or account_type in ('corrente', 'poupanca', 'pagamento', 'salario', 'outro')
  )
);

create index if not exists bank_accounts_tenant_idx
  on public.bank_accounts (tenant_id, is_active, sort_order, created_at);

create unique index if not exists bank_accounts_one_default_per_tenant
  on public.bank_accounts (tenant_id)
  where is_default_offerings = true;

comment on table public.bank_accounts is
  'Instituições/contas Pix da instância. Ilimitadas por tenant_id.';

alter table public.bank_accounts enable row level security;

drop policy if exists bank_accounts_deny_all on public.bank_accounts;
create policy bank_accounts_deny_all
  on public.bank_accounts
  for all
  using (false)
  with check (false);

revoke all on table public.bank_accounts from anon, authenticated;

alter table public.campaign_projects
  add column if not exists bank_account_id uuid;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'campaign_projects_bank_account_id_fkey'
  ) then
    alter table public.campaign_projects
      add constraint campaign_projects_bank_account_id_fkey
      foreign key (bank_account_id) references public.bank_accounts (id) on delete set null;
  end if;
end;
$$;

alter table public.campaign_projects
  drop constraint if exists campaign_projects_chave_pix_selecionada_check;

alter table public.campaign_projects
  alter column chave_pix_selecionada drop not null;

comment on column public.campaign_projects.bank_account_id is
  'Conta bancária/Pix que recebe as contribuições desta campanha.';

-- ---------------------------------------------------------------------------
-- Migração a partir de app_parameters + igrejas (idempotente)
-- ---------------------------------------------------------------------------

with src as (
  select
    i.id as tenant_id,
    coalesce(
      public.read_tenant_app_parameter(i.id, 'nome_conta_pix_1'),
      nullif(trim(i.pix_institution), ''),
      'Conta 1'
    ) as label_1,
    coalesce(
      nullif(trim(i.pix_institution), ''),
      public.read_tenant_app_parameter(i.id, 'nome_conta_pix_1')
    ) as inst_1,
    coalesce(
      public.read_tenant_app_parameter(i.id, 'chave_pix'),
      nullif(trim(i.pix_key), '')
    ) as pix_1,
    coalesce(
      public.read_tenant_app_parameter(i.id, 'nome_conta_pix_2'),
      nullif(trim(i.pix_institution_secundaria), ''),
      'Conta 2'
    ) as label_2,
    coalesce(
      nullif(trim(i.pix_institution_secundaria), ''),
      public.read_tenant_app_parameter(i.id, 'nome_conta_pix_2')
    ) as inst_2,
    coalesce(
      public.read_tenant_app_parameter(i.id, 'chave_pix_secundaria'),
      nullif(trim(i.pix_key_secundaria), '')
    ) as pix_2,
    public.normalize_pix_account_slot(
      public.read_tenant_app_parameter(i.id, 'chave_pix_padrao_ofertas')
    ) as default_slot
  from public.igrejas i
)
insert into public.bank_accounts (
  tenant_id, label, institution, pix_key, is_default_offerings, sort_order, is_active
)
select
  s.tenant_id,
  v.label,
  v.institution,
  v.pix_key,
  v.is_default,
  v.sort_order,
  true
from src s
cross join lateral (
  values
    (1, s.label_1, s.inst_1, s.pix_1, (s.default_slot <> '2')),
    (2, s.label_2, s.inst_2, s.pix_2, (s.default_slot = '2'))
) as v(sort_order, label, institution, pix_key, is_default)
where not exists (
  select 1 from public.bank_accounts b where b.tenant_id = s.tenant_id
)
  and (
    v.sort_order = 1
    or nullif(trim(coalesce(v.pix_key, '')), '') is not null
    or (
      nullif(trim(coalesce(v.institution, '')), '') is not null
      and lower(trim(v.label)) not in ('conta 2', 'conta secundária', 'conta secundaria')
    )
  );

-- Se a conta 2 ficou como padrão mas não foi inserida, a 1 assume.
update public.bank_accounts b
   set is_default_offerings = true
 where b.sort_order = 1
   and not exists (
     select 1
       from public.bank_accounts x
      where x.tenant_id = b.tenant_id
        and x.is_default_offerings
   );

update public.campaign_projects c
   set bank_account_id = b.id
  from public.bank_accounts b
 where c.bank_account_id is null
   and b.tenant_id = c.tenant_id
   and b.sort_order = case when coalesce(c.chave_pix_selecionada, '1') = '2' then 2 else 1 end;

update public.campaign_projects c
   set bank_account_id = b.id
  from public.bank_accounts b
 where c.bank_account_id is null
   and b.tenant_id = c.tenant_id
   and b.is_default_offerings = true;

-- ---------------------------------------------------------------------------
-- JSON / resolução
-- ---------------------------------------------------------------------------

create or replace function public.bank_account_to_json(p_row public.bank_accounts)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'tenant_id', p_row.tenant_id,
    'label', p_row.label,
    'institution', nullif(trim(p_row.institution), ''),
    'holder_name', nullif(trim(p_row.holder_name), ''),
    'document', nullif(trim(p_row.document), ''),
    'agency', nullif(trim(p_row.agency), ''),
    'account_number', nullif(trim(p_row.account_number), ''),
    'account_type', p_row.account_type,
    'pix_key', nullif(trim(p_row.pix_key), ''),
    'is_active', p_row.is_active,
    'is_default_offerings', p_row.is_default_offerings,
    'sort_order', p_row.sort_order
  );
$$;

create or replace function public.tenant_bank_accounts_json(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_default uuid;
  v_accounts jsonb;
begin
  if p_tenant is null then
    return jsonb_build_object('default_id', null, 'accounts', '[]'::jsonb);
  end if;

  select b.id
    into v_default
    from public.bank_accounts b
   where b.tenant_id = p_tenant
     and b.is_default_offerings = true
   limit 1;

  if v_default is null then
    select b.id
      into v_default
      from public.bank_accounts b
     where b.tenant_id = p_tenant
       and b.is_active = true
       and nullif(trim(b.pix_key), '') is not null
     order by b.sort_order, b.created_at
     limit 1;
  end if;

  select coalesce(jsonb_agg(public.bank_account_to_json(b) order by b.sort_order, b.created_at), '[]'::jsonb)
    into v_accounts
    from public.bank_accounts b
   where b.tenant_id = p_tenant;

  return jsonb_build_object(
    'default_id', v_default,
    'accounts', v_accounts
  );
end;
$$;

create or replace function public.tenant_pix_accounts_json(p_tenant uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.tenant_bank_accounts_json(p_tenant);
$$;

create or replace function public.resolve_tenant_bank_account(p_tenant uuid, p_id uuid)
returns public.bank_accounts
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.bank_accounts%rowtype;
begin
  if p_tenant is null then
    return v_row;
  end if;

  if p_id is not null then
    select * into v_row
      from public.bank_accounts b
     where b.tenant_id = p_tenant
       and b.id = p_id;
    if v_row.id is not null then
      return v_row;
    end if;
  end if;

  select * into v_row
    from public.bank_accounts b
   where b.tenant_id = p_tenant
     and b.is_default_offerings = true
   limit 1;

  if v_row.id is not null then
    return v_row;
  end if;

  select * into v_row
    from public.bank_accounts b
   where b.tenant_id = p_tenant
     and b.is_active = true
   order by b.sort_order, b.created_at
   limit 1;

  return v_row;
end;
$$;

create or replace function public.resolve_tenant_pix_key(p_tenant uuid, p_slot text)
returns text
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
  v_row public.bank_accounts%rowtype;
begin
  if p_tenant is null then
    return null;
  end if;

  begin
    v_id := p_slot::uuid;
  exception
    when others then
      v_id := null;
  end;

  if v_id is not null then
    v_row := public.resolve_tenant_bank_account(p_tenant, v_id);
    return nullif(trim(v_row.pix_key), '');
  end if;

  if public.normalize_pix_account_slot(p_slot) = '2' then
    select * into v_row
      from public.bank_accounts b
     where b.tenant_id = p_tenant
     order by b.sort_order desc, b.created_at desc
     limit 1 offset 1;
  else
    v_row := public.resolve_tenant_bank_account(p_tenant, null);
  end if;

  return nullif(trim(v_row.pix_key), '');
end;
$$;

create or replace function public.resolve_tenant_pix_institution(p_tenant uuid, p_slot text)
returns text
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
  v_row public.bank_accounts%rowtype;
begin
  if p_tenant is null then
    return null;
  end if;

  begin
    v_id := p_slot::uuid;
  exception
    when others then
      v_id := null;
  end;

  if v_id is not null then
    v_row := public.resolve_tenant_bank_account(p_tenant, v_id);
  elsif public.normalize_pix_account_slot(p_slot) = '2' then
    select * into v_row
      from public.bank_accounts b
     where b.tenant_id = p_tenant
     order by b.sort_order desc, b.created_at desc
     limit 1 offset 1;
  else
    v_row := public.resolve_tenant_bank_account(p_tenant, null);
  end if;

  return coalesce(
    nullif(trim(v_row.institution), ''),
    nullif(trim(v_row.label), '')
  );
end;
$$;

create or replace function public.session_can_manage_pix_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.session_has_screen_access('maintenance.card.financials', 'update')
    or public.session_has_screen_access('maintenance.finance.campaigns', 'update')
    or exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = public.current_session_profile_id()
         and ar.code in ('secretaria', 'tesoureiro', 'super_admin')
    ),
    false
  );
$$;

grant execute on function public.session_can_manage_pix_accounts() to anon, authenticated;

create or replace function public.get_session_pix_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_payload jsonb;
begin
  if v_profile_id is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_can_use_tenant(v_profile_id, v_tenant) then
    return jsonb_build_object('success', false, 'message', 'Sem acesso a esta igreja.');
  end if;

  v_payload := public.tenant_bank_accounts_json(v_tenant);
  return v_payload || jsonb_build_object(
    'success', true,
    'can_manage', public.session_can_manage_pix_accounts(),
    'default_slot', v_payload->>'default_id'
  );
end;
$$;

grant execute on function public.get_session_pix_accounts() to anon, authenticated;

create or replace function public.upsert_bank_account_admin(
  p_id uuid default null,
  p_label text default null,
  p_institution text default null,
  p_holder_name text default null,
  p_document text default null,
  p_agency text default null,
  p_account_number text default null,
  p_account_type text default null,
  p_pix_key text default null,
  p_is_default_offerings boolean default false,
  p_is_active boolean default true,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_type text := nullif(trim(coalesce(p_account_type, '')), '');
  v_row public.bank_accounts%rowtype;
  v_sort integer;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.session_can_manage_pix_accounts()
     and not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para configurar contas bancárias.');
  end if;

  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não informada.');
  end if;

  if p_tenant_id is not null
     and p_tenant_id is distinct from public.current_session_tenant_id()
     and not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores alteram outra instância.');
  end if;

  if v_type is not null
     and v_type not in ('corrente', 'poupanca', 'pagamento', 'salario', 'outro') then
    return jsonb_build_object('success', false, 'message', 'Tipo de conta inválido.');
  end if;

  if p_id is null then
    select coalesce(max(b.sort_order), 0) + 1
      into v_sort
      from public.bank_accounts b
     where b.tenant_id = v_tenant;

    if p_is_default_offerings then
      update public.bank_accounts
         set is_default_offerings = false
       where tenant_id = v_tenant;
    end if;

    insert into public.bank_accounts (
      tenant_id, label, institution, holder_name, document, agency, account_number,
      account_type, pix_key, is_default_offerings, is_active, sort_order, created_by_profile_id
    ) values (
      v_tenant,
      coalesce(nullif(trim(p_label), ''), 'Conta Pix'),
      nullif(trim(p_institution), ''),
      nullif(trim(p_holder_name), ''),
      nullif(trim(p_document), ''),
      nullif(trim(p_agency), ''),
      nullif(trim(p_account_number), ''),
      v_type,
      nullif(trim(p_pix_key), ''),
      coalesce(p_is_default_offerings, false),
      coalesce(p_is_active, true),
      v_sort,
      v_actor
    )
    returning * into v_row;
  else
    if p_is_default_offerings then
      update public.bank_accounts
         set is_default_offerings = false
       where tenant_id = v_tenant
         and id <> p_id;
    end if;

    update public.bank_accounts b
       set label = coalesce(nullif(trim(p_label), ''), b.label),
           institution = nullif(trim(p_institution), ''),
           holder_name = nullif(trim(p_holder_name), ''),
           document = nullif(trim(p_document), ''),
           agency = nullif(trim(p_agency), ''),
           account_number = nullif(trim(p_account_number), ''),
           account_type = v_type,
           pix_key = nullif(trim(p_pix_key), ''),
           is_default_offerings = coalesce(p_is_default_offerings, b.is_default_offerings),
           is_active = coalesce(p_is_active, b.is_active),
           updated_at = now()
     where b.id = p_id
       and b.tenant_id = v_tenant
    returning * into v_row;

    if v_row.id is null then
      return jsonb_build_object('success', false, 'message', 'Conta não encontrada.');
    end if;
  end if;

  if not exists (
    select 1 from public.bank_accounts b
     where b.tenant_id = v_tenant and b.is_default_offerings
  ) then
    update public.bank_accounts
       set is_default_offerings = true
     where id = v_row.id;
  end if;

  return public.get_session_pix_accounts() || jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'message', 'Conta bancária salva.'
  );
end;
$$;

grant execute on function public.upsert_bank_account_admin(
  uuid, text, text, text, text, text, text, text, text, boolean, boolean, uuid
) to anon, authenticated;

create or replace function public.delete_bank_account_admin(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_was_default boolean;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.session_can_manage_pix_accounts() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir contas bancárias.');
  end if;

  select b.is_default_offerings
    into v_was_default
    from public.bank_accounts b
   where b.id = p_id
     and b.tenant_id = v_tenant;

  if v_was_default is null then
    return jsonb_build_object('success', false, 'message', 'Conta não encontrada.');
  end if;

  delete from public.bank_accounts b
   where b.id = p_id
     and b.tenant_id = v_tenant;

  if v_was_default then
    update public.bank_accounts b
       set is_default_offerings = true
     where b.id = (
       select x.id
         from public.bank_accounts x
        where x.tenant_id = v_tenant
        order by x.sort_order, x.created_at
        limit 1
     );
  end if;

  return public.get_session_pix_accounts() || jsonb_build_object(
    'success', true,
    'message', 'Conta bancária excluída.'
  );
end;
$$;

grant execute on function public.delete_bank_account_admin(uuid) to anon, authenticated;

-- Compat: tesouraria antiga salvava 2 slots; agora grava nas duas primeiras contas.
create or replace function public.salvar_pix_accounts_admin(
  p_nome_conta_1 text default null,
  p_chave_pix_1 text default null,
  p_nome_conta_2 text default null,
  p_chave_pix_2 text default null,
  p_padrao_ofertas text default '1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_id_1 uuid;
  v_id_2 uuid;
  v_default text := public.normalize_pix_account_slot(p_padrao_ofertas);
begin
  select b.id into v_id_1
    from public.bank_accounts b
   where b.tenant_id = v_tenant
   order by b.sort_order, b.created_at
   limit 1;

  perform public.upsert_bank_account_admin(
    v_id_1,
    coalesce(nullif(trim(p_nome_conta_1), ''), 'Conta 1'),
    p_nome_conta_1,
    null, null, null, null, null,
    p_chave_pix_1,
    v_default <> '2',
    true,
    v_tenant
  );

  select b.id into v_id_1
    from public.bank_accounts b
   where b.tenant_id = v_tenant
   order by b.sort_order, b.created_at
   limit 1;

  select b.id into v_id_2
    from public.bank_accounts b
   where b.tenant_id = v_tenant
     and b.id <> v_id_1
   order by b.sort_order, b.created_at
   limit 1;

  if nullif(trim(coalesce(p_chave_pix_2, '')), '') is not null
     or nullif(trim(coalesce(p_nome_conta_2, '')), '') is not null then
    perform public.upsert_bank_account_admin(
      v_id_2,
      coalesce(nullif(trim(p_nome_conta_2), ''), 'Conta 2'),
      p_nome_conta_2,
      null, null, null, null, null,
      p_chave_pix_2,
      v_default = '2',
      true,
      v_tenant
    );
  end if;

  return public.get_session_pix_accounts() || jsonb_build_object(
    'success', true,
    'message', 'Contas Pix salvas.'
  );
end;
$$;

grant execute on function public.salvar_pix_accounts_admin(text, text, text, text, text)
  to anon, authenticated;

create or replace function public.get_session_offerings_recipient(p_tenant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_church record;
  v_bank public.bank_accounts%rowtype;
begin
  if v_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Igreja ativa não encontrada. Selecione a instância novamente.'
    );
  end if;

  if not public.profile_can_use_tenant(v_profile_id, v_tenant) then
    return jsonb_build_object('success', false, 'message', 'Sem acesso a esta igreja.');
  end if;

  select i.id, i.code, i.name, nullif(trim(i.cnpj), '') as cnpj
    into v_church
    from public.igrejas i
   where i.id = v_tenant
     and i.is_active = true;

  if v_church.id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada ou inativa.');
  end if;

  v_bank := public.resolve_tenant_bank_account(v_tenant, null);

  return jsonb_build_object(
    'success', true,
    'id', v_church.id,
    'code', v_church.code,
    'name', v_church.name,
    'cnpj', coalesce(nullif(trim(v_bank.document), ''), v_church.cnpj),
    'pix_institution', coalesce(nullif(trim(v_bank.institution), ''), nullif(trim(v_bank.label), '')),
    'pix_key', nullif(trim(v_bank.pix_key), ''),
    'holder_name', nullif(trim(v_bank.holder_name), ''),
    'agency', nullif(trim(v_bank.agency), ''),
    'account_number', nullif(trim(v_bank.account_number), ''),
    'account_type', v_bank.account_type,
    'bank_account_id', v_bank.id,
    'pix_accounts', public.tenant_bank_accounts_json(v_tenant)->'accounts',
    'pix_default_id', v_bank.id
  );
end;
$$;

grant execute on function public.get_session_offerings_recipient(uuid)
  to anon, authenticated;

create or replace function public.campaign_project_json(p_row public.campaign_projects)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_donations integer := 0;
  v_intents integer := 0;
  v_days numeric := 1;
  v_pct numeric := 0;
  v_bank public.bank_accounts%rowtype;
begin
  select count(*)::integer
    into v_donations
    from public.financials f
   where f.campaign_project_id = p_row.id
     and upper(trim(f.budget_version)) like '%REALIZ%'
     and upper(trim(f.transaction_kind)) like '%ENTRAD%';

  select count(*)::integer
    into v_intents
    from public.campaign_contribution_intents i
   where i.campaign_id = p_row.id;

  v_days := greatest(
    1,
    (coalesce(p_row.data_fim, (timezone('America/Sao_Paulo', now()))::date)
      - p_row.data_inicio) + 1
  );
  v_pct := case
    when p_row.meta_financeira > 0
      then round((p_row.valor_arrecadado / p_row.meta_financeira) * 100, 1)
    else 0
  end;

  v_bank := public.resolve_tenant_bank_account(p_row.tenant_id, p_row.bank_account_id);

  return jsonb_build_object(
    'id', p_row.id,
    'titulo', p_row.titulo,
    'descricao', p_row.descricao,
    'meta_financeira', p_row.meta_financeira,
    'valor_arrecadado', p_row.valor_arrecadado,
    'data_inicio', p_row.data_inicio,
    'data_fim', p_row.data_fim,
    'status', p_row.status,
    'centavos_referencia', p_row.centavos_referencia,
    'cover_url', p_row.cover_url,
    'bank_account_id', v_bank.id,
    'chave_pix_selecionada', v_bank.id,
    'pix_key', nullif(trim(v_bank.pix_key), ''),
    'pix_institution', coalesce(nullif(trim(v_bank.institution), ''), nullif(trim(v_bank.label), '')),
    'holder_name', nullif(trim(v_bank.holder_name), ''),
    'document', nullif(trim(v_bank.document), ''),
    'agency', nullif(trim(v_bank.agency), ''),
    'account_number', nullif(trim(v_bank.account_number), ''),
    'account_type', v_bank.account_type,
    'progress_pct', v_pct,
    'donations_count', v_donations,
    'unique_donors', greatest(v_donations, v_intents),
    'velocity_per_day', round(p_row.valor_arrecadado / v_days, 2)
  );
end;
$$;

drop function if exists public.upsert_campaign_project(uuid, text, text, numeric, date, date, text, numeric, text, text);

create or replace function public.upsert_campaign_project(
  p_id uuid default null,
  p_titulo text default null,
  p_descricao text default '',
  p_meta_financeira numeric default null,
  p_data_inicio date default null,
  p_data_fim date default null,
  p_status text default 'rascunho',
  p_centavos_referencia numeric default null,
  p_cover_url text default null,
  p_chave_pix_selecionada text default null,
  p_bank_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_status text := lower(trim(coalesce(p_status, 'rascunho')));
  v_cents numeric(4, 2);
  v_meta numeric(14, 2);
  v_bank uuid := p_bank_account_id;
  v_id uuid;
  v_row public.campaign_projects%rowtype;
begin
  if v_actor is null or not public.session_can_manage_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerir campanhas.');
  end if;

  if not (
    public.is_super_admin_profile(v_actor)
    or public.profile_has_access(
      v_actor,
      'screen',
      'maintenance.finance.campaigns',
      'update'
    )
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar campanhas.');
  end if;

  if v_status not in ('rascunho', 'ativo', 'concluido') then
    v_status := 'rascunho';
  end if;

  v_cents := round(coalesce(p_centavos_referencia, 0.01), 2);

  if v_cents < 0.01 or v_cents > 0.99 then
    return jsonb_build_object('success', false, 'message', 'Informe os centavos de referência entre 0,01 e 0,99.');
  end if;

  v_meta := case
    when p_meta_financeira is null or p_meta_financeira <= 0 then null
    else round(p_meta_financeira, 2)
  end;

  if v_bank is null and p_chave_pix_selecionada ~* '^[0-9a-f-]{32,36}$' then
    begin
      v_bank := p_chave_pix_selecionada::uuid;
    exception
      when others then
        v_bank := null;
    end;
  end if;

  if v_bank is not null
     and not exists (
       select 1 from public.bank_accounts b
        where b.id = v_bank and b.tenant_id = v_tenant
     ) then
    return jsonb_build_object('success', false, 'message', 'Conta bancária inválida para esta igreja.');
  end if;

  if p_id is null then
    if coalesce(trim(p_titulo), '') = '' then
      return jsonb_build_object('success', false, 'message', 'Informe o título da campanha.');
    end if;

    insert into public.campaign_projects (
      tenant_id, titulo, descricao, meta_financeira, data_inicio, data_fim,
      status, centavos_referencia, cover_url, bank_account_id, created_by_profile_id
    ) values (
      v_tenant,
      trim(p_titulo),
      coalesce(trim(p_descricao), ''),
      v_meta,
      coalesce(p_data_inicio, (timezone('America/Sao_Paulo', now()))::date),
      p_data_fim,
      v_status,
      v_cents,
      nullif(trim(coalesce(p_cover_url, '')), ''),
      v_bank,
      v_actor
    )
    returning * into v_row;
  else
    update public.campaign_projects c
       set titulo = coalesce(nullif(trim(coalesce(p_titulo, '')), ''), c.titulo),
           descricao = coalesce(p_descricao, c.descricao),
           meta_financeira = v_meta,
           data_inicio = coalesce(p_data_inicio, c.data_inicio),
           data_fim = p_data_fim,
           status = v_status,
           centavos_referencia = v_cents,
           cover_url = case
             when p_cover_url is null then c.cover_url
             when trim(p_cover_url) = '' then null
             else trim(p_cover_url)
           end,
           bank_account_id = v_bank,
           updated_at = now()
     where c.id = p_id
       and c.tenant_id = v_tenant
    returning * into v_row;

    if v_row.id is null then
      return jsonb_build_object('success', false, 'message', 'Campanha não encontrada.');
    end if;
  end if;

  v_id := v_row.id;
  perform public.reconcile_campaign_deposits(v_tenant);
  select * into v_row from public.campaign_projects where id = v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'campaign', public.campaign_project_json(v_row));
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe uma campanha ativa/rascunho com estes centavos de referência.'
    );
end;
$$;

grant execute on function public.upsert_campaign_project(
  uuid, text, text, numeric, date, date, text, numeric, text, text, uuid
) to anon, authenticated;

create or replace function public.set_igreja_offerings_admin(
  p_tenant_id uuid,
  p_cnpj text,
  p_pix_institution text,
  p_pix_key text,
  p_pix_key_secundaria text default null,
  p_pix_institution_secundaria text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_cnpj text := nullif(trim(coalesce(p_cnpj, '')), '');
  v_inst text := nullif(trim(coalesce(p_pix_institution, '')), '');
  v_pix text := nullif(trim(coalesce(p_pix_key, '')), '');
  v_pix_2 text := nullif(trim(coalesce(p_pix_key_secundaria, '')), '');
  v_inst_2 text := nullif(trim(coalesce(p_pix_institution_secundaria, '')), '');
  v_id_1 uuid;
  v_id_2 uuid;
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

  update public.igrejas
     set cnpj = v_cnpj,
         updated_at = now()
   where id = p_tenant_id;

  select b.id into v_id_1
    from public.bank_accounts b
   where b.tenant_id = p_tenant_id
   order by b.sort_order, b.created_at
   limit 1;

  perform public.upsert_bank_account_admin(
    v_id_1,
    coalesce(v_inst, 'Conta 1'),
    v_inst,
    null, v_cnpj, null, null, null,
    v_pix,
    true,
    true,
    p_tenant_id
  );

  if v_pix_2 is not null or v_inst_2 is not null then
    select b.id into v_id_1
      from public.bank_accounts b
     where b.tenant_id = p_tenant_id
     order by b.sort_order, b.created_at
     limit 1;

    select b.id into v_id_2
      from public.bank_accounts b
     where b.tenant_id = p_tenant_id
       and b.id <> v_id_1
     order by b.sort_order, b.created_at
     limit 1;

    perform public.upsert_bank_account_admin(
      v_id_2,
      coalesce(v_inst_2, 'Conta 2'),
      v_inst_2,
      null, null, null, null, null,
      v_pix_2,
      false,
      true,
      p_tenant_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'cnpj', v_cnpj,
    'pix_institution', v_inst,
    'pix_key', v_pix,
    'pix_key_secundaria', v_pix_2,
    'pix_institution_secundaria', v_inst_2,
    'message', 'Dados de dízimos/ofertas atualizados.'
  );
end;
$$;

grant execute on function public.set_igreja_offerings_admin(uuid, text, text, text, text, text)
  to anon, authenticated;

drop function if exists public.list_admin_igrejas();

create or replace function public.list_admin_igrejas()
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
  mae_name text
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
    mae.name
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
-- Limpeza das chaves Pix em app_parameters (somente após a migração)
-- ---------------------------------------------------------------------------

delete from public.app_parameters
 where lower(trim(parameter)) in (
   'chave_pix',
   'chave_pix_secundaria',
   'nome_conta_pix_1',
   'nome_conta_pix_2',
   'chave_pix_padrao_ofertas'
 );

notify pgrst, 'reload schema';
