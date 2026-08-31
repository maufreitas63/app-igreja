-- =============================================================================
-- Recepção — inspeção da família do código + descarte de integrante
-- =============================================================================
-- Aplica: npx supabase db query --linked -f scripts/recepcao-inspect-family-matches.sql
-- =============================================================================

create or replace function public.inspect_recepcao_lote_family(p_lote_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_lote public.recepcao_cadastro_familiar_lote;
  v_family_code text;
  v_existing jsonb := '[]'::jsonb;
  v_incoming jsonb := '[]'::jsonb;
begin
  if p_lote_id is null then
    return jsonb_build_object('success', false, 'message', 'Informe o lote.');
  end if;

  select * into v_lote
    from public.recepcao_cadastro_familiar_lote l
   where l.id = p_lote_id
     and l.tenant_id = v_tenant
     and l.status = 'pending';

  if v_lote.id is null then
    return jsonb_build_object('success', false, 'message', 'Lote pendente não encontrado nesta igreja.');
  end if;

  v_family_code := upper(nullif(trim(coalesce(v_lote.detected_family_id, '')), ''));

  if v_family_code is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'birth_date', p.birth_date,
          'phone', p.phone,
          'family_id', v_family_code,
          'relationship', null
        )
        order by p.full_name
      ),
      '[]'::jsonb
    )
      into v_existing
      from public.profiles p
     where p.tenant_id = v_tenant
       and upper(nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')) = v_family_code
       and nullif(trim(coalesce(p.full_name, '')), '') is not null;
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'is_informant')::boolean desc, item ->> 'full_name'), '[]'::jsonb)
    into v_incoming
    from (
      select jsonb_build_object(
        'id', pend.id,
        'full_name', pend.full_name,
        'is_informant', pend.is_informant,
        'relationship', pend.relationship,
        'phone', pend.phone,
        'birth_date', pend.birth_date,
        'matches', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'profile_id', p.id,
              'full_name', p.full_name,
              'birth_date', p.birth_date,
              'phone', p.phone,
              'family_id', upper(nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')),
              'same_family',
                v_family_code is not null
                and upper(nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')) = v_family_code,
              'match_by_name', lower(trim(coalesce(p.full_name, ''))) = lower(trim(pend.full_name)),
              'match_by_birth',
                pend.birth_date is not null
                and pend.birth_date <> date '1900-01-01'
                and p.birth_date = pend.birth_date,
              'match_by_phone',
                length(public.normalize_phone_for_sync(coalesce(pend.phone, ''))) >= 10
                and public.normalize_phone_for_sync(p.phone)
                  = public.normalize_phone_for_sync(pend.phone)
            )
            order by
              case
                when v_family_code is not null
                     and upper(nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')) = v_family_code
                  then 0
                else 1
              end,
              p.full_name
          )
            from public.profiles p
           where p.tenant_id = v_tenant
             and nullif(trim(coalesce(p.full_name, '')), '') is not null
             and (
               lower(trim(coalesce(p.full_name, ''))) = lower(trim(pend.full_name))
               or (
                 pend.birth_date is not null
                 and pend.birth_date <> date '1900-01-01'
                 and p.birth_date = pend.birth_date
               )
               or (
                 length(public.normalize_phone_for_sync(coalesce(pend.phone, ''))) >= 10
                 and public.normalize_phone_for_sync(p.phone)
                   = public.normalize_phone_for_sync(pend.phone)
               )
             )
        ), '[]'::jsonb)
      ) as item
        from public.recepcao_cadastro_familiar pend
       where pend.tenant_id = v_tenant
         and pend.submission_id = p_lote_id
         and pend.status = 'pending'
    ) q;

  return jsonb_build_object(
    'success', true,
    'submission_id', v_lote.id,
    'detected_family_id', v_family_code,
    'existing_members', coalesce(v_existing, '[]'::jsonb),
    'incoming', coalesce(v_incoming, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.inspect_recepcao_lote_family(uuid) to anon, authenticated;

create or replace function public.reject_recepcao_cadastro_familiar_member(
  p_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row public.recepcao_cadastro_familiar;
  v_remaining int := 0;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Integrante descartado na triagem da Secretaria.');
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Informe o integrante.');
  end if;

  select * into v_row
    from public.recepcao_cadastro_familiar r
   where r.id = p_id
     and r.tenant_id = v_tenant
     and r.status = 'pending';

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Integrante pendente não encontrado nesta igreja.');
  end if;

  update public.recepcao_cadastro_familiar
     set status = 'rejected',
         processed_at = now(),
         process_message = v_reason
   where id = p_id
     and tenant_id = v_tenant;

  select count(*)::int
    into v_remaining
    from public.recepcao_cadastro_familiar
   where tenant_id = v_tenant
     and submission_id = v_row.submission_id
     and status = 'pending';

  update public.recepcao_cadastro_familiar_lote
     set member_count = v_remaining,
         status = case when v_remaining = 0 then 'rejected' else status end,
         processed_at = case when v_remaining = 0 then now() else processed_at end,
         process_message = case
           when v_remaining = 0 then v_reason
           else process_message
         end
   where tenant_id = v_tenant
     and id = v_row.submission_id;

  return jsonb_build_object(
    'success', true,
    'remaining_members', v_remaining,
    'lote_rejected', v_remaining = 0,
    'message',
      case
        when v_remaining = 0 then 'Integrante descartado. O lote ficou sem pendências e foi rejeitado.'
        else format('Integrante descartado. Restam %s na fila deste lote.', v_remaining)
      end
  );
end;
$$;

grant execute on function public.reject_recepcao_cadastro_familiar_member(uuid, text) to anon, authenticated;
