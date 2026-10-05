-- =============================================================================
-- Sticker da Home — novos membros a admitir
-- =============================================================================
-- Papéis: super_admin / secretaria / pastoral.
-- Visibilidade:
--   - super_admin: sempre visível
--   - secretaria / pastoral: só se houver inbox sem visto (30 dias) ou
--     lote pendente na Recepção Familiar
-- Aplica: npx supabase db query --linked -f scripts/home-admission-sticker.sql
-- =============================================================================

create or replace function public.session_can_see_home_admission_sticker(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    p_profile_id is not null
    and (
      public.is_super_admin_profile(p_profile_id)
      or public.profile_has_role_code(p_profile_id, 'secretaria')
      or public.profile_has_role_code(p_profile_id, 'pastoral')
    );
$$;

create or replace function public.session_home_admission_sticker_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_has_new boolean := false;
  v_has_reception boolean := false;
  v_is_super_admin boolean := false;
begin
  if v_actor is null then
    return jsonb_build_object(
      'success', true,
      'visible', false,
      'has_new_registrations', false,
      'has_reception_pending', false
    );
  end if;

  if not public.session_can_see_home_admission_sticker(v_actor) then
    return jsonb_build_object(
      'success', true,
      'visible', false,
      'has_new_registrations', false,
      'has_reception_pending', false
    );
  end if;

  v_is_super_admin := public.is_super_admin_profile(v_actor);

  begin
    v_tenant := public.require_session_tenant_id();
  exception
    when others then
      -- Super Admin mantém o sticker mesmo sem tenant resolvido.
      return jsonb_build_object(
        'success', true,
        'visible', v_is_super_admin,
        'has_new_registrations', false,
        'has_reception_pending', false
      );
  end;

  -- Alinha com Mudança de Papéis: só visitante efetivo conta como pendência de admissão.
  select exists (
    select 1
      from public.new_registration_inbox i
      join public.profiles p on p.id = i.profile_id
     where coalesce(i.tenant_id, p.tenant_id) = v_tenant
       and i.reviewed_at is null
       and i.registered_at >= (timezone('America/Sao_Paulo', now()) - interval '30 days')
       and not public.profile_is_tstmax_test_profile(p.id)
       and public.profile_is_effectively_visitor(p.id)
  )
    into v_has_new;

  select exists (
    select 1
      from public.recepcao_cadastro_familiar_lote l
     where l.tenant_id = v_tenant
       and l.status = 'pending'
  )
    into v_has_reception;

  return jsonb_build_object(
    'success', true,
    'visible', (v_is_super_admin or v_has_new or v_has_reception),
    'has_new_registrations', v_has_new,
    'has_reception_pending', v_has_reception
  );
end;
$$;

grant execute on function public.session_can_see_home_admission_sticker(uuid) to anon, authenticated;
grant execute on function public.session_home_admission_sticker_state() to anon, authenticated;
