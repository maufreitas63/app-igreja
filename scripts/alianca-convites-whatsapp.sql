-- Convites de WhatsApp da Aliança: pendentes no topo de Indicados até o formulário chegar.
-- Aplica: npx supabase db query --linked -f scripts/alianca-convites-whatsapp.sql

begin;

create table if not exists public.alianca_indication_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete restrict,
  sender_name text not null,
  recipient_name text not null,
  recipient_phone text not null,
  sent_at timestamptz not null default now(),
  converted_at timestamptz null,
  lead_id uuid null references public.alianca_partner_leads (id) on delete set null,
  constraint alianca_indication_invites_name_chk check (length(btrim(recipient_name)) >= 2),
  constraint alianca_indication_invites_phone_chk check (length(recipient_phone) between 10 and 11),
  constraint alianca_indication_invites_sender_chk check (length(btrim(sender_name)) >= 2)
);

create index if not exists alianca_indication_invites_pending_idx
  on public.alianca_indication_invites (sent_at desc)
  where converted_at is null;

alter table public.alianca_indication_invites enable row level security;

revoke all on table public.alianca_indication_invites from public, anon, authenticated;

drop policy if exists alianca_indication_invites_no_direct on public.alianca_indication_invites;
create policy alianca_indication_invites_no_direct
  on public.alianca_indication_invites
  for all
  using (false)
  with check (false);

create or replace function public.register_alianca_indication_invite(
  p_recipient_name text,
  p_recipient_phone text
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
  v_name text := nullif(btrim(coalesce(p_recipient_name, '')), '');
  v_phone text := regexp_replace(coalesce(p_recipient_phone, ''), '\D', '', 'g');
  v_sender text;
  v_id uuid;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas o Super Administrador registra convites.');
  end if;
  if not exists (
    select 1 from public.igrejas i where i.id = v_tenant and i.is_active = true
  ) then
    return jsonb_build_object('success', false, 'message', 'Abra o convite dentro da igreja que indica.');
  end if;

  if v_phone like '55%' and length(v_phone) >= 12 then
    v_phone := substr(v_phone, 3);
  end if;

  if v_name is null or length(v_name) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome de quem vai receber o convite.');
  end if;
  if length(v_phone) < 10 or length(v_phone) > 11 then
    return jsonb_build_object('success', false, 'message', 'Informe o celular com DDD.');
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'Super Administrador')
    into v_sender
    from public.profiles p
   where p.id = v_actor;

  v_sender := coalesce(nullif(btrim(v_sender), ''), 'Super Administrador');

  insert into public.alianca_indication_invites (
    tenant_id,
    sender_profile_id,
    sender_name,
    recipient_name,
    recipient_phone
  )
  values (v_tenant, v_actor, v_sender, v_name, v_phone)
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'message', 'Convite registrado.'
  );
end;
$$;

create or replace function public.list_alianca_indication_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_items jsonb;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'invites', '[]'::jsonb);
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas o Super Administrador consulta os convites.',
      'invites', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'tenant_id', q.tenant_id,
        'instance_code', q.code,
        'instance_name', q.name,
        'sender_name', q.sender_name,
        'recipient_name', q.recipient_name,
        'recipient_phone', q.recipient_phone,
        'sent_at', q.sent_at
      )
      order by q.sent_at desc
    ),
    '[]'::jsonb
  )
    into v_items
    from (
      select inv.id, inv.tenant_id, i.code, i.name, inv.sender_name,
             inv.recipient_name, inv.recipient_phone, inv.sent_at
        from public.alianca_indication_invites inv
        join public.igrejas i on i.id = inv.tenant_id
       where inv.converted_at is null
         and inv.tenant_id = v_tenant
       order by inv.sent_at desc
       limit 80
    ) q;

  return jsonb_build_object('success', true, 'invites', coalesce(v_items, '[]'::jsonb));
end;
$$;

create or replace function public.alianca_indication_invites_on_lead()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.alianca_indication_invites
     set converted_at = now(),
         lead_id = new.id
   where tenant_id = new.tenant_id
     and recipient_phone = new.indicated_phone
     and converted_at is null;
  return new;
end;
$$;

drop trigger if exists trg_alianca_indication_invites_on_lead on public.alianca_partner_leads;
create trigger trg_alianca_indication_invites_on_lead
after insert or update
on public.alianca_partner_leads
for each row
execute function public.alianca_indication_invites_on_lead();

revoke all on function public.register_alianca_indication_invite(text, text) from public, anon, authenticated;
grant execute on function public.register_alianca_indication_invite(text, text) to anon, authenticated, service_role;

revoke all on function public.list_alianca_indication_invites() from public, anon, authenticated;
grant execute on function public.list_alianca_indication_invites() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
