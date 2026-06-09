-- Estrutura generica de escalas (multiplos tipos) e automacao.
--
-- Execute este script no SQL Editor do Supabase.
-- Remove tabelas legadas da vigilancia, se ainda existirem.

create extension if not exists pgcrypto;

-- ============================================================
-- Remocao do modelo legado (voluntarios_vigilancia / escalas_vigilancia_log)
-- ============================================================

drop function if exists public.listar_escalas_vigilancia();
drop function if exists public.gerar_escala_vigilancia(date, integer);
drop function if exists public.set_updated_at_voluntarios_vigilancia();

-- Tabelas primeiro (CASCADE remove triggers/policies). Evita erro se o legado já foi apagado.
drop table if exists public.escalas_vigilancia_log cascade;
drop table if exists public.voluntarios_vigilancia cascade;

-- ============================================================
-- Modelo generico
-- ============================================================

create table if not exists public.tipos_escala (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  is_ativa boolean not null default true,
  vagas_por_servico integer not null default 1 check (vagas_por_servico >= 1 and vagas_por_servico <= 50),
  modo_ciclo text not null default 'individual' check (modo_ciclo in ('individual', 'equipe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voluntarios_escala (
  id uuid primary key default gen_random_uuid(),
  tipo_escala_id uuid not null references public.tipos_escala(id) on delete cascade,
  nome text not null,
  is_ativo boolean not null default true,
  data_ultima_escala date default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voluntarios_escala_unique unique (tipo_escala_id, nome)
);

create table if not exists public.escalas_log (
  id uuid primary key default gen_random_uuid(),
  tipo_escala_id uuid not null references public.tipos_escala(id) on delete cascade,
  voluntario_id uuid not null references public.voluntarios_escala(id) on delete cascade,
  data_servico date not null,
  created_at timestamptz not null default now(),
  constraint escalas_log_unique unique (tipo_escala_id, voluntario_id, data_servico)
);

create index if not exists idx_tipos_escala_is_ativa_nome
  on public.tipos_escala (is_ativa, nome);

create index if not exists idx_voluntarios_escala_tipo_ativo_data
  on public.voluntarios_escala (tipo_escala_id, is_ativo, data_ultima_escala, nome);

create index if not exists idx_escalas_log_tipo_data
  on public.escalas_log (tipo_escala_id, data_servico);

drop trigger if exists trg_set_updated_at_tipos_escala on public.tipos_escala;
drop trigger if exists trg_set_updated_at_voluntarios_escala on public.voluntarios_escala;
drop function if exists public.set_updated_at_escalas_genericas();

create or replace function public.set_updated_at_escalas_genericas()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_set_updated_at_tipos_escala
before update on public.tipos_escala
for each row
execute function public.set_updated_at_escalas_genericas();

create trigger trg_set_updated_at_voluntarios_escala
before update on public.voluntarios_escala
for each row
execute function public.set_updated_at_escalas_genericas();

insert into public.tipos_escala (codigo, nome, is_ativa)
values ('vigilancia_estacionamento', 'Vigilancia do Estacionamento', true)
on conflict (codigo) do update
set
  nome = excluded.nome,
  is_ativa = excluded.is_ativa,
  updated_at = now();

update public.voluntarios_escala ve
set data_ultima_escala = ultima.max_data
from (
  select
    el.voluntario_id,
    max(el.data_servico) as max_data
  from public.escalas_log el
  group by el.voluntario_id
) as ultima
where ultima.voluntario_id = ve.id;

-- Gerador legado desativado (C2). Geração em lote: app → Gerar ciclo em bloco.
drop function if exists public.gerar_escala_por_codigo(text, date, integer);

create or replace function public.gerar_escala_por_codigo(
  p_tipo_escala_codigo text,
  p_data_servico date,
  p_num_vagas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'success', false,
    'deprecated', true,
    'code', 'LEGACY_GENERATOR_DISABLED',
    'message',
      'Gerador SQL legado desativado. Use Manutenção → Escalas → Gerar ciclo em bloco '
      || '(ordem_sequencial crescente, um servo por domingo livre após a maior data_servico).',
    'replacement', 'app:lib/maintenanceScaleCycle.ts'
  );
end;
$$;

drop function if exists public.listar_tipos_escala();

create or replace function public.listar_tipos_escala()
returns table (
  id uuid,
  codigo text,
  nome text
)
language sql
security definer
set search_path = public
as $$
  select
    te.id,
    te.codigo,
    te.nome
  from public.tipos_escala te
  where te.is_ativa = true
  order by te.nome asc;
$$;

drop function if exists public.listar_escalas();

create or replace function public.listar_escalas()
returns table (
  id uuid,
  tipo_escala_id uuid,
  tipo_escala_codigo text,
  tipo_escala_nome text,
  data_servico date,
  voluntario_id uuid,
  volunteer_name text
)
language sql
security definer
set search_path = public
as $$
  select
    el.id,
    te.id as tipo_escala_id,
    te.codigo as tipo_escala_codigo,
    te.nome as tipo_escala_nome,
    el.data_servico,
    el.voluntario_id,
    ve.nome as volunteer_name
  from public.escalas_log el
  join public.tipos_escala te
    on te.id = el.tipo_escala_id
  join public.voluntarios_escala ve
    on ve.id = el.voluntario_id
  order by te.nome asc, el.data_servico asc, el.created_at asc, ve.nome asc;
$$;

drop function if exists public.gerar_escala_vigilancia(date, integer);

create or replace function public.gerar_escala_vigilancia(
  p_data_domingo date,
  p_num_vagas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.gerar_escala_por_codigo('vigilancia_estacionamento', p_data_domingo, p_num_vagas);
end;
$$;

alter table public.tipos_escala enable row level security;
alter table public.voluntarios_escala enable row level security;
alter table public.escalas_log enable row level security;

drop policy if exists tipos_escala_select_policy on public.tipos_escala;
create policy tipos_escala_select_policy
on public.tipos_escala
for select
to anon, authenticated
using (true);

drop policy if exists voluntarios_escala_select_policy on public.voluntarios_escala;
create policy voluntarios_escala_select_policy
on public.voluntarios_escala
for select
to anon, authenticated
using (true);

drop policy if exists escalas_log_select_policy on public.escalas_log;
create policy escalas_log_select_policy
on public.escalas_log
for select
to anon, authenticated
using (true);

grant select on public.tipos_escala to anon;
grant select on public.tipos_escala to authenticated;
grant select on public.voluntarios_escala to anon;
grant select on public.voluntarios_escala to authenticated;
grant select on public.escalas_log to anon;
grant select on public.escalas_log to authenticated;

grant execute on function public.gerar_escala_por_codigo(text, date, integer) to anon;
grant execute on function public.gerar_escala_por_codigo(text, date, integer) to authenticated;
grant execute on function public.listar_tipos_escala() to anon;
grant execute on function public.listar_tipos_escala() to authenticated;
grant execute on function public.listar_escalas() to anon;
grant execute on function public.listar_escalas() to authenticated;
grant execute on function public.gerar_escala_vigilancia(date, integer) to anon;
grant execute on function public.gerar_escala_vigilancia(date, integer) to authenticated;
