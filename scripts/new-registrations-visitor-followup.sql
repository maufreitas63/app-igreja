-- =============================================================================
-- Novos cadastros + auto Régua de Acolhimento (somente visitante efetivo)
-- =============================================================================
-- 1) Inbox de novos perfis (profiles.created_at) com "marcar como visto"
-- 2) Ao concluir dados, se o perfil for efetivamente visitante (tem visitantes
--    e NÃO tem congregado/membro), inicia a régua via initialize_visitor_followup_regua
-- 3) Se for promovido (ex.: /register → congregado), interrompe régua automática
--    (origem sem recepcao_cadastro_familiar_id)
-- Aplica: npx supabase db query --linked -f scripts/new-registrations-visitor-followup.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Inbox
-- ---------------------------------------------------------------------------

create table if not exists public.new_registration_inbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  registered_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by_profile_id uuid null references public.profiles (id) on delete set null,
  followup_id uuid null references public.visitor_followup (id) on delete set null,
  source text not null default 'profile_insert',
  created_at timestamptz not null default now(),
  constraint new_registration_inbox_profile_uq unique (profile_id)
);

create index if not exists new_registration_inbox_tenant_registered_idx
  on public.new_registration_inbox (tenant_id, registered_at desc);

create index if not exists new_registration_inbox_unreviewed_idx
  on public.new_registration_inbox (tenant_id, registered_at desc)
  where reviewed_at is null;

comment on table public.new_registration_inbox is
  'Novos cadastros da instância — reconhecimento operacional independente do papel.';

alter table public.new_registration_inbox enable row level security;

drop policy if exists new_registration_inbox_deny_direct on public.new_registration_inbox;
create policy new_registration_inbox_deny_direct
  on public.new_registration_inbox for all using (false) with check (false);

revoke all on public.new_registration_inbox from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------

create or replace function public.profile_is_effectively_visitor(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    p_profile_id is not null
    and public.profile_has_role_code(p_profile_id, 'visitantes')
    and not public.profile_has_role_code(p_profile_id, 'congregado')
    and not public.profile_has_role_code(p_profile_id, 'member')
    and not public.profile_has_role_code(p_profile_id, 'super_admin');
$$;

create or replace function public.enqueue_new_registration_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if public.profile_is_tstmax_test_profile(new.id) then
    return new;
  end if;

  insert into public.new_registration_inbox (
    tenant_id,
    profile_id,
    registered_at,
    source
  ) values (
    new.tenant_id,
    new.id,
    coalesce(new.created_at, now()),
    'profile_insert'
  )
  on conflict (profile_id) do update
    set tenant_id = coalesce(excluded.tenant_id, public.new_registration_inbox.tenant_id);

  return new;
end;
$$;

drop trigger if exists trg_enqueue_new_registration_inbox on public.profiles;
create trigger trg_enqueue_new_registration_inbox
  after insert on public.profiles
  for each row
  execute function public.enqueue_new_registration_inbox();

-- Mantém tenant_id da inbox quando o perfil recebe tenant depois do insert.
create or replace function public.sync_new_registration_inbox_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.tenant_id is distinct from old.tenant_id and new.tenant_id is not null then
    update public.new_registration_inbox
       set tenant_id = new.tenant_id
     where profile_id = new.id
       and (tenant_id is null or tenant_id is distinct from new.tenant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_new_registration_inbox_tenant on public.profiles;
create trigger trg_sync_new_registration_inbox_tenant
  after update of tenant_id on public.profiles
  for each row
  when (new.tenant_id is distinct from old.tenant_id)
  execute function public.sync_new_registration_inbox_tenant();

create or replace function public.interrupt_auto_visitor_followup_if_promoted(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_profile_id is null then
    return;
  end if;

  if public.profile_is_effectively_visitor(p_profile_id) then
    return;
  end if;

  update public.visitor_followup f
     set status = 'Interrompido',
         updated_at = now()
   where f.visitor_id = p_profile_id
     and f.status = 'Ativo'
     and f.recepcao_cadastro_familiar_id is null;

  update public.task_alerts t
     set status = 'Concluído',
         completed_at = coalesce(t.completed_at, now())
   where t.visitor_id = p_profile_id
     and t.status = 'Pendente'
     and exists (
       select 1
         from public.visitor_followup f
        where f.id = t.followup_id
          and f.visitor_id = p_profile_id
          and f.recepcao_cadastro_familiar_id is null
          and f.status = 'Interrompido'
     );
end;
$$;

create or replace function public.maybe_start_visitor_followup_for_new_registration(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_phone text;
  v_name text;
  v_followup_id uuid;
  v_inbox_id uuid;
begin
  if p_profile_id is null then
    return null;
  end if;

  if coalesce(current_setting('app.skip_auto_visitor_followup', true), '') = '1' then
    return null;
  end if;

  if public.profile_is_tstmax_test_profile(p_profile_id) then
    return null;
  end if;

  -- Só cadastros novos (inbox). Demoção antiga de papel não entra.
  select i.id, coalesce(i.tenant_id, p.tenant_id)
    into v_inbox_id, v_tenant
    from public.new_registration_inbox i
    join public.profiles p on p.id = i.profile_id
   where i.profile_id = p_profile_id
   limit 1;

  if v_inbox_id is null or v_tenant is null then
    return null;
  end if;

  if not public.profile_is_effectively_visitor(p_profile_id) then
    perform public.interrupt_auto_visitor_followup_if_promoted(p_profile_id);
    return null;
  end if;

  -- Aguarda conclusão mínima do cadastro (nome + nascimento).
  if public.profile_pending_self_registration(p_profile_id) then
    return null;
  end if;

  select
    nullif(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), ''),
    trim(coalesce(p.full_name, ''))
    into v_phone, v_name
    from public.profiles p
   where p.id = p_profile_id;

  if v_phone is null or length(v_phone) < 10 then
    return null;
  end if;

  if v_name = '' or lower(v_name) = 'visitante' then
    return null;
  end if;

  begin
    v_followup_id := public.initialize_visitor_followup_regua(
      v_tenant,
      p_profile_id,
      null
    );
  exception
    when others then
      raise warning 'Auto-régua (novo cadastro) falhou para %: %', p_profile_id, sqlerrm;
      return null;
  end;

  if v_followup_id is not null then
    update public.new_registration_inbox
       set followup_id = v_followup_id,
           tenant_id = coalesce(tenant_id, v_tenant)
     where id = v_inbox_id;
  end if;

  return v_followup_id;
end;
$$;

-- Dispara após dados cadastrais mínimos.
create or replace function public.trg_maybe_visitor_followup_on_profile_data()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.maybe_start_visitor_followup_for_new_registration(new.id);
  return new;
end;
$$;

drop trigger if exists trg_maybe_visitor_followup_on_profile_data on public.profiles;
create trigger trg_maybe_visitor_followup_on_profile_data
  after update of full_name, birth_date, phone, cep on public.profiles
  for each row
  execute function public.trg_maybe_visitor_followup_on_profile_data();

-- Dispara quando o conjunto de papéis muda (ex.: promove a congregado).
create or replace function public.trg_maybe_visitor_followup_on_roles()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile_id uuid := coalesce(new.profile_id, old.profile_id);
begin
  if v_profile_id is null then
    return coalesce(new, old);
  end if;

  if public.profile_is_effectively_visitor(v_profile_id) then
    perform public.maybe_start_visitor_followup_for_new_registration(v_profile_id);
  else
    perform public.interrupt_auto_visitor_followup_if_promoted(v_profile_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_maybe_visitor_followup_on_roles on public.profile_access_roles;
create trigger trg_maybe_visitor_followup_on_roles
  after insert or delete or update on public.profile_access_roles
  for each row
  execute function public.trg_maybe_visitor_followup_on_roles();

-- ---------------------------------------------------------------------------
-- 3) RPCs da inbox (equipe da régua / recepção)
-- ---------------------------------------------------------------------------

create or replace function public.list_new_registrations(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_days int := greatest(1, least(coalesce(p_days, 30), 180));
begin
  if not public.session_can_manage_visitor_followup_welcome() then
    return jsonb_build_object(
      'success', false,
      'message', 'Sem permissão para listar novos cadastros.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'registrations', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.registered_at desc)
      from (
        select
          i.id,
          i.profile_id,
          coalesce(nullif(trim(p.full_name), ''), 'Sem nome') as full_name,
          p.phone,
          i.registered_at,
          i.reviewed_at,
          i.followup_id,
          public.profile_is_effectively_visitor(p.id) as is_visitor,
          exists (
            select 1
              from public.profile_access_roles par
              join public.access_roles ar on ar.id = par.role_id
             where par.profile_id = p.id
               and ar.code = 'congregado'
          ) as is_congregado,
          exists (
            select 1
              from public.profile_access_roles par
              join public.access_roles ar on ar.id = par.role_id
             where par.profile_id = p.id
               and ar.code = 'member'
          ) as is_member,
          exists (
            select 1
              from public.visitor_followup f
             where f.visitor_id = p.id
               and f.tenant_id = v_tenant
               and f.status = 'Ativo'
          ) as followup_active,
          (
            select f.status
              from public.visitor_followup f
             where f.visitor_id = p.id
               and f.tenant_id = v_tenant
             order by f.created_at desc
             limit 1
          ) as followup_status
        from public.new_registration_inbox i
        join public.profiles p on p.id = i.profile_id
       where coalesce(i.tenant_id, p.tenant_id) = v_tenant
         and i.registered_at >= (timezone('America/Sao_Paulo', now()) - make_interval(days => v_days))
         and not public.profile_is_tstmax_test_profile(p.id)
         -- Visto + fora da régua: sai da lista operacional.
         and (
           i.reviewed_at is null
           or exists (
             select 1
               from public.visitor_followup f
              where f.visitor_id = p.id
                and f.tenant_id = v_tenant
                and f.status = 'Ativo'
           )
         )
       order by i.registered_at desc
       limit 200
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mark_new_registration_reviewed(p_inbox_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_row public.new_registration_inbox%rowtype;
begin
  if not public.session_can_manage_visitor_followup_welcome() then
    return jsonb_build_object(
      'success', false,
      'message', 'Sem permissão para marcar cadastro como visto.'
    );
  end if;

  if p_inbox_id is null then
    return jsonb_build_object('success', false, 'message', 'Registro não informado.');
  end if;

  select i.*
    into v_row
    from public.new_registration_inbox i
    join public.profiles p on p.id = i.profile_id
   where i.id = p_inbox_id
     and coalesce(i.tenant_id, p.tenant_id) = v_tenant
   limit 1;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Cadastro não encontrado nesta igreja.');
  end if;

  update public.new_registration_inbox
     set reviewed_at = now(),
         reviewed_by_profile_id = v_actor
   where id = v_row.id;

  return jsonb_build_object('success', true, 'id', v_row.id);
end;
$$;

grant execute on function public.profile_is_effectively_visitor(uuid) to anon, authenticated;
grant execute on function public.maybe_start_visitor_followup_for_new_registration(uuid) to anon, authenticated;
grant execute on function public.interrupt_auto_visitor_followup_if_promoted(uuid) to anon, authenticated;
grant execute on function public.list_new_registrations(integer) to anon, authenticated;
grant execute on function public.mark_new_registration_reviewed(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) complete_initial: evita disparo intermediário; decide no final
-- ---------------------------------------------------------------------------

create or replace function public.complete_initial_profile_registration(
  p_profile_id uuid,
  p_full_name text,
  p_birth_date date,
  p_phone text,
  p_cep text default null,
  p_selfie_url text default null,
  p_lgpd_accepted boolean default null,
  p_family_id text default null,
  p_codigo_membro text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_profile public.profiles%rowtype;
  v_session_profile_id uuid;
  v_full_name text;
  v_role_id uuid;
  v_session_token text;
begin
  perform set_config('app.skip_auto_visitor_followup', '1', true);

  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  v_full_name := trim(coalesce(p_full_name, ''));

  if length(v_full_name) <= 3 then
    raise exception 'Informe o nome completo.';
  end if;

  if lower(v_full_name) = 'visitante' then
    raise exception 'Substitua o nome temporário de visitante pelo seu nome completo.';
  end if;

  if p_birth_date is null then
    raise exception 'Informe a data de nascimento.';
  end if;

  v_session_profile_id := public.current_session_profile_id();

  if v_session_profile_id is not null and v_session_profile_id <> p_profile_id then
    raise exception 'Sessão não corresponde ao perfil informado.';
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where p.id = p_profile_id
     and (p.tenant_id = v_tenant or p.tenant_id is null);

  if v_profile.id is null then
    raise exception 'Perfil não encontrado.';
  end if;

  if not public.profile_pending_self_registration(p_profile_id) then
    raise exception 'Este perfil já concluiu o cadastro inicial.';
  end if;

  if trim(coalesce(p_phone, '')) <> ''
     and public.normalize_profile_phone(v_profile.phone) is distinct from public.normalize_profile_phone(p_phone) then
    raise exception 'Telefone não confere com o perfil.';
  end if;

  begin
    update public.profiles p
       set full_name = v_full_name,
           birth_date = p_birth_date,
           cep = nullif(trim(coalesce(p_cep, '')), ''),
           selfie_url = nullif(trim(coalesce(p_selfie_url, '')), ''),
           lgpd_accepted = p_lgpd_accepted,
           family_id = nullif(trim(coalesce(p_family_id, '')), ''),
           codigo_membro = nullif(trim(coalesce(p_codigo_membro, '')), ''),
           tenant_id = v_tenant,
           updated_at = now()
     where p.id = p_profile_id
     returning p.* into v_profile;
  exception
    when undefined_column then
      update public.profiles p
         set full_name = v_full_name,
             birth_date = p_birth_date,
             cep = nullif(trim(coalesce(p_cep, '')), ''),
             selfie_url = nullif(trim(coalesce(p_selfie_url, '')), ''),
             lgpd_accepted = p_lgpd_accepted,
             codigo_membro = nullif(trim(coalesce(p_codigo_membro, '')), ''),
             updated_at = now()
       where p.id = p_profile_id
       returning p.* into v_profile;
  end;

  insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
  values (p_profile_id, v_tenant, true, true)
  on conflict (profile_id, tenant_id) do update
    set is_active = true,
        is_primary = true,
        updated_at = now();

  if not exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
       and par.tenant_id = v_tenant
  )
  and not (
    trim(coalesce(v_profile.full_name, '')) ilike 'TstMax%'
    or coalesce(v_profile.family_id, '') like 'TstMax%'
    or coalesce(v_profile.codigo_membro, '') like 'TstMax%'
    or lower(trim(coalesce(v_profile.email, ''))) like '%@tstmax.demo'
  ) then
    select ar.id
      into v_role_id
      from public.access_roles ar
     where ar.code = 'congregado'
     limit 1;

    if v_role_id is not null then
      insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id, tenant_id)
      values (p_profile_id, v_role_id, p_profile_id, v_tenant)
      on conflict (profile_id, role_id) do nothing;
    end if;
  end if;

  perform set_config('app.skip_auto_visitor_followup', '', true);

  if public.profile_is_effectively_visitor(p_profile_id) then
    perform public.maybe_start_visitor_followup_for_new_registration(p_profile_id);
  else
    perform public.interrupt_auto_visitor_followup_if_promoted(p_profile_id);
  end if;

  v_session_token := public.issue_profile_session(p_profile_id);

  return jsonb_build_object(
    'success', true,
    'profile', to_jsonb(v_profile),
    'session_token', v_session_token
  );
exception
  when others then
    perform set_config('app.skip_auto_visitor_followup', '', true);
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.complete_initial_profile_registration(
  uuid, text, date, text, text, text, boolean, text, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Backfill inbox (últimos 30 dias)
-- ---------------------------------------------------------------------------

insert into public.new_registration_inbox (tenant_id, profile_id, registered_at, source)
select p.tenant_id, p.id, coalesce(p.created_at, now()), 'backfill'
  from public.profiles p
 where p.created_at >= (timezone('America/Sao_Paulo', now()) - interval '30 days')
   and not public.profile_is_tstmax_test_profile(p.id)
on conflict (profile_id) do nothing;

-- Inicia régua para visitantes efetivos já concluídos (backfill pontual).
do $$
declare
  r record;
begin
  for r in
    select i.profile_id
      from public.new_registration_inbox i
      join public.profiles p on p.id = i.profile_id
     where i.followup_id is null
       and i.registered_at >= (timezone('America/Sao_Paulo', now()) - interval '30 days')
       and public.profile_is_effectively_visitor(p.id)
       and not public.profile_pending_self_registration(p.id)
  loop
    perform public.maybe_start_visitor_followup_for_new_registration(r.profile_id);
  end loop;
end;
$$;
