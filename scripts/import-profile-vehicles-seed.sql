-- Importa veiculos em public.profile_vehicles (inclui visitantes sem perfil).
--
-- Execute no SQL Editor do Supabase depois de scripts/profile-vehicles.sql
-- (rode profile-vehicles.sql de novo se a tabela ja existia com FK para profiles).

with src(phone, placa, marca, modelo, cor) as (
  values
    ('19996166161', 'GIS6J34', 'HONDA', 'HRV', 'cinza'),
    ('12997320944', 'TIQ6G84', 'BYD', 'Mini', 'Preto'),
    ('12982182854', 'FJV2J27', 'Honda', 'FIT', 'Azul'),
    ('11976753628', 'UDM-9D94', 'FIAT', 'PULSE', 'Prata'),
    ('12974093937', 'DZR7E04', 'Citroën', 'C3', 'Cinza'),
    ('12996063582', 'PVA7E26', 'Volkswagen', 'Amarok', 'Prata'),
    ('61996165761', 'EXX9B44', 'Ford', 'Territory', 'Marrom'),
    ('61993036302', 'GKA8A63', 'Chevrolet', 'Onix Plus LT', 'Branca'),
    ('11982554268', 'SSS3H65', 'Honda', 'HRV', 'Azul escuro'),
    ('11982554268', 'FSO8E72', 'FORD', 'BRONCO', 'Azul escuro'),
    ('97984124052', 'FGK 0I38', 'Honda', 'Fit Twist', 'Beginho'),
    ('11983443661', 'SWX9B59', 'Ford', 'Territory', 'Azul'),
    ('11932010777', 'QNP5C69', 'Nissan', 'March', 'Prata'),
    ('12981352140', 'FXI8D78', 'Chery', 'Celer', 'Prata')
),
normalized as (
  select
    public.format_phone_like_profiles(btrim(phone)) as phone,
    upper(regexp_replace(btrim(placa), '\s+', '', 'g')) as placa,
    nullif(btrim(marca), '') as marca,
    nullif(btrim(modelo), '') as modelo,
    nullif(btrim(cor), '') as cor
  from src
)
insert into public.profile_vehicles (phone, placa, marca, modelo, cor)
select
  phone,
  placa,
  marca,
  modelo,
  cor
from normalized
where phone <> ''
  and placa <> ''
on conflict (phone, placa) do update
set
  marca = excluded.marca,
  modelo = excluded.modelo,
  cor = excluded.cor,
  updated_at = now();

select
  count(*)::bigint as total_veiculos_pos_seed
from public.profile_vehicles;
