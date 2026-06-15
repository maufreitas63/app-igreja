-- Reparo: alinha profiles.family_id / codigo_membro com members (fonte canônica pós-recepção).
-- Execute após scripts/members-list-family-sync.sql.
--
--   select public.sync_profiles_family_id_from_members();
--   select public.repair_recepcao_processed_family_grouping();  -- opcional, lotes divergentes

create or replace function public.sync_profiles_family_id_from_members()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int := 0;
  v_row_count int;
begin
  perform set_config('app.skip_family_sync_trigger', 'on', true);

  update public.profiles p
     set family_id = resolved.family_id,
         codigo_membro = resolved.family_id,
         updated_at = now()
    from (
      select
        p2.id as profile_id,
        public.resolve_member_family_id_for_directory_person(p2.phone, trim(p2.full_name)) as family_id
      from public.profiles p2
      where p2.full_name is not null
        and trim(p2.full_name) <> ''
    ) resolved
   where p.id = resolved.profile_id
     and resolved.family_id is not null
     and public.profile_directory_family_code(p.family_id, p.codigo_membro) is distinct from resolved.family_id;

  get diagnostics v_row_count = row_count;
  v_updated := v_updated + v_row_count;

  update public.members m
     set accepted = true
    from public.recepcao_cadastro_familiar r
   where r.status = 'processed'
     and r.applied_member_id = m.id
     and coalesce(m.accepted, false) is false;

  get diagnostics v_row_count = row_count;
  v_updated := v_updated + v_row_count;

  perform set_config('app.skip_family_sync_trigger', 'off', true);

  return jsonb_build_object(
    'success', true,
    'rows_updated', v_updated
  );
exception
  when others then
    perform set_config('app.skip_family_sync_trigger', 'off', true);
    return jsonb_build_object(
      'success', false,
      'message', coalesce(sqlerrm, 'Falha ao sincronizar family_id em profiles.')
    );
end;
$$;

grant execute on function public.sync_profiles_family_id_from_members() to authenticated;

-- Descomente para executar imediatamente:
-- select public.sync_profiles_family_id_from_members() as sync_result;

notify pgrst, 'reload schema';
