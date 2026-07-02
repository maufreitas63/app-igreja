-- Audiência do evento: dependentes com accepted null também podem ser inscritos.
-- Execute no Supabase:
--   1. scripts/family-event-audience-members.sql (RPCs da audiência)
--   2. scripts/register-member-atomic.sql (inscrição com accepted is distinct from false)

notify pgrst, 'reload schema';
