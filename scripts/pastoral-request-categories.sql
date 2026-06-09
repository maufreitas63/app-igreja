-- Cria tabelas de motivos e submotivos para o fluxo
-- "Coração Aberto" e popula as opções iniciais.
-- Esta versão usa UUID porque `public.pastoral_requests.category_id`
-- já existe como UUID no banco atual.
--
-- Execute este script no SQL Editor do Supabase.

create table if not exists public.pastoral_reason_categories (
  id uuid primary key,
  code text not null unique,
  label text not null unique,
  display_order integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pastoral_reason_subcategories (
  id uuid primary key,
  category_id uuid not null references public.pastoral_reason_categories(id) on delete cascade,
  code text not null unique,
  label text not null,
  display_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pastoral_reason_subcategories_category_label_key unique (category_id, label),
  constraint pastoral_reason_subcategories_category_order_key unique (category_id, display_order)
);

create index if not exists idx_pastoral_reason_categories_active
  on public.pastoral_reason_categories (is_active, display_order);

create index if not exists idx_pastoral_reason_subcategories_category_id
  on public.pastoral_reason_subcategories (category_id);

create index if not exists idx_pastoral_reason_subcategories_active
  on public.pastoral_reason_subcategories (category_id, is_active, display_order);

alter table if exists public.pastoral_requests
  add column if not exists subcategory_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pastoral_requests'
      and column_name = 'category_id'
      and data_type <> 'uuid'
  ) then
    raise exception 'A coluna public.pastoral_requests.category_id precisa ser UUID.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pastoral_requests'
      and column_name = 'subcategory_id'
      and data_type <> 'uuid'
  ) then
    update public.pastoral_requests
    set subcategory_id = null;

    alter table public.pastoral_requests
      alter column subcategory_id type uuid
      using null::uuid;
  end if;

  begin
    alter table public.pastoral_requests
      drop constraint if exists pastoral_requests_category_id_fkey;
  exception
    when undefined_object then
      null;
  end;

  alter table public.pastoral_requests
    add constraint pastoral_requests_category_id_fkey
    foreign key (category_id)
    references public.pastoral_reason_categories(id)
    not valid;

  begin
    alter table public.pastoral_requests
      drop constraint if exists pastoral_requests_subcategory_id_fkey;
  exception
    when undefined_object then
      null;
  end;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pastoral_requests'
      and column_name = 'subcategory_id'
  ) then
    alter table public.pastoral_requests
      add constraint pastoral_requests_subcategory_id_fkey
      foreign key (subcategory_id)
      references public.pastoral_reason_subcategories(id)
      not valid;
  end if;
end
$$;

create index if not exists idx_pastoral_requests_category_id
  on public.pastoral_requests (category_id);

create index if not exists idx_pastoral_requests_subcategory_id
  on public.pastoral_requests (subcategory_id);

alter table public.pastoral_reason_categories enable row level security;
alter table public.pastoral_reason_subcategories enable row level security;

drop policy if exists pastoral_reason_categories_select on public.pastoral_reason_categories;
create policy pastoral_reason_categories_select
on public.pastoral_reason_categories
for select
using (true);

drop policy if exists pastoral_reason_subcategories_select on public.pastoral_reason_subcategories;
create policy pastoral_reason_subcategories_select
on public.pastoral_reason_subcategories
for select
using (true);

grant select on public.pastoral_reason_categories to anon;
grant select on public.pastoral_reason_categories to authenticated;
grant select on public.pastoral_reason_subcategories to anon;
grant select on public.pastoral_reason_subcategories to authenticated;

insert into public.pastoral_reason_categories (id, code, label, display_order)
values
  ('10000000-0000-4000-8000-000000000001', 'saude_bem_estar', 'Saúde e Bem-Estar Físico e Emocional', 1),
  ('10000000-0000-4000-8000-000000000002', 'familia_relacionamentos', 'Família e Relacionamentos', 2),
  ('10000000-0000-4000-8000-000000000003', 'vida_profissional_academica_financeira', 'Vida Profissional, Acadêmica e Financeira', 3),
  ('10000000-0000-4000-8000-000000000004', 'vida_espiritual_ministerio_lideranca', 'Vida Espiritual, Ministério e Liderança', 4),
  ('10000000-0000-4000-8000-000000000005', 'acoes_gracas_louvor_testemunhos', 'Ações de Graças, Louvor e Testemunhos', 5)
on conflict (id) do update
set
  code = excluded.code,
  label = excluded.label,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

insert into public.pastoral_reason_subcategories (id, category_id, code, label, display_order)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'saude_diagnosticos_criticos', 'Enfermidades Graves e Diagnósticos Críticos', 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'saude_intervencoes_cirurgicas', 'Intervenções Cirúrgicas e Procedimentos Médicos Complexos', 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'saude_internacoes_uti', 'Internações Hospitalares e Pacientes em UTI', 3),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'saude_tratamentos_oncologicos', 'Tratamentos Oncológicos e Quimioterapia', 4),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'saude_reabilitacao_fisica', 'Sequelas e Processos de Reabilitação Física', 5),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'saude_ansiedade_depressao', 'Transtornos de Ansiedade, Crises de Pânico e Depressão', 6),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'saude_burnout', 'Esgotamento Psicológico e Síndrome de Burnout', 7),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'saude_disturbios_sono', 'Distúrbios de Sono, Insônia e Saúde Psicossomática', 8),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 'saude_dependencias', 'Dependências Químicas, Alcoolismo e Vícios em Geral', 9),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'saude_envelhecimento', 'Envelhecimento, Doenças Degenerativas e Cuidados Paliativos', 10),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'saude_consolo_luto', 'Conforto no Luto e Consolo para Famílias Enlutadas', 11),

  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 'familia_crises_conjugais', 'Crises Conjugais, Esfriamento Afetivo e Ameaças de Divórcio', 1),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000002', 'familia_separacao_guarda', 'Processos de Separação, Litígios Judiciais e Guarda de Filhos', 2),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', 'familia_reconciliacao', 'Reconciliação Familiar e Restauração de Vínculos Rompidos', 3),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000002', 'familia_conflitos_geracao', 'Conflitos de Geração e Comunicação entre Pais e Filhos', 4),
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000002', 'familia_rebeldia_adolescencia', 'Rebeldia na Adolescência e Condutas de Risco de Jovens', 5),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000002', 'familia_filhos_afastados', 'Filhos Afastados da Fé e Desviados dos Caminhos da Igreja', 6),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000002', 'familia_protecao_criancas', 'Proteção de Crianças contra Más Influências e Abusos', 7),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000002', 'familia_mulheres_tentantes', 'Mulheres Tentantes e Histórico de Abortos Espontâneos', 8),
  ('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000002', 'familia_gestacoes_risco', 'Gestações de Risco e Saúde Materno-Infantil no Parto', 9),
  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000002', 'familia_parentes_agregados', 'Desafios com Parentes Agregados e Convivência Familiar Alargada', 10),

  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000003', 'profissional_desemprego', 'Perda de Emprego, Desemprego Prolongado e Recolocação de Mercado', 1),
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000003', 'profissional_transicao_carreira', 'Transição de Carreira, Mudança de Profissão e Demissões', 2),
  ('20000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000003', 'profissional_processos_seletivos', 'Processos Seletivos, Entrevistas de Emprego e Concursos Públicos', 3),
  ('20000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000003', 'profissional_sobrecarga_assedio', 'Sobrecarga de Trabalho, Conflitos com Chefias e Assédio no Ambiente Laboral', 4),
  ('20000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000003', 'profissional_endividamento', 'Endividamento Crítico, Falência de Negócios e Inadimplência', 5),
  ('20000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000003', 'profissional_causas_juridicas', 'Causas Jurídicas Trabalhistas, Cíveis e Processos de Inventário', 6),
  ('20000000-0000-4000-8000-000000000028', '10000000-0000-4000-8000-000000000003', 'profissional_sustento_basico', 'Provisão do Sustento Básico, Escassez de Alimentos e Recursos', 7),
  ('20000000-0000-4000-8000-000000000029', '10000000-0000-4000-8000-000000000003', 'profissional_vestibulares', 'Vestibulares, Exames Nacionais e Escolhas de Cursos Universitários', 8),
  ('20000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-000000000003', 'profissional_conclusao_estudos', 'Conclusão de Graduações, Pós-Graduações e Monografias', 9),
  ('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000003', 'profissional_gestao_negocios', 'Gestão e Sabedoria para Empresários, Comerciantes e Autônomos', 10),

  ('20000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000004', 'espiritual_desanimo_fe', 'Desânimo Espiritual, Crises de Fé, Dúvidas e Frieza na Devoção', 1),
  ('20000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000004', 'espiritual_fortalezas_mentais', 'Pecados de Estimação, Fortalezas Mentais e Luta contra a Carne', 2),
  ('20000000-0000-4000-8000-000000000034', '10000000-0000-4000-8000-000000000004', 'espiritual_disciplinas', 'Disciplinas Espirituais, Leitura Bíblica Consistente e Vida de Oração', 3),
  ('20000000-0000-4000-8000-000000000035', '10000000-0000-4000-8000-000000000004', 'espiritual_dons_chamado', 'Descoberta de Dons, Vocação Ministerial e Chamado Pastoral', 4),
  ('20000000-0000-4000-8000-000000000036', '10000000-0000-4000-8000-000000000004', 'espiritual_pastor_auxiliares', 'Proteção Integral, Saúde e Sabedoria para o Pastor Titular e Auxiliares', 5),
  ('20000000-0000-4000-8000-000000000037', '10000000-0000-4000-8000-000000000004', 'espiritual_familia_pastores', 'Sustento Emocional e Espiritual para Cônjuges e Filhos de Pastores', 6),
  ('20000000-0000-4000-8000-000000000038', '10000000-0000-4000-8000-000000000004', 'espiritual_unidade_lideranca', 'Unidade, Alinhamento de Visão e Proteção contra Divisões na Liderança', 7),
  ('20000000-0000-4000-8000-000000000039', '10000000-0000-4000-8000-000000000004', 'espiritual_celulas_redes', 'Consolidação e Frutificação de Células, Pequenos Grupos e Redes de Discipulado', 8),
  ('20000000-0000-4000-8000-000000000040', '10000000-0000-4000-8000-000000000004', 'espiritual_novos_convertidos', 'Integração de Novos Convertidos e Processos de Discipulado Inicial', 9),
  ('20000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000004', 'espiritual_ministerios', 'Dinamização dos Ministérios de Louvor, Crianças, Teatro e Ação Social', 10),
  ('20000000-0000-4000-8000-000000000042', '10000000-0000-4000-8000-000000000004', 'espiritual_missionarios', 'Missionários no Campo Transcultural, Sustento Financeiro e Vistos de Permanência', 11),
  ('20000000-0000-4000-8000-000000000043', '10000000-0000-4000-8000-000000000004', 'espiritual_povos_nao_alcancados', 'Povos Não Alcançados, Perseguição Religiosa e Plantação de Novas Igrejas', 12),

  ('20000000-0000-4000-8000-000000000044', '10000000-0000-4000-8000-000000000005', 'gracas_cura_enfermidades', 'Cura de Enfermidades Desenganadas e Alta de Internações Longas', 1),
  ('20000000-0000-4000-8000-000000000045', '10000000-0000-4000-8000-000000000005', 'gracas_livramentos', 'Livramentos de Acidentes, Assaltos, Violência Urbana e Tragédias', 2),
  ('20000000-0000-4000-8000-000000000046', '10000000-0000-4000-8000-000000000005', 'gracas_emprego_promocoes', 'Conquista de Vagas de Emprego, Promoções e Estabilidade Financeira', 3),
  ('20000000-0000-4000-8000-000000000047', '10000000-0000-4000-8000-000000000005', 'gracas_reconciliacoes', 'Reconciliações de Casamentos Desfeitos e Restauração de Filhos', 4),
  ('20000000-0000-4000-8000-000000000048', '10000000-0000-4000-8000-000000000005', 'gracas_aprovacoes', 'Aprovação em Exames Difíceis, Concursos e Conclusão de Estudos', 5),
  ('20000000-0000-4000-8000-000000000049', '10000000-0000-4000-8000-000000000005', 'gracas_batismos_retorno', 'Batismos, Decisões por Cristo e Retorno de Irmãos Afastados', 6),
  ('20000000-0000-4000-8000-000000000050', '10000000-0000-4000-8000-000000000005', 'gracas_nascimentos_bodas', 'Nascimento de Filhos, Aniversários e Celebrações de Bodas', 7),
  ('20000000-0000-4000-8000-000000000051', '10000000-0000-4000-8000-000000000005', 'gracas_conquistas_materiais', 'Aquisição de Casa Própria, Quitação de Dívidas e Conquistas Materiais', 8),
  ('20000000-0000-4000-8000-000000000052', '10000000-0000-4000-8000-000000000005', 'gracas_sustento_diario', 'Fidelidade de Deus em Tempos de Escassez e Sustento Diário', 9),
  ('20000000-0000-4000-8000-000000000053', '10000000-0000-4000-8000-000000000005', 'gracas_obras_igreja', 'Conclusão de Obras na Igreja, Expansão de Ministérios e Paz na Comunidade', 10)
on conflict (id) do update
set
  category_id = excluded.category_id,
  code = excluded.code,
  label = excluded.label,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();
