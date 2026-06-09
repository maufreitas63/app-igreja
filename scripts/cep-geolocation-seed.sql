-- Gerado por scripts/backfill-cep-geolocations.mjs
-- Execute no SQL Editor se a RPC falhar.

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11660230',
  '11660-230',
  -23.6208747,
  -45.4116025,
  'Rua Teotino Tibiriçá Pimenta',
  'Centro',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11663200',
  '11663-200',
  -23.6100103,
  -45.3769674,
  'Avenida Ipiranga',
  'Jardim Casa Branca',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11672220',
  '11672-220',
  -23.6613179,
  -45.4418191,
  'Rua Cândida dos Prazeres de Moura',
  'Pontal de Santa Marina',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11676260',
  '11676-260',
  -23.5965824,
  -45.3571405,
  'Avenida Jardim',
  'Portal da Fazendinha',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11676439',
  '11676-439',
  -23.5931204,
  -45.3690915,
  'Rua Dois',
  'Capricórnio II',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11677042',
  '11677-042',
  -23.5874642,
  -45.3335233,
  'Rua Ennio Angelo Bertoncini',
  'Balneário Gardem Mar',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11677390',
  '11677-390',
  -23.5839177,
  -45.3394434,
  'Rua Victor Augusto Mesquita',
  'Jardim do Sol',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

insert into public.cep_geolocations (cep_digits, cep_formatted, latitude, longitude, logradouro, bairro, localidade, uf, geocode_source)
values (
  '11678101',
  '11678-101',
  -23.5808096,
  -45.351095,
  'Rua dos Jatobás',
  'Park Imperial',
  'Caraguatatuba',
  'SP',
  'backfill_script'
)
on conflict (cep_digits) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geocode_source = excluded.geocode_source,
  updated_at = now();

