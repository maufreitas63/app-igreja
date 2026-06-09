-- Permite atualizar members.accepted pelo app (Gerenciar Família).
-- Execute no SQL Editor do Supabase após members-accepted-column.sql.
--
-- Sem policy de UPDATE, o app pode parecer "travado" (toque sem efeito ou alerta de permissão).

alter table public.members enable row level security;

drop policy if exists members_select_policy on public.members;
create policy members_select_policy
on public.members
for select
to anon, authenticated
using (true);

drop policy if exists members_insert_policy on public.members;
create policy members_insert_policy
on public.members
for insert
to anon, authenticated
with check (true);

drop policy if exists members_update_policy on public.members;
create policy members_update_policy
on public.members
for update
to anon, authenticated
using (true)
with check (true);
