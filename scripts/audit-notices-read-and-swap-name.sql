-- Avisos lidos (troca/mural/pastoral) e match de nome da troca alinhado à UI.
-- Aplica: npx supabase db query --linked -f scripts/audit-notices-read-and-swap-name.sql

create or replace function public.scale_swap_volunteer_id_for_profile(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_tipo_escala_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_id uuid;
  v_parts text[];
  v_short text;
begin
  select trim(regexp_replace(coalesce(p.full_name, ''), '\s+', ' ', 'g'))
    into v_name
    from public.profiles p
   where p.id = p_profile_id
     and p.tenant_id = p_tenant_id;

  if v_name is null or v_name = '' then
    return null;
  end if;

  select ve.id
    into v_id
    from public.voluntarios_escala ve
   where ve.tenant_id = p_tenant_id
     and ve.tipo_escala_id = p_tipo_escala_id
     and ve.is_ativo is true
     and public.unaccent(lower(regexp_replace(trim(coalesce(ve.nome, '')), '\s+', ' ', 'g')))
         = public.unaccent(lower(v_name))
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  v_parts := regexp_split_to_array(v_name, '\s+');
  if coalesce(array_length(v_parts, 1), 0) >= 3 then
    v_short := v_parts[1] || ' ' || v_parts[array_length(v_parts, 1)];
    select ve.id
      into v_id
      from public.voluntarios_escala ve
     where ve.tenant_id = p_tenant_id
       and ve.tipo_escala_id = p_tipo_escala_id
       and ve.is_ativo is true
       and public.unaccent(lower(regexp_replace(trim(coalesce(ve.nome, '')), '\s+', ' ', 'g')))
           = public.unaccent(lower(v_short))
     limit 1;
  end if;

  return v_id;
end;
$$;

create or replace function public.mark_opportunity_notices_read()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('success', false);
  end if;
  update public.volunteer_opportunity_notices
     set read_at = now()
   where tenant_id = v_tenant
     and profile_id = v_me
     and read_at is null;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.mark_opportunity_notices_read() to anon, authenticated, service_role;

create or replace function public.mark_pastoral_slot_notices_read()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
begin
  if v_actor is null then
    return jsonb_build_object('success', false);
  end if;
  update public.pastoral_slot_notices
     set read_at = now()
   where profile_id = v_actor
     and (v_tenant is null or tenant_id = v_tenant)
     and read_at is null;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.mark_pastoral_slot_notices_read() to anon, authenticated;

notify pgrst, 'reload schema';
