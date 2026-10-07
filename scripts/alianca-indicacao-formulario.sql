-- Formulário público da igreja indicada (QR / WhatsApp) → funil de Indicados.
-- O tenant da igreja que indica vai no link. O envio não usa a sessão de quem preenche.
-- Aplica: npx supabase db query --linked -f scripts/alianca-indicacao-formulario.sql

begin;

alter table public.alianca_partner_leads
  add column if not exists church_address text,
  add column if not exists contact_email text;

create or replace function public.alianca_partner_lead_to_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'id', l.id,
    'indicated_name', l.indicated_name,
    'indicated_role', l.indicated_role,
    'indicated_phone', l.indicated_phone,
    'indicated_church_name', l.indicated_church_name,
    'church_address', l.church_address,
    'contact_email', l.contact_email,
    'city', l.city,
    'uf', l.uf,
    'estimated_members', l.estimated_members,
    'current_systems', l.current_systems,
    'governance_notes', l.governance_notes,
    'ti_notes', l.ti_notes,
    'priority', l.priority,
    'last_contact_at', l.last_contact_at,
    'next_action_at', l.next_action_at,
    'lost_reason', l.lost_reason,
    'stage', l.stage,
    'sub_stage', l.sub_stage,
    'entered_stage_at', l.entered_stage_at,
    'referrer_name', l.referrer_name,
    'instance_code', i.code,
    'instance_name', i.name,
    'tenant_id', l.tenant_id,
    'created_at', l.created_at,
    'updated_at', l.updated_at
  )
    from public.alianca_partner_leads l
    join public.igrejas i on i.id = l.tenant_id
   where l.id = p_id;
$$;

create or replace function public.get_alianca_indication_context(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_name text;
  v_code text;
begin
  select i.name, i.code
    into v_name, v_code
    from public.igrejas i
   where i.id = p_tenant_id
     and i.is_active = true;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Link de indicação inválido.');
  end if;

  return jsonb_build_object(
    'success', true,
    'church_name', v_name,
    'church_code', v_code
  );
end;
$$;

create or replace function public.submit_alianca_indication_form(
  p_tenant_id uuid,
  p_referrer_profile_id uuid,
  p_indicated_name text,
  p_indicated_phone text,
  p_indicated_role text,
  p_indicated_church_name text,
  p_church_address text,
  p_city text,
  p_uf text,
  p_estimated_members integer,
  p_contact_email text,
  p_current_systems text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_name text := nullif(btrim(coalesce(p_indicated_name, '')), '');
  v_role text := nullif(btrim(coalesce(p_indicated_role, '')), '');
  v_phone text := regexp_replace(coalesce(p_indicated_phone, ''), '\D', '', 'g');
  v_church text := nullif(btrim(coalesce(p_indicated_church_name, '')), '');
  v_address text := nullif(btrim(coalesce(p_church_address, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_uf text := upper(nullif(btrim(coalesce(p_uf, '')), ''));
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_systems text := nullif(btrim(coalesce(p_current_systems, '')), '');
  v_referrer text;
  v_id uuid;
  v_linked boolean := false;
begin
  if p_tenant_id is null or p_referrer_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Link de indicação inválido.');
  end if;

  if not exists (
    select 1 from public.igrejas i where i.id = p_tenant_id and i.is_active = true
  ) then
    return jsonb_build_object('success', false, 'message', 'Esta igreja não está ativa para receber indicações.');
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_referrer_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Link de indicação inválido.');
  end if;

  select exists (
    select 1
      from public.profile_igreja_vinculos v
     where v.profile_id = p_referrer_profile_id
       and v.tenant_id = p_tenant_id
       and v.is_active = true
  ) into v_linked;

  if not v_linked and not public.profile_has_super_admin_role(p_referrer_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Link de indicação inválido.');
  end if;

  if v_phone like '55%' and length(v_phone) >= 12 then
    v_phone := substr(v_phone, 3);
  end if;

  if v_name is null or length(v_name) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome completo.');
  end if;
  if length(v_phone) < 10 or length(v_phone) > 11 then
    return jsonb_build_object('success', false, 'message', 'Informe um celular válido com DDD.');
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('success', false, 'message', 'Informe um e-mail válido.');
  end if;
  if v_role is null or length(v_role) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe a posição ou o cargo na igreja.');
  end if;
  if v_church is null or length(v_church) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome da igreja.');
  end if;
  if v_address is null or length(v_address) < 5 then
    return jsonb_build_object('success', false, 'message', 'Informe o endereço da igreja.');
  end if;
  if v_city is null or length(v_city) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe a cidade da igreja.');
  end if;
  if v_uf is null or v_uf !~ '^[A-Z]{2}$' then
    return jsonb_build_object('success', false, 'message', 'Informe a UF com duas letras.');
  end if;
  if p_estimated_members is null or p_estimated_members < 1 then
    return jsonb_build_object('success', false, 'message', 'Informe o número aproximado de membros.');
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'Responsável da igreja')
    into v_referrer
    from public.profiles p
   where p.id = p_referrer_profile_id;

  v_referrer := coalesce(nullif(btrim(v_referrer), ''), 'Responsável da igreja');

  perform public.alianca_indicados_set_actor(p_referrer_profile_id);

  insert into public.alianca_partner_leads (
    tenant_id,
    referrer_profile_id,
    referrer_name,
    indicated_name,
    indicated_role,
    indicated_phone,
    indicated_church_name,
    church_address,
    city,
    uf,
    estimated_members,
    contact_email,
    current_systems
  )
  values (
    p_tenant_id,
    p_referrer_profile_id,
    v_referrer,
    v_name,
    v_role,
    v_phone,
    v_church,
    v_address,
    v_city,
    v_uf,
    p_estimated_members,
    v_email,
    v_systems
  )
  on conflict (tenant_id, indicated_phone) do update
    set indicated_name = excluded.indicated_name,
        indicated_role = excluded.indicated_role,
        referrer_profile_id = excluded.referrer_profile_id,
        referrer_name = excluded.referrer_name,
        indicated_church_name = excluded.indicated_church_name,
        church_address = excluded.church_address,
        city = excluded.city,
        uf = excluded.uf,
        estimated_members = excluded.estimated_members,
        contact_email = excluded.contact_email,
        current_systems = excluded.current_systems,
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'message', 'Formulário enviado. A equipe Conecta+ recebe estes dados no funil de indicados.'
  );
end;
$$;

drop function if exists public.update_alianca_partner_lead(
  uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text
);

create or replace function public.update_alianca_partner_lead(
  p_lead_id uuid,
  p_indicated_church_name text default null,
  p_city text default null,
  p_uf text default null,
  p_estimated_members integer default null,
  p_current_systems text default null,
  p_governance_notes text default null,
  p_ti_notes text default null,
  p_priority text default null,
  p_last_contact_at timestamptz default null,
  p_next_action_at timestamptz default null,
  p_lost_reason text default null,
  p_church_address text default null,
  p_contact_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_priority text;
  v_uf text;
  v_members integer;
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  begin
    perform public.assert_alianca_indicados_super_admin(v_actor);
  exception
    when others then
      return jsonb_build_object('success', false, 'message', SQLERRM);
  end;
  if p_lead_id is null then
    return jsonb_build_object('success', false, 'message', 'Indicado não informado.');
  end if;

  v_priority := lower(nullif(btrim(coalesce(p_priority, '')), ''));
  if v_priority is not null and v_priority not in ('baixa', 'media', 'alta') then
    return jsonb_build_object('success', false, 'message', 'Prioridade inválida.');
  end if;

  v_uf := upper(nullif(btrim(coalesce(p_uf, '')), ''));
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
    return jsonb_build_object('success', false, 'message', 'UF inválida.');
  end if;

  v_members := p_estimated_members;
  if v_members is not null and v_members < 0 then
    return jsonb_build_object('success', false, 'message', 'Informe um número de membros válido.');
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('success', false, 'message', 'E-mail inválido.');
  end if;

  perform public.alianca_indicados_set_actor(v_actor);

  update public.alianca_partner_leads
     set indicated_church_name = nullif(btrim(coalesce(p_indicated_church_name, '')), ''),
         city = nullif(btrim(coalesce(p_city, '')), ''),
         uf = v_uf,
         estimated_members = v_members,
         current_systems = nullif(btrim(coalesce(p_current_systems, '')), ''),
         governance_notes = nullif(btrim(coalesce(p_governance_notes, '')), ''),
         ti_notes = nullif(btrim(coalesce(p_ti_notes, '')), ''),
         priority = coalesce(v_priority, priority),
         last_contact_at = p_last_contact_at,
         next_action_at = p_next_action_at,
         lost_reason = nullif(btrim(coalesce(p_lost_reason, '')), ''),
         church_address = case
           when p_church_address is null then church_address
           else nullif(btrim(p_church_address), '')
         end,
         contact_email = case
           when p_contact_email is null then contact_email
           else v_email
         end,
         updated_at = now()
   where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Dados de governança atualizados.',
    'lead', public.alianca_partner_lead_to_json(p_lead_id)
  );
end;
$$;

revoke all on function public.get_alianca_indication_context(uuid) from public, anon, authenticated;
grant execute on function public.get_alianca_indication_context(uuid) to anon, authenticated, service_role;

revoke all on function public.submit_alianca_indication_form(
  uuid, uuid, text, text, text, text, text, text, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.submit_alianca_indication_form(
  uuid, uuid, text, text, text, text, text, text, text, integer, text, text
) to anon, authenticated, service_role;

grant execute on function public.update_alianca_partner_lead(
  uuid, text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text, text, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
