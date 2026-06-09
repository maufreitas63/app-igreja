-- A funcao `public.reserve_next_family_id()` foi centralizada em:
-- `scripts/register-member-atomic.sql`
--
-- Execute o script principal para criar ou atualizar:
-- - `public.reserve_next_family_id()`
-- - sincronizacao entre `members` e `profiles`
-- - RPCs de inscricao e monitoramento
--
-- Este arquivo permanece apenas como apontador para evitar
-- manutencao duplicada da mesma logica SQL.

select
  'Use scripts/register-member-atomic.sql para instalar ou atualizar public.reserve_next_family_id().' as info;
