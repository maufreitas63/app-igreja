-- =============================================================================
-- Mensagem ao grupo de WhatsApp — item de manutenção no controle de acesso
-- =============================================================================
-- Aplica: npx supabase db query --linked -f scripts/whatsapp-group-message-access.sql
-- O recurso nasce sem grants. Só os papéis marcados em Controle de Acesso
-- (e o Super Administrador, que ignora a matriz) podem abrir o diálogo.
-- =============================================================================

begin;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'maintenance.card.whatsapp_group',
  'Mensagem ao grupo de WhatsApp',
  'Manutenção: diálogo para enviar uma mensagem ao grupo de WhatsApp da instância.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

create or replace function public.get_session_whatsapp_group()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_group text;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.session_has_resource_access('screen', 'maintenance.card.whatsapp_group', 'view') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para enviar ao grupo.');
  end if;

  select nullif(trim(i.whatsapp_group_id), '')
    into v_group
    from public.igrejas i
   where i.id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'whatsapp_group_id', v_group
  );
end;
$$;

grant execute on function public.get_session_whatsapp_group() to anon, authenticated;

notify pgrst, 'reload schema';

commit;
