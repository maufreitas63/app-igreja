-- =============================================================================
-- Totem: celular pode se repetir entre instâncias (login já é por tenant)
-- =============================================================================
-- Sintoma: ao editar IBN/IBS, erro «Este celular já é o totem da instância IBEP»
-- mesmo com o número correto da própria igreja — a checagem era global.
-- verify_totem_login usa current_session_tenant_id(), então o mesmo aparelho
-- pode ser totem em mais de uma igreja.
-- Aplica: npx supabase db query --linked -f scripts/igreja-totem-allow-shared-phone.sql
-- =============================================================================

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

  -- Sem unicidade global: o totem é validado por igreja na sessão (verify_totem_login).

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

notify pgrst, 'reload schema';
