-- Separa, na engrenagem, o acompanhamento de check-in dos pedidos de intercessão.
-- p_kind nulo mantém a lista completa para chamadas antigas.

drop function if exists public.listar_solicitantes_pedido_pastoral();

create or replace function public.listar_solicitantes_pedido_pastoral(p_kind text default null)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  request_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_kind text := lower(trim(coalesce(p_kind, '')));
begin
  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    count(pr.id)::bigint as request_count
  from public.profiles p
  inner join public.pastoral_requests pr
    on pr.profile_id = p.id
   and pr.tenant_id = v_tenant
  where p.tenant_id = v_tenant
    and p.full_name is not null
    and trim(p.full_name) <> ''
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
    and (
      v_kind = ''
      or (
        v_kind = 'intercessao'
        and public.pastoral_destination_label_is_intercession(pr.destination_label)
      )
      or (
        v_kind = 'checkin'
        and not public.pastoral_destination_label_is_intercession(pr.destination_label)
      )
    )
  group by p.id, p.full_name, p.phone
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.listar_solicitantes_pedido_pastoral(text) to anon, authenticated;

notify pgrst, 'reload schema';
