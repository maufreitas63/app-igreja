-- TESTE 10 — Sessão do app (simula o que o PostgREST enxerga)
-- Execute LOGADO no app não é possível daqui; use após um submit falhar com "Sessão expirada".
-- No SQL Editor (sem headers de sessão): esperado ok=false.
-- Para validar sessão real: F12 → Network → chamada submit → headers x-session-token.

select public.ping_profile_session() as sessao_no_sql_editor;

-- Esperado no SQL Editor: {"ok": false, "profileId": null}
-- No app (com token válido): ping_profile_session retorna ok=true antes do submit.
