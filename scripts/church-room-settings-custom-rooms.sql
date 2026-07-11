-- =============================================================================
-- Salas customizadas + dedupe de room_key
-- =============================================================================
-- Execute após scripts/church-room-settings.sql
--
-- - Normaliza room_key para MAIÚSCULAS e remove duplicatas por instância
-- - Remove limite KIDS/TEENS (permite Homens, Mulheres, Discipulado, etc.)
-- - KIDS/TEENS viram salas de sistema (não excluíveis)
-- - Nome afetivo (display_label) único por instância (case-insensitive)
-- =============================================================================

-- 1) Coluna is_system
alter table public.church_room_settings
  add column if not exists is_system boolean not null default false;

update public.church_room_settings
   set is_system = true
 where upper(trim(room_key)) in ('KIDS', 'TEENS');

update public.church_room_settings
   set is_system = false
 where upper(trim(room_key)) not in ('KIDS', 'TEENS');

-- 2) Normalizar room_key
update public.church_room_settings
   set room_key = upper(trim(room_key))
 where room_key is distinct from upper(trim(room_key));

update public.user_room_assignment
   set room_key = upper(trim(room_key))
 where room_key is distinct from upper(trim(room_key));

-- 3) Remover duplicatas de room_key (mantém a mais antiga)
with ranked as (
  select
    id,
    row_number() over (
      partition by tenant_id, upper(trim(room_key))
      order by created_at asc nulls last, id asc
    ) as rn
  from public.church_room_settings
)
delete from public.church_room_settings s
 using ranked r
 where s.id = r.id
   and r.rn > 1;

-- Remover atribuições órfãs / duplicadas após limpeza
delete from public.user_room_assignment a
 where not exists (
   select 1
     from public.church_room_settings s
    where s.tenant_id = a.tenant_id
      and s.room_key = a.room_key
 );

-- Dedupe display_label (case-insensitive) — mantém a mais antiga
with ranked_labels as (
  select
    id,
    row_number() over (
      partition by tenant_id, lower(trim(display_label))
      order by
        case when upper(trim(room_key)) in ('KIDS', 'TEENS') then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as rn
  from public.church_room_settings
)
delete from public.church_room_settings s
 using ranked_labels r
 where s.id = r.id
   and r.rn > 1;

-- 4) Dropar checks antigos (só KIDS/TEENS)
alter table public.church_room_settings
  drop constraint if exists church_room_settings_room_key_check;

alter table public.user_room_assignment
  drop constraint if exists user_room_assignment_room_key_check;

-- Novo check: chave alfanumérica com underscore
alter table public.church_room_settings
  drop constraint if exists church_room_settings_room_key_format;

alter table public.church_room_settings
  add constraint church_room_settings_room_key_format
  check (room_key ~ '^[A-Z0-9_]{2,40}$');

alter table public.user_room_assignment
  drop constraint if exists user_room_assignment_room_key_format;

alter table public.user_room_assignment
  add constraint user_room_assignment_room_key_format
  check (room_key ~ '^[A-Z0-9_]{2,40}$');

-- Unique display_label por tenant (case-insensitive)
drop index if exists church_room_settings_tenant_label_uq;
create unique index church_room_settings_tenant_label_uq
  on public.church_room_settings (tenant_id, lower(trim(display_label)));

-- 5) Helpers
create or replace function public.normalize_church_room_key(p_room_key text)
returns text
language sql
immutable
as $$
  select upper(trim(coalesce(p_room_key, '')));
$$;

create or replace function public.slug_church_room_key(p_label text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        upper(
          translate(
            trim(coalesce(p_label, '')),
            'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
          )
        ),
        '[^A-Z0-9]+',
        '_',
        'g'
      ),
      '^_+|_+$',
      '',
      'g'
    ),
    ''
  );
$$;

create or replace function public.is_system_church_room_key(p_room_key text)
returns boolean
language sql
immutable
as $$
  select public.normalize_church_room_key(p_room_key) in ('KIDS', 'TEENS');
$$;

-- 6) list — inclui is_system
create or replace function public.list_church_room_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
begin
  insert into public.church_room_settings (tenant_id, room_key, display_label, sort_order, is_system)
  select v_tenant, x.room_key, x.display_label, x.sort_order, true
    from (values
      ('KIDS', 'Infantil', 10),
      ('TEENS', 'Jovens', 20)
    ) as x(room_key, display_label, sort_order)
   where not exists (
     select 1 from public.church_room_settings s
      where s.tenant_id = v_tenant
        and s.room_key = x.room_key
   );

  update public.church_room_settings
     set is_system = true
   where tenant_id = v_tenant
     and room_key in ('KIDS', 'TEENS')
     and is_system is distinct from true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'tenant_id', s.tenant_id,
      'room_key', s.room_key,
      'display_label', s.display_label,
      'badge_label', s.badge_label,
      'color_hex', s.color_hex,
      'is_enabled', s.is_enabled,
      'is_system', s.is_system,
      'sort_order', s.sort_order
    )
    order by s.sort_order, s.room_key
  ), '[]'::jsonb)
    into v_rows
    from public.church_room_settings s
   where s.tenant_id = v_tenant;

  return v_rows;
end;
$$;

grant execute on function public.list_church_room_settings() to anon, authenticated;

-- 7) upsert — qualquer sala existente; cria se custom e key válida
create or replace function public.upsert_church_room_setting(
  p_room_key text,
  p_display_label text,
  p_badge_label text default null,
  p_is_enabled boolean default true,
  p_sort_order integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_key text := public.normalize_church_room_key(p_room_key);
  v_label text := trim(coalesce(p_display_label, ''));
  v_row public.church_room_settings%rowtype;
  v_is_system boolean := public.is_system_church_room_key(v_key);
begin
  perform public.assert_church_room_manager(v_actor);

  if v_key is null or v_key !~ '^[A-Z0-9_]{2,40}$' then
    return jsonb_build_object('success', false, 'message', 'Código da sala inválido.');
  end if;

  if char_length(v_label) < 2 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe um nome afetivo (mínimo 2 caracteres).'
    );
  end if;

  if exists (
    select 1
      from public.church_room_settings s
     where s.tenant_id = v_tenant
       and lower(trim(s.display_label)) = lower(v_label)
       and s.room_key <> v_key
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe uma sala com este nome nesta instância.'
    );
  end if;

  insert into public.church_room_settings as s (
    tenant_id, room_key, display_label, badge_label, is_enabled, sort_order, is_system, updated_at
  )
  values (
    v_tenant,
    v_key,
    v_label,
    nullif(trim(coalesce(p_badge_label, '')), ''),
    coalesce(p_is_enabled, true),
    coalesce(
      p_sort_order,
      case
        when v_key = 'KIDS' then 10
        when v_key = 'TEENS' then 20
        else 100
      end
    ),
    v_is_system,
    now()
  )
  on conflict (tenant_id, room_key) do update
    set display_label = excluded.display_label,
        badge_label = excluded.badge_label,
        is_enabled = excluded.is_enabled,
        sort_order = coalesce(excluded.sort_order, s.sort_order),
        is_system = s.is_system or excluded.is_system,
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Sala atualizada.',
    'row', jsonb_build_object(
      'id', v_row.id,
      'tenant_id', v_row.tenant_id,
      'room_key', v_row.room_key,
      'display_label', v_row.display_label,
      'badge_label', v_row.badge_label,
      'color_hex', v_row.color_hex,
      'is_enabled', v_row.is_enabled,
      'is_system', v_row.is_system,
      'sort_order', v_row.sort_order
    )
  );
end;
$$;

grant execute on function public.upsert_church_room_setting(text, text, text, boolean, integer)
  to anon, authenticated;

-- 8) Criar sala customizada a partir do nome
create or replace function public.create_church_room_setting(p_display_label text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_label text := trim(coalesce(p_display_label, ''));
  v_key text;
  v_base text;
  v_suffix integer := 0;
begin
  perform public.assert_church_room_manager(v_actor);

  if char_length(v_label) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome da sala (mínimo 2).');
  end if;

  if exists (
    select 1
      from public.church_room_settings s
     where s.tenant_id = v_tenant
       and lower(trim(s.display_label)) = lower(v_label)
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe uma sala com este nome nesta instância.'
    );
  end if;

  v_base := public.slug_church_room_key(v_label);
  if v_base is null or char_length(v_base) < 2 then
    return jsonb_build_object('success', false, 'message', 'Não foi possível gerar o código da sala.');
  end if;

  if public.is_system_church_room_key(v_base) then
    v_base := v_base || '_CUSTOM';
  end if;

  v_key := left(v_base, 40);
  while exists (
    select 1 from public.church_room_settings s
     where s.tenant_id = v_tenant and s.room_key = v_key
  ) loop
    v_suffix := v_suffix + 1;
    v_key := left(v_base, 36) || '_' || v_suffix::text;
  end loop;

  return public.upsert_church_room_setting(v_key, v_label, null, true, 100);
end;
$$;

grant execute on function public.create_church_room_setting(text) to anon, authenticated;

-- 9) Excluir sala customizada
create or replace function public.delete_church_room_setting(p_room_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_key text := public.normalize_church_room_key(p_room_key);
begin
  perform public.assert_church_room_manager(v_actor);

  if public.is_system_church_room_key(v_key) then
    return jsonb_build_object(
      'success', false,
      'message', 'Salas de sistema (KIDS/TEENS) não podem ser excluídas.'
    );
  end if;

  if not exists (
    select 1 from public.church_room_settings s
     where s.tenant_id = v_tenant and s.room_key = v_key
  ) then
    return jsonb_build_object('success', false, 'message', 'Sala não encontrada.');
  end if;

  delete from public.user_room_assignment a
   where a.tenant_id = v_tenant
     and a.room_key = v_key;

  delete from public.church_room_settings s
   where s.tenant_id = v_tenant
     and s.room_key = v_key
     and coalesce(s.is_system, false) = false;

  return jsonb_build_object('success', true, 'message', 'Sala removida.');
end;
$$;

grant execute on function public.delete_church_room_setting(text) to anon, authenticated;

-- 10) Atribuição — qualquer sala habilitada da instância
create or replace function public.set_user_room_assignment(
  p_profile_id uuid,
  p_room_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_key text := public.normalize_church_room_key(p_room_key);
  v_label text;
begin
  perform public.assert_church_room_manager(v_actor);

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_key is null or v_key !~ '^[A-Z0-9_]{2,40}$' then
    return jsonb_build_object('success', false, 'message', 'Sala inválida.');
  end if;

  if not exists (
    select 1
      from public.profile_igreja_vinculos v
     where v.profile_id = p_profile_id
       and v.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não vinculado a esta instância.');
  end if;

  if not exists (
    select 1 from public.church_room_settings s
     where s.tenant_id = v_tenant and s.room_key = v_key and s.is_enabled
  ) then
    return jsonb_build_object('success', false, 'message', 'Sala inexistente ou desabilitada.');
  end if;

  insert into public.user_room_assignment as a (
    tenant_id, profile_id, room_key, assigned_by_profile_id, updated_at
  )
  values (v_tenant, p_profile_id, v_key, v_actor, now())
  on conflict (tenant_id, profile_id) do update
    set room_key = excluded.room_key,
        assigned_by_profile_id = excluded.assigned_by_profile_id,
        updated_at = now();

  select s.display_label into v_label
    from public.church_room_settings s
   where s.tenant_id = v_tenant and s.room_key = v_key;

  return jsonb_build_object(
    'success', true,
    'message', 'Atribuição salva.',
    'profile_id', p_profile_id,
    'room_key', v_key,
    'room_label', coalesce(v_label, v_key)
  );
end;
$$;

grant execute on function public.set_user_room_assignment(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

select
  'custom rooms + dedupe ok' as status,
  (select count(*) from public.church_room_settings) as room_rows,
  (
    select count(*)
      from (
        select tenant_id, room_key
          from public.church_room_settings
         group by tenant_id, room_key
        having count(*) > 1
      ) d
  ) as duplicate_room_keys;
