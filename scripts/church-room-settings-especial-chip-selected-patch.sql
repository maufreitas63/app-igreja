-- =============================================================================
-- Patch: chip da sala especial marca selecionado (mesmo padrão visual da padrão)
-- =============================================================================
-- Execute no Supabase após scripts/church-room-settings-special-rooms.sql
--
-- Problema: especial_room_key só vinha preenchido se a data estiver vigente,
-- então o chip admin não aplicava o estilo selecionado após atribuir.
-- Solução: retornar sempre a atribuição especial; a data só decide a efetiva.
-- =============================================================================

create or replace function public.effective_user_room(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_as_of date default current_date
)
returns table (
  room_key text,
  room_label text,
  room_kind text,
  padrao_room_key text,
  padrao_room_label text,
  especial_room_key text,
  especial_room_label text,
  especial_end_date date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_padrao_key text;
  v_padrao_label text;
  v_esp_key text;
  v_esp_label text;
  v_esp_start date;
  v_esp_end date;
  v_esp_active boolean := false;
  v_as_of date := coalesce(p_as_of, current_date);
begin
  select a.room_key, coalesce(nullif(trim(s.display_label), ''), a.room_key)
    into v_padrao_key, v_padrao_label
    from public.user_room_assignment a
    join public.church_room_settings s
      on s.tenant_id = a.tenant_id
     and s.room_key = a.room_key
   where a.tenant_id = p_tenant_id
     and a.profile_id = p_profile_id
     and a.assignment_kind = 'padrao'
     and s.is_enabled = true
     and s.room_kind = 'padrao'
   limit 1;

  select a.room_key,
         coalesce(nullif(trim(s.display_label), ''), a.room_key),
         s.start_date,
         s.end_date
    into v_esp_key, v_esp_label, v_esp_start, v_esp_end
    from public.user_room_assignment a
    join public.church_room_settings s
      on s.tenant_id = a.tenant_id
     and s.room_key = a.room_key
   where a.tenant_id = p_tenant_id
     and a.profile_id = p_profile_id
     and a.assignment_kind = 'especial'
     and s.is_enabled = true
     and s.room_kind = 'especial'
   limit 1;

  v_esp_active :=
    v_esp_key is not null
    and v_esp_start is not null
    and v_esp_end is not null
    and v_as_of between v_esp_start and v_esp_end;

  if v_esp_active then
    room_key := v_esp_key;
    room_label := v_esp_label;
    room_kind := 'especial';
  else
    room_key := v_padrao_key;
    room_label := v_padrao_label;
    room_kind := case when v_padrao_key is not null then 'padrao' else null end;
  end if;

  padrao_room_key := v_padrao_key;
  padrao_room_label := v_padrao_label;
  especial_room_key := v_esp_key;
  especial_room_label := v_esp_label;
  especial_end_date := v_esp_end;
  return next;
end;
$$;

grant execute on function public.effective_user_room(uuid, uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';

select 'church-room-settings-especial-chip-selected-patch: ok' as status;
