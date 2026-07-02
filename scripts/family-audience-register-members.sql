-- Audiência do evento: dependentes com accepted null também podem ser inscritos.
-- A alteração está em scripts/register-member-atomic.sql
-- (register_member_atomic / unregister_member_atomic: accepted is distinct from false).
--
-- Execute no Supabase o arquivo completo:
--   scripts/register-member-atomic.sql

notify pgrst, 'reload schema';
