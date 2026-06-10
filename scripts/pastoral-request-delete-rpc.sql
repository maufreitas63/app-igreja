-- Exclusão de pedido pastoral pelo próprio solicitante (Meus pedidos / Coração Aberto).
-- Só permite excluir pedidos ainda não iniciados pelo Cuidado Pastoral (status sem Acolher/Apoiar/Acompanhar).
-- Execute no SQL Editor do Supabase após pastoral-requests-history.sql.

drop function if exists public.delete_my_pastoral_request(uuid, uuid);

create or replace function public.delete_my_pastoral_request(
  p_request_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_phone_digits text;
  v_request public.pastoral_requests%rowtype;
  v_status text;
  v_follow_up_idx integer;
begin
  if p_request_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  select *
  into v_request
  from public.pastoral_requests pr
  where pr.id = p_request_id
    and (
      pr.profile_id = p_profile_id
      or (
        v_profile_phone_digits <> ''
        and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
      )
    );

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;

  v_status := lower(trim(coalesce(v_request.status::text, '')));
  v_follow_up_idx := public.pastoral_follow_up_stage_index(v_request.status::text);

  if v_follow_up_idx >= 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Este pedido já foi iniciado pelo Cuidado Pastoral e não pode ser excluído.'
    );
  end if;

  if v_status in ('in_progress', 'closed', 'cancelled') then
    return jsonb_build_object(
      'success', false,
      'message', 'Este pedido já foi iniciado pelo Cuidado Pastoral e não pode ser excluído.'
    );
  end if;

  delete from public.pastoral_requests pr
  where pr.id = p_request_id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.delete_my_pastoral_request(uuid, uuid) to anon;
grant execute on function public.delete_my_pastoral_request(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
