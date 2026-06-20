-- Garante Realtime + réplica completa para UPDATE em event_control (orquestração).
-- Execute no Supabase se o celular com app aberto não receber mudanças do líder.

alter table public.event_control replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.event_control;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end;
$$;

notify pgrst, 'reload schema';
