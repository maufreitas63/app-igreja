-- Importa a escala historica da Vigilancia do Estacionamento
-- para a estrutura generica de escalas:
-- - public.tipos_escala
-- - public.voluntarios_escala
-- - public.escalas_log
--
-- Execute este script no SQL Editor do Supabase
-- depois de aplicar `scripts/vigilancia-escalas.sql`.
--
-- Observacoes:
-- - O script garante a existencia do tipo `vigilancia_estacionamento`.
-- - O script insere voluntarios ausentes como ativos.
-- - O script ignora duplicidades exatas em `(tipo_escala_id, voluntario_id, data_servico)`.
-- - Ao final, recalcula `data_ultima_escala` com base no historico importado.

insert into public.tipos_escala (codigo, nome, is_ativa)
values ('vigilancia_estacionamento', 'Vigilancia do Estacionamento', true)
on conflict (codigo) do update
set
  nome = excluded.nome,
  is_ativa = excluded.is_ativa,
  updated_at = now();

with tipo_vigilancia as (
  select te.id
  from public.tipos_escala te
  where te.codigo = 'vigilancia_estacionamento'
  limit 1
),
historico_bruto(data_servico_br, nome) as (
  values
    ('03/05/2026', 'Gabriel Dias Alberti'),
    ('10/05/2026', 'Tiago Noboru Ukei'),
    ('17/05/2026', 'Marcio Fernandes Garcia'),
    ('24/05/2026', 'Eduardo de Paula Silva'),
    ('31/05/2026', 'Armando Mello'),
    ('07/06/2026', 'Mauricio de Freitas'),
    ('14/06/2026', 'Julio André Pereira da Silva'),
    ('21/06/2026', 'Filipe Alves Cavalcante'),
    ('28/06/2026', 'Daniel da Silva Araujo'),
    ('05/07/2026', 'Gabriel Dias Alberti'),
    ('12/07/2026', 'Tiago Noboru Ukei'),
    ('19/07/2026', 'Marcio Fernandes Garcia'),
    ('26/07/2026', 'Eduardo de Paula Silva'),
    ('02/08/2026', 'Armando Mello'),
    ('09/08/2026', 'Mauricio de Freitas'),
    ('16/08/2026', 'Julio André Pereira da Silva'),
    ('23/08/2026', 'Filipe Alves Cavalcante'),
    ('30/08/2026', 'Daniel da Silva Araujo'),
    ('06/09/2026', 'Gabriel Dias Alberti'),
    ('13/09/2026', 'Tiago Noboru Ukei'),
    ('20/09/2026', 'Marcio Fernandes Garcia'),
    ('27/09/2026', 'Eduardo de Paula Silva'),
    ('04/10/2026', 'Armando Mello'),
    ('11/10/2026', 'Mauricio de Freitas'),
    ('18/10/2026', 'Julio André Pereira da Silva'),
    ('25/10/2026', 'Filipe Alves Cavalcante')
),
historico as (
  select distinct
    to_date(data_servico_br, 'DD/MM/YYYY') as data_servico,
    trim(nome) as nome
  from historico_bruto
),
novos_voluntarios as (
  insert into public.voluntarios_escala (tipo_escala_id, nome, is_ativo)
  select tv.id, h.nome, true
  from (
    select distinct nome
    from historico
  ) h
  cross join tipo_vigilancia tv
  where not exists (
    select 1
    from public.voluntarios_escala ve
    where ve.tipo_escala_id = tv.id
      and lower(trim(ve.nome)) = lower(trim(h.nome))
  )
  returning id, nome
),
voluntarios_resolvidos as (
  select ve.id, ve.nome, tv.id as tipo_escala_id
  from public.voluntarios_escala ve
  cross join tipo_vigilancia tv
  join (
    select distinct nome
    from historico
  ) h
    on lower(trim(ve.nome)) = lower(trim(h.nome))
  where ve.tipo_escala_id = tv.id
),
logs_inseridos as (
  insert into public.escalas_log (tipo_escala_id, voluntario_id, data_servico)
  select vr.tipo_escala_id, vr.id, h.data_servico
  from historico h
  join voluntarios_resolvidos vr
    on lower(trim(vr.nome)) = lower(trim(h.nome))
  on conflict (tipo_escala_id, voluntario_id, data_servico) do nothing
  returning voluntario_id, data_servico
)
select count(*) as total_logs_importados
from logs_inseridos;

update public.voluntarios_escala ve
set data_ultima_escala = ultima.max_data
from (
  select
    el.voluntario_id,
    max(el.data_servico) as max_data
  from public.escalas_log el
  join public.tipos_escala te
    on te.id = el.tipo_escala_id
  where te.codigo = 'vigilancia_estacionamento'
  group by el.voluntario_id
) as ultima
where ultima.voluntario_id = ve.id;

select
  ve.nome,
  ve.is_ativo,
  ve.data_ultima_escala
from public.voluntarios_escala ve
join public.tipos_escala te
  on te.id = ve.tipo_escala_id
where te.codigo = 'vigilancia_estacionamento'
  and exists (
    select 1
    from public.escalas_log el
    where el.voluntario_id = ve.id
      and el.tipo_escala_id = te.id
  )
order by ve.data_ultima_escala asc, ve.nome asc;
