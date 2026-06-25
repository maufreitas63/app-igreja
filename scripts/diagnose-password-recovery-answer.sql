-- Diagnóstico: pergunta de segurança, hash e bloqueio de recuperação.
-- Substitua o celular abaixo e execute no SQL Editor do Supabase.

with params as (
  select '19996166161'::text as phone_input
),
resolved as (
  select
    public.find_profile_id_for_password_recovery(p.phone_input) as profile_id,
    public.normalize_profile_phone(p.phone_input) as phone_normalized
  from params p
)
select
  r.profile_id,
  r.phone_normalized,
  p.full_name,
  p.phone as phone_raw,
  p.security_question,
  left(p.security_answer_hash, 7) as hash_prefix,
  public.security_answer_hash_is_bcrypt(p.security_answer_hash) as hash_is_bcrypt,
  case
    when p.security_answer_hash is null then 'sem resposta cadastrada'
    when public.security_answer_hash_is_bcrypt(p.security_answer_hash) then 'bcrypt (cadastro pelo app)'
    else 'texto puro — recadastre em Dados Cadastrais'
  end as hash_status,
  coalesce(s.failed_challenge_attempts, 0) as failed_challenge_attempts,
  s.blocked_until,
  public.password_recovery_is_lockout_exempt(r.profile_id) as lockout_exempt_super_admin,
  case
    when public.password_recovery_is_lockout_exempt(r.profile_id) then
      'super admin — sem bloqueio por tentativas'
    when s.blocked_until is not null and s.blocked_until > now() then
      'BLOQUEADO até '
      || to_char(s.blocked_until at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      || ' (Brasília) — execute scripts/password-recovery-unblock-phone.sql para liberar'
    else 'liberado para tentar'
  end as recovery_status
from resolved r
left join public.profiles p on p.id = r.profile_id
left join public.password_recovery_state s on s.phone_normalized = r.phone_normalized;

-- Teste se uma resposta confere (substitua a resposta):
-- select public.security_answer_matches(
--   'sua resposta aqui',
--   (select security_answer_hash from public.profiles where id = public.find_profile_id_for_password_recovery('19996166161'))
-- ) as matches;
