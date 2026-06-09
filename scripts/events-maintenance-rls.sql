-- Permite criar e editar eventos pelo app (dashboard de manutenção).
-- Execute no SQL Editor do Supabase do projeto.
--
-- Sem estas policies, insert/update/delete falham (RLS 42501 ou 0 linhas apagadas).
-- Se você já rodou uma versão antiga deste script, execute o arquivo inteiro de novo
-- para garantir a policy de DELETE e o grant delete.

alter table public.events enable row level security;

drop policy if exists events_select_policy on public.events;
create policy events_select_policy
on public.events
for select
to anon, authenticated
using (true);

drop policy if exists events_insert_policy on public.events;
create policy events_insert_policy
on public.events
for insert
to anon, authenticated
with check (true);

drop policy if exists events_update_policy on public.events;
create policy events_update_policy
on public.events
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists events_delete_policy on public.events;
create policy events_delete_policy
on public.events
for delete
to anon, authenticated
using (true);

grant select, insert, update, delete on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;
