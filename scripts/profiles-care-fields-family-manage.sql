-- Campos de cuidado da criança/familiar: Observações Adicionais e Necessidades Específicas.
-- Restrição Alimentar continua em profiles.medical_food_alerts (já existente).
-- Canonical: profiles; espelho de staging: recepcao_cadastro_familiar.

alter table public.profiles
  add column if not exists additional_care_notes text;

alter table public.profiles
  add column if not exists special_needs text;

comment on column public.profiles.additional_care_notes is
  'Observações adicionais de cuidado (ex.: rotina, contato de emergência).';
comment on column public.profiles.special_needs is
  'Necessidades específicas (ex.: mobilidade, comunicação, apoio).';

alter table public.recepcao_cadastro_familiar
  add column if not exists additional_care_notes text;

alter table public.recepcao_cadastro_familiar
  add column if not exists special_needs text;

insert into public.access_resources (resource_type, resource_key, label)
values
  ('column', 'profiles.additional_care_notes', 'Observações adicionais'),
  ('column', 'profiles.special_needs', 'Necessidades específicas')
on conflict (resource_type, resource_key) do update
  set label = excluded.label;

-- Grants: mesmos papéis que já veem/editam medical_food_alerts.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select g.role_id, res.id, g.can_view, g.can_update
  from public.access_grants g
  join public.access_resources src
    on src.id = g.resource_id
   and src.resource_type = 'column'
   and src.resource_key = 'profiles.medical_food_alerts'
  join public.access_resources res
    on res.resource_type = 'column'
   and res.resource_key in ('profiles.additional_care_notes', 'profiles.special_needs')
 where g.role_id is not null
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Membro: garantir view/update (Passo 9c).
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'member'
   and res.resource_type = 'column'
   and res.resource_key in (
     'profiles.medical_food_alerts',
     'profiles.additional_care_notes',
     'profiles.special_needs'
   )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Ao promover cadastro da recepção, espelha os três campos no perfil aplicado.
create or replace function public.trg_recepcao_sync_care_fields_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.applied_profile_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.applied_profile_id is not distinct from new.applied_profile_id
     and old.medical_food_alerts is not distinct from new.medical_food_alerts
     and old.additional_care_notes is not distinct from new.additional_care_notes
     and old.special_needs is not distinct from new.special_needs then
    return new;
  end if;

  update public.profiles p
     set medical_food_alerts = coalesce(nullif(trim(new.medical_food_alerts), ''), p.medical_food_alerts),
         additional_care_notes = coalesce(nullif(trim(new.additional_care_notes), ''), p.additional_care_notes),
         special_needs = coalesce(nullif(trim(new.special_needs), ''), p.special_needs),
         updated_at = now()
   where p.id = new.applied_profile_id;

  return new;
end;
$$;

drop trigger if exists trg_recepcao_sync_care_fields_to_profile on public.recepcao_cadastro_familiar;
create trigger trg_recepcao_sync_care_fields_to_profile
  after insert or update of applied_profile_id, medical_food_alerts, additional_care_notes, special_needs
  on public.recepcao_cadastro_familiar
  for each row
  execute function public.trg_recepcao_sync_care_fields_to_profile();
