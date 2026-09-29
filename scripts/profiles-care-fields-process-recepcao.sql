CREATE OR REPLACE FUNCTION public.process_recepcao_cadastro_familiar_batch(p_submission_ids uuid[] DEFAULT NULL::uuid[], p_actor_profile_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_submission record;
  v_member record;
  v_family_id text;
  v_processed_submissions int := 0;
  v_processed_members int := 0;
  v_skipped_conflicts int := 0;
  v_messages text[] := array[]::text[];
  v_apply_profile_id uuid;
  v_apply_member_id uuid;
  v_existing_profile_name text;
  v_existing_member_name text;
  v_address_process_message text;
  v_block_reason text;
begin
  for v_submission in
    select l.*
      from public.recepcao_cadastro_familiar_lote l
     where l.tenant_id = v_tenant
       and l.status = 'pending'
       and (
         p_submission_ids is null
         or cardinality(p_submission_ids) = 0
         or l.id = any (p_submission_ids)
       )
     order by l.created_at
  loop
    v_block_reason := public.recepcao_lote_process_block_reason(v_submission.id);

    if v_block_reason is not null then
      v_skipped_conflicts := v_skipped_conflicts + 1;
      v_messages := array_append(v_messages, v_block_reason);
      continue;
    end if;

    v_family_id := public.resolve_recepcao_lote_family_id(v_submission.id);

    if v_family_id is null then
      v_family_id := public.reserve_next_family_id();
    end if;

    perform set_config('app.skip_family_sync_trigger', 'on', true);

    for v_member in
      select *
        from public.recepcao_cadastro_familiar r
       where r.tenant_id = v_tenant
         and r.submission_id = v_submission.id
         and r.status = 'pending'
       order by r.is_informant desc, r.created_at
    loop
      v_apply_profile_id := v_member.matched_profile_id;
      v_apply_member_id := v_member.matched_member_id;

      if public.recepcao_phone_claimed_by_other_profile(v_member.phone, v_member.full_name) then
        v_apply_profile_id := null;
        v_apply_member_id := null;
      end if;

      if v_apply_profile_id is not null then
        select nullif(trim(coalesce(p.full_name, '')), '')
          into v_existing_profile_name
          from public.profiles p
         where p.tenant_id = v_tenant
           and p.id = v_apply_profile_id;

        if v_existing_profile_name is null
           or lower(v_existing_profile_name) <> lower(trim(v_member.full_name)) then
          v_apply_profile_id := null;
        end if;
      end if;

      if v_apply_member_id is not null then
        select nullif(trim(coalesce(m.full_name, '')), '')
          into v_existing_member_name
          from public.members m
         where m.tenant_id = v_tenant
           and m.id = v_apply_member_id;

        if v_existing_member_name is null
           or lower(v_existing_member_name) <> lower(trim(v_member.full_name)) then
          v_apply_member_id := null;
        end if;
      end if;

      if v_apply_profile_id is not null then
        update public.profiles p
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               phone = coalesce(
                 public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
                 p.phone
               ),
               family_id = v_family_id,
               codigo_membro = v_family_id,
               medical_food_alerts = coalesce(v_member.medical_food_alerts, p.medical_food_alerts),
               additional_care_notes = coalesce(v_member.additional_care_notes, p.additional_care_notes),
               special_needs = coalesce(v_member.special_needs, p.special_needs),
               is_active = false
         where p.id = v_apply_profile_id;
      else
        insert into public.profiles (
          full_name,
          birth_date,
          phone,
          family_id,
          codigo_membro,
          medical_food_alerts,
          additional_care_notes,
          special_needs,
          is_active,
          tenant_id
        ) values (
          v_member.full_name,
          v_member.birth_date,
          public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
          v_family_id,
          v_family_id,
          v_member.medical_food_alerts,
          v_member.additional_care_notes,
          v_member.special_needs,
          false,
          v_tenant
        )
        returning id into v_apply_profile_id;
      end if;

      v_address_process_message := null;

      if v_apply_profile_id is not null
         and (
           nullif(trim(coalesce(v_member.cep, '')), '') is not null
           or coalesce(
                nullif(trim(coalesce(v_member.address_street, '')), ''),
                nullif(trim(coalesce(v_member.address_city, '')), '')
              ) is not null
         ) then
        v_address_process_message := public.apply_recepcao_address_to_profile(
          v_apply_profile_id,
          v_member.cep,
          v_member.address_street,
          v_member.address_neighborhood,
          v_member.address_city,
          v_member.address_state,
          v_member.address_number,
          v_member.address_complement
        );
      end if;

      if v_apply_member_id is not null then
        update public.members m
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               marriage_date = coalesce(v_member.marriage_date, m.marriage_date),
               phone = coalesce(
                 public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
                 m.phone
               ),
               relationship = v_member.relationship,
               family_id = v_family_id,
               accepted = true
         where m.id = v_apply_member_id;
      else
        insert into public.members (
          full_name,
          birth_date,
          marriage_date,
          phone,
          relationship,
          family_id,
          accepted,
          tenant_id
        ) values (
          v_member.full_name,
          v_member.birth_date,
          v_member.marriage_date,
          public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
          v_member.relationship,
          v_family_id,
          true,
          v_tenant
        )
        returning id into v_apply_member_id;
      end if;

      update public.recepcao_cadastro_familiar
         set status = 'processed',
             applied_family_id = v_family_id,
             applied_profile_id = v_apply_profile_id,
             applied_member_id = v_apply_member_id,
             processed_at = now(),
             process_message = coalesce(
               v_address_process_message,
               'Gravado em profiles e members.'
             )
       where tenant_id = v_tenant
         and id = v_member.id;

      v_processed_members := v_processed_members + 1;
    end loop;

    perform set_config('app.skip_family_sync_trigger', 'off', true);

    perform public.finalize_recepcao_lote_family_assignments(v_submission.id, v_family_id);

    update public.recepcao_cadastro_familiar_lote
       set status = 'processed',
           detected_family_id = v_family_id,
           processed_at = now(),
           process_message = format('Processado por lote. family_id=%s', v_family_id)
     where tenant_id = v_tenant
       and id = v_submission.id;

    v_processed_submissions := v_processed_submissions + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'processed_submissions', v_processed_submissions,
    'processed_members', v_processed_members,
    'skipped_conflicts', v_skipped_conflicts,
    'messages', v_messages
  );
exception
  when others then
    perform set_config('app.skip_family_sync_trigger', 'off', true);
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'N├úo foi poss├¡vel processar a recep├º├úo em lote.')
    );
end;
$function$

