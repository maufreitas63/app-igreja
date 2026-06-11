-- Exclusão completa de usuário (profiles + referências em public e auth.users).
-- Uso: Manutenção → Cadastro de Usuário → Excluir usuário.
-- Execute no SQL Editor do Supabase após access-control-admin-rpc.sql
-- e register-member-atomic.sql (find_profile_id_for_member_sync).

drop function if exists public.excluir_usuario_completo(uuid, uuid);

create or replace function public.excluir_usuario_completo(
  p_target_profile_id uuid,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid;
  v_profile public.profiles%rowtype;
  v_auth_user_id uuid;
  v_phone_digits text;
  v_super_admin_count bigint;
  v_deleted_expense_reports integer := 0;
  v_deleted_pastoral integer := 0;
  v_deleted_members integer := 0;
  v_deleted_registrations integer := 0;
  v_fk record;
begin
  v_actor_id := coalesce(p_actor_profile_id, public.current_session_profile_id());

  if v_actor_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.is_super_admin_profile(v_actor_id) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas super administradores podem excluir usuários.'
    );
  end if;

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Usuário não informado.');
  end if;

  if p_target_profile_id = v_actor_id then
    return jsonb_build_object(
      'success', false,
      'message', 'Não é possível excluir o próprio usuário da sessão.'
    );
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where p.id = p_target_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Usuário não encontrado.');
  end if;

  if public.is_super_admin_profile(p_target_profile_id) then
    select count(*)
      into v_super_admin_count
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where ar.code = 'super_admin';

    if v_super_admin_count <= 1 then
      return jsonb_build_object(
        'success', false,
        'message', 'Não é possível excluir o único super administrador.'
      );
    end if;
  end if;

  v_auth_user_id := v_profile.auth_user_id;
  v_phone_digits := public.normalize_profile_phone(v_profile.phone);

  delete from public.expense_reports er
   where er.user_id = p_target_profile_id;
  get diagnostics v_deleted_expense_reports = row_count;

  delete from public.pastoral_requests pr
   where pr.profile_id = p_target_profile_id
      or (v_auth_user_id is not null and pr.user_id = v_auth_user_id)
      or (
        v_phone_digits is not null
        and v_phone_digits <> ''
        and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_phone_digits
      );
  get diagnostics v_deleted_pastoral = row_count;

  if nullif(trim(coalesce(v_profile.full_name, '')), '') is not null then
    delete from public.voluntarios_escala ve
     where lower(trim(ve.nome)) = lower(trim(v_profile.full_name));
  end if;

  delete from public.members m
   where public.find_profile_id_for_member_sync(m.phone, m.full_name) = p_target_profile_id;
  get diagnostics v_deleted_members = row_count;

  if v_phone_digits is not null and v_phone_digits <> '' then
    delete from public.profile_vehicles pv
     where public.normalize_profile_phone(pv.phone) = v_phone_digits
        or trim(coalesce(pv.phone, '')) = trim(coalesce(v_profile.phone, ''));
  end if;

  delete from public.event_registrations er
   where er.profile_id = p_target_profile_id;
  get diagnostics v_deleted_registrations = row_count;

  for v_fk in
    select
      nsp.nspname as schema_name,
      rel.relname as table_name,
      att.attname as column_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace fnsp on fnsp.oid = frel.relnamespace
    join unnest(con.conkey) with ordinality as ck(attnum, ord) on true
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = ck.attnum
     and not att.attisdropped
    where con.contype = 'f'
      and fnsp.nspname = 'public'
      and frel.relname = 'profiles'
      and nsp.nspname = 'public'
      and rel.relname <> 'profiles'
      and con.confdeltype in ('a', 'r')
  loop
    execute format(
      'delete from %I.%I where %I = $1',
      v_fk.schema_name,
      v_fk.table_name,
      v_fk.column_name
    )
    using p_target_profile_id;
  end loop;

  delete from public.profiles p
   where p.id = p_target_profile_id;

  if v_auth_user_id is not null then
    delete from auth.users u
     where u.id = v_auth_user_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    format(
      'Usuário %s excluído com sucesso.',
      coalesce(nullif(trim(v_profile.full_name), ''), p_target_profile_id::text)
    ),
    'profile_id', p_target_profile_id,
    'expense_reports_removed', v_deleted_expense_reports,
    'pastoral_requests_removed', v_deleted_pastoral,
    'members_removed', v_deleted_members,
    'event_registrations_removed', v_deleted_registrations
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.excluir_usuario_completo(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
