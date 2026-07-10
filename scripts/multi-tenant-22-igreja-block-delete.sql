-- =============================================================================
-- Multi-tenancy 22 — bloquear acesso e excluir instância
-- =============================================================================
-- Bloquear: igrejas.is_active = false → usuários não entram / não selecionam.
-- Super-admin ainda vê bloqueadas em list_admin_igrejas para desbloquear.
-- Excluir: apaga dados com tenant_id da instância e a linha em igrejas.
-- IBN (tenant padrão) não pode ser bloqueada nem excluída.
--
-- Execute no SQL Editor do Supabase.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- list_admin_igrejas — super-admin vê ativas e bloqueadas
-- ---------------------------------------------------------------------------
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
  is_active boolean,
  is_primary boolean,
  is_linked boolean
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
  if v_profile_id is null then
    return;
  end if;

  if not public.profile_has_super_admin_role(v_profile_id) then
    return;
  end if;

  -- Subquery evita conflito OUT (id/is_active/…) com colunas no RETURN QUERY.
  return query
  select
    q.id,
    q.code,
    q.name,
    q.logo_url,
    q.website_url,
    q.instagram_url,
    q.youtube_url,
    q.cnpj,
    q.pix_institution,
    q.pix_key,
    q.is_active,
    q.is_primary,
    q.is_linked
  from (
    select
      i.id,
      i.code,
      i.name,
      nullif(trim(i.logo_url), '') as logo_url,
      nullif(trim(i.website_url), '') as website_url,
      nullif(trim(i.instagram_url), '') as instagram_url,
      nullif(trim(i.youtube_url), '') as youtube_url,
      nullif(trim(i.cnpj), '') as cnpj,
      nullif(trim(i.pix_institution), '') as pix_institution,
      nullif(trim(i.pix_key), '') as pix_key,
      i.is_active,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked
    from public.igrejas i
    left join public.profile_igreja_vinculos v
      on v.tenant_id = i.id
     and v.profile_id = v_profile_id
     and v.is_active = true
  ) q
  order by q.is_active desc, q.is_primary desc, q.name asc;
end;
$$;

grant execute on function public.list_admin_igrejas() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_igreja_active_admin — bloquear / desbloquear
-- ---------------------------------------------------------------------------
create or replace function public.set_igreja_active_admin(
  p_tenant_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_code text;
  v_name text;
  v_default uuid := public.resolve_default_tenant_id();
  v_fallback uuid;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;

  if p_tenant_id is null or p_is_active is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  select i.code, i.name
    into v_code, v_name
    from public.igrejas i
   where i.id = p_tenant_id;

  if v_code is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  if p_tenant_id = v_default or upper(trim(v_code)) = 'IBN' then
    return jsonb_build_object(
      'success', false,
      'message', 'A instância padrão (IBN) não pode ser bloqueada.'
    );
  end if;

  update public.igrejas
     set is_active = p_is_active,
         updated_at = now()
   where id = p_tenant_id;

  -- Se bloqueou, tira primary dos vínculos e aponta quem estava nela para outra ativa
  if not p_is_active then
    update public.profile_igreja_vinculos
       set is_primary = false,
           updated_at = now()
     where tenant_id = p_tenant_id
       and is_primary = true;

    select i.id
      into v_fallback
      from public.igrejas i
     where i.is_active = true
       and i.id is distinct from p_tenant_id
     order by case when i.id = v_default then 0 else 1 end, i.name
     limit 1;

    if v_fallback is not null then
      insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
      select distinct v.profile_id, v_fallback, true, true
        from public.profile_igreja_vinculos v
       where v.tenant_id = p_tenant_id
         and v.is_active = true
         and not exists (
           select 1
             from public.profile_igreja_vinculos x
            where x.profile_id = v.profile_id
              and x.is_primary = true
              and x.is_active = true
         )
      on conflict (profile_id, tenant_id) do update
        set is_primary = true,
            is_active = true,
            updated_at = now();
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'code', v_code,
    'name', v_name,
    'is_active', p_is_active,
    'message',
      case
        when p_is_active then 'Acesso à instância liberado.'
        else 'Acesso à instância bloqueado para os usuários.'
      end
  );
end;
$$;

grant execute on function public.set_igreja_active_admin(uuid, boolean)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- delete_igreja_admin — exclui instância + dados dependentes (tenant_id)
-- ---------------------------------------------------------------------------
create or replace function public.delete_igreja_admin(
  p_tenant_id uuid,
  p_confirm_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_code text;
  v_name text;
  v_default uuid := public.resolve_default_tenant_id();
  v_confirm text := upper(trim(coalesce(p_confirm_code, '')));
  r record;
  v_deleted_tables int := 0;
  v_sql text;
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

  select i.code, i.name
    into v_code, v_name
    from public.igrejas i
   where i.id = p_tenant_id;

  if v_code is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  if p_tenant_id = v_default or upper(trim(v_code)) = 'IBN' then
    return jsonb_build_object(
      'success', false,
      'message', 'A instância padrão (IBN) não pode ser excluída.'
    );
  end if;

  if v_confirm is distinct from upper(trim(v_code)) then
    return jsonb_build_object(
      'success', false,
      'message', 'Confirmação inválida. Digite o código da instância (' || v_code || ') para excluir.'
    );
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  -- Perfis: não apaga pessoas; move tenant_id para o padrão se apontavam para esta igreja
  if to_regclass('public.profiles') is not null and v_default is not null then
    update public.profiles
       set tenant_id = v_default
     where tenant_id = p_tenant_id;
  end if;

  -- Apaga linhas em tabelas públicas com coluna tenant_id (exceto igrejas/profiles)
  for r in
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
     where n.nspname = 'public'
       and c.relkind = 'r'
       and a.attname = 'tenant_id'
       and not a.attisdropped
       and c.relname not in ('igrejas', 'profiles')
     order by
       case c.relname
         when 'profile_igreja_vinculos' then 900
         else 100
       end,
       c.relname
  loop
    begin
      v_sql := format('delete from public.%I where tenant_id = $1', r.table_name);
      execute v_sql using p_tenant_id;
      v_deleted_tables := v_deleted_tables + 1;
    exception
      when foreign_key_violation then
        -- tenta de novo no fim; se falhar, propaga
        null;
      when undefined_table then
        null;
      when undefined_column then
        null;
    end;
  end loop;

  -- Segunda passagem para FKs entre tabelas tenant
  for r in
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
     where n.nspname = 'public'
       and c.relkind = 'r'
       and a.attname = 'tenant_id'
       and not a.attisdropped
       and c.relname not in ('igrejas', 'profiles')
     order by c.relname
  loop
    begin
      execute format('delete from public.%I where tenant_id = $1', r.table_name)
        using p_tenant_id;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          left(
            'Falha ao limpar ' || r.table_name || ': ' || sqlerrm
              || '. Bloqueie a instância se a exclusão não for possível agora.',
            280
          )
        );
    end;
  end loop;

  delete from public.profile_igreja_vinculos where tenant_id = p_tenant_id;

  delete from public.igrejas where id = p_tenant_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Não foi possível excluir a igreja.');
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'code', v_code,
    'name', v_name,
    'tables_cleared', v_deleted_tables,
    'message', 'Instância ' || v_code || ' e dados dependentes foram excluídos.'
  );
exception
  when foreign_key_violation then
    return jsonb_build_object(
      'success', false,
      'message',
      left(
        'Há vínculos que impedem a exclusão: ' || sqlerrm
          || '. Você pode bloquear o acesso em vez de excluir.',
        280
      )
    );
  when others then
    return jsonb_build_object(
      'success', false,
      'message', left('Falha ao excluir instância: ' || sqlerrm, 280)
    );
end;
$$;

grant execute on function public.delete_igreja_admin(uuid, text)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
