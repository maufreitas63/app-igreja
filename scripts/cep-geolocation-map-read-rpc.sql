-- Mapa: leitura de cep_geolocations pelo app (chave anon).
-- O cliente não enxergava a tabela (RLS só em authenticated) e ignorava as coordenadas do Supabase.
-- Execute no SQL Editor do Supabase (após cep-geolocation-table.sql).

drop function if exists public.fetch_cep_geolocations_by_digits(text[]);

create or replace function public.fetch_cep_geolocations_by_digits(p_cep_digits text[])
returns table (
  cep_digits text,
  cep_formatted text,
  latitude double precision,
  longitude double precision,
  logradouro text,
  bairro text,
  localidade text,
  uf text,
  geocode_source text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.cep_digits,
    g.cep_formatted,
    g.latitude,
    g.longitude,
    g.logradouro,
    g.bairro,
    g.localidade,
    g.uf,
    g.geocode_source,
    g.updated_at
  from public.cep_geolocations g
  where p_cep_digits is not null
    and cardinality(p_cep_digits) > 0
    and g.cep_digits = any(p_cep_digits);
$$;

grant execute on function public.fetch_cep_geolocations_by_digits(text[]) to anon, authenticated;
grant execute on function public.fetch_cep_geolocations_sync_fingerprint() to anon, authenticated;

-- Leitura direta (opcional; RPC acima já resolve o mapa)
drop policy if exists cep_geolocations_select_anon on public.cep_geolocations;

create policy cep_geolocations_select_anon
  on public.cep_geolocations
  for select
  to anon
  using (true);

grant select on public.cep_geolocations to anon;

grant execute on function public.upsert_cep_geolocation(
  text, double precision, double precision, text, text, text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
