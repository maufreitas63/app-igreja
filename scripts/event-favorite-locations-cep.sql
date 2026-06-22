-- Adiciona CEP em locais favoritos de eventos (para quem já executou event-favorite-locations.sql).
-- Execute no SQL Editor do Supabase.

alter table public.event_favorite_locations
  add column if not exists cep text null;

comment on column public.event_favorite_locations.cep is
  'CEP formatado (NNNNN-NNN) do local favorito.';

alter table public.event_favorite_locations
  drop constraint if exists event_favorite_locations_cep_check;

alter table public.event_favorite_locations
  add constraint event_favorite_locations_cep_check
  check (cep is null or cep ~ '^\d{5}-\d{3}$');

notify pgrst, 'reload schema';
