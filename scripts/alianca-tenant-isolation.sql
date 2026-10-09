-- Funil e convites da Aliança ficam na igreja da sessão.
-- Aplica: npx supabase db query --linked -f scripts/alianca-tenant-isolation.sql

begin;

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
   where l.id = p_id
     and l.tenant_id = public.current_session_tenant_id();
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
  v_tenant uuid := public.current_session_tenant_id();
  v_items jsonb;
  v_notes jsonb;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'leads', '[]'::jsonb, 'notifications', '[]'::jsonb);
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas o Super Administrador acessa o funil de Indicados.',
      'leads', '[]'::jsonb,
      'notifications', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(public.alianca_partner_lead_to_json(x.id) order by x.created_at desc),
    '[]'::jsonb
  )
    into v_items
    from public.alianca_partner_leads x
   where x.tenant_id = v_tenant;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'lead_id', n.lead_id,
        'title', n.title,
        'body', n.body,
        'created_at', n.created_at
      )
      order by n.created_at desc
    ),
    '[]'::jsonb
  )
    into v_notes
    from (
      select n.*
        from public.alianca_partner_lead_notifications n
        join public.alianca_partner_leads l on l.id = n.lead_id
       where n.is_read = false
         and l.tenant_id = v_tenant
       order by n.created_at desc
       limit 20
    ) n;

  return jsonb_build_object(
    'success', true,
    'leads', coalesce(v_items, '[]'::jsonb),
    'notifications', coalesce(v_notes, '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_alianca_partner_lead_stage(
  p_lead_id uuid,
  p_stage text,
  p_sub_stage integer default 1
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
  v_stage text := lower(btrim(coalesce(p_stage, '')));
  v_sub integer := coalesce(p_sub_stage, 1);
  v_current record;
  v_from_ord integer;
  v_to_ord integer;
begin
  if v_actor is null or v_tenant is null then
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
  if v_stage not in (
    'primeiro_contato',
    'qualificacao',
    'apresentacao',
    'follow_up',
    'negociacao',
    'fechamento'
  ) then
    return jsonb_build_object('success', false, 'message', 'Etapa comercial inválida.');
  end if;
  if v_stage = 'negociacao' then
    if v_sub not between 1 and 4 then
      return jsonb_build_object('success', false, 'message', 'Atividade da etapa inválida.');
    end if;
  elsif v_sub not between 1 and 3 then
    return jsonb_build_object('success', false, 'message', 'Atividade da etapa inválida.');
  end if;

  select stage, sub_stage
    into v_current
    from public.alianca_partner_leads
   where id = p_lead_id
     and tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.');
  end if;

  v_from_ord := public.alianca_partner_lead_stage_ordinal(v_current.stage);
  v_to_ord := public.alianca_partner_lead_stage_ordinal(v_stage);

  if v_from_ord <> v_to_ord then
    if abs(v_from_ord - v_to_ord) <> 1 then
      return jsonb_build_object(
        'success', false,
        'message', 'Avance ou recue uma etapa por vez no funil.'
      );
    end if;
    if v_current.stage = 'negociacao'
       and v_current.sub_stage = 4
       and v_stage = 'fechamento' then
      return jsonb_build_object(
        'success', false,
        'message', 'Negócio não concluído não avança para o fechamento.'
      );
    end if;
    v_sub := 1;
  end if;

  perform public.alianca_indicados_set_actor(v_actor);

  update public.alianca_partner_leads
     set stage = v_stage,
         sub_stage = v_sub,
         updated_at = now(),
         entered_stage_at = case
           when stage is distinct from v_stage then now()
           else entered_stage_at
         end
   where id = p_lead_id
     and tenant_id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'stage', v_stage,
    'sub_stage', v_sub,
    'message', 'Etapa atualizada.'
  );
end;
$$;

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
  v_tenant uuid := public.current_session_tenant_id();
  v_priority text;
  v_uf text;
  v_members integer;
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
begin
  if v_actor is null or v_tenant is null then
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
   where id = p_lead_id
     and tenant_id = v_tenant;

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

create or replace function public.list_alianca_partner_lead_movements(p_lead_id uuid)
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
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.', 'movements', '[]'::jsonb);
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas o Super Administrador acessa o funil de Indicados.',
      'movements', '[]'::jsonb
    );
  end if;
  if p_lead_id is null then
    return jsonb_build_object('success', false, 'message', 'Indicado não informado.', 'movements', '[]'::jsonb);
  end if;
  if not exists (
    select 1
      from public.alianca_partner_leads l
     where l.id = p_lead_id
       and l.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.', 'movements', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'from_stage', m.from_stage,
        'from_sub_stage', m.from_sub_stage,
        'to_stage', m.to_stage,
        'to_sub_stage', m.to_sub_stage,
        'actor_profile_id', m.actor_profile_id,
        'actor_name', coalesce(nullif(btrim(p.full_name), ''), 'Super Administrador'),
        'created_at', m.created_at
      )
      order by m.created_at desc
    ),
    '[]'::jsonb
  )
    into v_items
    from public.alianca_partner_lead_movements m
    left join public.profiles p on p.id = m.actor_profile_id
   where m.lead_id = p_lead_id;

  return jsonb_build_object('success', true, 'movements', coalesce(v_items, '[]'::jsonb));
end;
$$;

create or replace function public.delete_alianca_partner_lead(p_lead_id uuid)
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
  if v_actor is null or v_tenant is null then
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

  delete from public.alianca_partner_leads
   where id = p_lead_id
     and tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Indicado não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Indicado excluído.');
end;
$$;

notify pgrst, 'reload schema';

commit;
