-- Histórico de pedidos do membro (app Coração Aberto).
-- OBRIGATÓRIO para "Meus pedidos" funcionar (RLS bloqueia SELECT direto).
-- Execute no SQL Editor do Supabase.

drop function if exists public.list_my_pastoral_requests(uuid);

create or replace function public.list_my_pastoral_requests(p_profile_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  motivo text,
  situacao text,
  description text,
  destination_label text,
  request_for text,
  beneficiary_name text,
  beneficiary_relationship text,
  beneficiary_details text,
  status text,
  confidential boolean,
  handler_profile_id uuid,
  handler_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_phone_digits text;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    pr.id,
    pr.created_at,
    pr.motivo,
    pr.situacao,
    pr.description,
    pr.destination_label,
    pr.request_for,
    pr.beneficiary_name,
    pr.beneficiary_relationship,
    pr.beneficiary_details,
    pr.status::text,
    coalesce(pr.confidential, false),
    pr.handler_profile_id,
    nullif(trim(coalesce(pr.handler_name, '')), '') as handler_name
  from public.pastoral_requests pr
  where pr.profile_id = p_profile_id
    or (
      v_profile_phone_digits <> ''
      and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
    )
  order by pr.created_at desc;
end;
$$;

grant execute on function public.list_my_pastoral_requests(uuid) to anon;
grant execute on function public.list_my_pastoral_requests(uuid) to authenticated;

notify pgrst, 'reload schema';
