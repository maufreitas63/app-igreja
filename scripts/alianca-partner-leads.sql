-- Indicações de igrejas parceiras (Aliança Conecta Reino) + funil comercial do Super Admin.
-- Execute: npx supabase db query --linked -f scripts/alianca-partner-leads.sql

begin;

create table if not exists public.alianca_partner_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  referrer_profile_id uuid not null references public.profiles (id) on delete restrict,
  referrer_name text not null,
  indicated_name text not null,
  indicated_role text not null,
  indicated_phone text not null,
  stage text not null default 'prospeccao',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alianca_partner_leads_stage_chk check (
    stage in (
      'prospeccao',
      'primeiro_contato',
      'qualificacao',
      'apresentacao',
      'follow_up',
      'negociacao',
      'fechamento'
    )
  ),
  constraint alianca_partner_leads_name_chk check (length(btrim(indicated_name)) >= 2),
  constraint alianca_partner_leads_role_chk check (length(btrim(indicated_role)) >= 2),
  constraint alianca_partner_leads_phone_chk check (length(indicated_phone) between 10 and 15),
  constraint alianca_partner_leads_referrer_chk check (length(btrim(referrer_name)) >= 2)
);

create unique index if not exists alianca_partner_leads_tenant_phone_uidx
  on public.alianca_partner_leads (tenant_id, indicated_phone);

create index if not exists alianca_partner_leads_created_idx
  on public.alianca_partner_leads (created_at desc);

create index if not exists alianca_partner_leads_stage_idx
  on public.alianca_partner_leads (stage, created_at desc);

alter table public.alianca_partner_leads enable row level security;

revoke all on table public.alianca_partner_leads from public, anon, authenticated;

drop policy if exists alianca_partner_leads_no_direct on public.alianca_partner_leads;
create policy alianca_partner_leads_no_direct
  on public.alianca_partner_leads
  for all
  using (false)
  with check (false);

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    '/alianca-indicados',
    'Aliança — Indicados',
    'Lista de igrejas parceiras indicadas e funil comercial',
    true
  ),
  (
    'screen',
    'menu_alianca_indicados',
    'Menu — Indicados Aliança',
    'Atalho da engrenagem para a lista de indicados',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

create or replace function public.submit_alianca_partner_lead(
  p_indicated_name text,
  p_indicated_role text,
  p_indicated_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_name text := nullif(btrim(coalesce(p_indicated_name, '')), '');
  v_role text := nullif(btrim(coalesce(p_indicated_role, '')), '');
  v_phone text := regexp_replace(coalesce(p_indicated_phone, ''), '\D', '', 'g');
  v_referrer text;
  v_id uuid;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if v_phone like '55%' and length(v_phone) >= 12 then
    v_phone := substr(v_phone, 3);
  end if;

  if v_name is null or length(v_name) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do indicado.');
  end if;
  if v_role is null or length(v_role) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe a posição do indicado.');
  end if;
  if length(v_phone) < 10 or length(v_phone) > 11 then
    return jsonb_build_object('success', false, 'message', 'Informe um celular válido com DDD.');
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'Membro da instância')
    into v_referrer
    from public.profiles p
   where p.id = v_actor;

  v_referrer := coalesce(nullif(btrim(v_referrer), ''), 'Membro da instância');

  insert into public.alianca_partner_leads (
    tenant_id,
    referrer_profile_id,
    referrer_name,
    indicated_name,
    indicated_role,
    indicated_phone
  )
  values (
    v_tenant,
    v_actor,
    v_referrer,
    v_name,
    v_role,
    v_phone
  )
  on conflict (tenant_id, indicated_phone) do update
    set indicated_name = excluded.indicated_name,
        indicated_role = excluded.indicated_role,
        referrer_profile_id = excluded.referrer_profile_id,
        referrer_name = excluded.referrer_name,
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'message', 'Indicação registrada.'
  );
end;
$$;

create or replace function public.list_alianca_partner_leads()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_items jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'leads', '[]'::jsonb);
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.', 'leads', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'indicated_name', l.indicated_name,
        'indicated_role', l.indicated_role,
        'indicated_phone', l.indicated_phone,
        'stage', l.stage,
        'referrer_name', l.referrer_name,
        'instance_code', i.code,
        'instance_name', i.name,
        'tenant_id', l.tenant_id,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      )
      order by l.created_at desc
    ),
    '[]'::jsonb
  )
    into v_items
    from public.alianca_partner_leads l
    join public.igrejas i on i.id = l.tenant_id;

  return jsonb_build_object('success', true, 'leads', coalesce(v_items, '[]'::jsonb));
end;
$$;

create or replace function public.set_alianca_partner_lead_stage(
  p_lead_id uuid,
  p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_stage text := lower(btrim(coalesce(p_stage, '')));
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;
  if p_lead_id is null then
    return jsonb_build_object('success', false, 'message', 'Indicado não informado.');
  end if;
  if v_stage not in (
    'prospeccao',
    'primeiro_contato',
    'qualificacao',
    'apresentacao',
    'follow_up',
    'negociacao',
    'fechamento'
  ) then
    return jsonb_build_object('success', false, 'message', 'Etapa comercial inválida.');
  end if;

  update public.alianca_partner_leads
     set stage = v_stage,
         updated_at = now()
   where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'stage', v_stage, 'message', 'Etapa atualizada.');
end;
$$;

revoke all on function public.submit_alianca_partner_lead(text, text, text) from public, anon, authenticated;
revoke all on function public.list_alianca_partner_leads() from public, anon, authenticated;
revoke all on function public.set_alianca_partner_lead_stage(uuid, text) from public, anon, authenticated;

grant execute on function public.submit_alianca_partner_lead(text, text, text) to anon, authenticated, service_role;
grant execute on function public.list_alianca_partner_leads() to anon, authenticated, service_role;
grant execute on function public.set_alianca_partner_lead_stage(uuid, text) to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
