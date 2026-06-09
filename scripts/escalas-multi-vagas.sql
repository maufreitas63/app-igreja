-- Múltiplos servos por domingo/tipo de escala (vagas_por_servico).
-- Execute no Supabase após vigilancia-escalas.sql e antes/atualizando os demais scripts de escala.
--
-- Reverte a regra I1 "1 servo por domingo" mantendo:
--   unique (tipo_escala_id, voluntario_id, data_servico)

alter table public.tipos_escala
  add column if not exists vagas_por_servico integer not null default 1
    check (vagas_por_servico >= 1 and vagas_por_servico <= 50);

alter table public.tipos_escala
  add column if not exists modo_ciclo text not null default 'individual'
    check (modo_ciclo in ('individual', 'equipe'));

-- Tipos existentes: preserva comportamento anterior (1 vaga, ciclo individual).
update public.tipos_escala te
set
  vagas_por_servico = coalesce(te.vagas_por_servico, 1),
  modo_ciclo = coalesce(nullif(te.modo_ciclo, ''), 'individual')
where te.vagas_por_servico is null
   or te.modo_ciclo is null
   or te.modo_ciclo = '';

drop index if exists public.escalas_log_tipo_data_uq;

notify pgrst, 'reload schema';
