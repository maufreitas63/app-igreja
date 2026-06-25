-- Desbloqueia recuperação de senha após 3 tentativas incorretas na pergunta de segurança.
-- Super admins são isentos automaticamente (password-recovery-security.sql).
-- Substitua o celular e execute no SQL Editor do Supabase.

with params as (
  select '19996166161'::text as phone_input
),
resolved as (
  select public.normalize_profile_phone(p.phone_input) as phone_normalized
  from params p
)
update public.password_recovery_state s
   set failed_challenge_attempts = 0,
       blocked_until = null,
       challenge_passed_at = null,
       updated_at = now()
  from resolved r
 where s.phone_normalized = r.phone_normalized
returning s.phone_normalized, s.failed_challenge_attempts, s.blocked_until;
