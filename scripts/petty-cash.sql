-- =============================================================================
-- Pequenos caixas — valor-base e dia de fechamento por caixa, prestação no dia útil seguinte
-- =============================================================================
-- Manutenção: tela maintenance.finance.petty_cash (engrenagem / Finanças e Inteligência)
-- Controle: tela financial.petty_cash (Financeiro, só o responsável do caixa)
-- Comprovante de reposição é obrigatório (bucket privado petty-cash-docs).
-- Aplica: npx supabase db query --linked -f scripts/petty-cash.sql
-- =============================================================================

begin;

create table if not exists public.pequenos_caixas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  nome_caixa text not null,
  responsavel_id uuid not null references public.profiles (id) on delete restrict,
  valor_base numeric(12, 2) not null default 1000.00,
  saldo_atual numeric(12, 2) not null default 1000.00,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pequenos_caixas_nome_check check (length(btrim(nome_caixa)) >= 2),
  constraint pequenos_caixas_valor_base_check check (valor_base = 1000.00),
  constraint pequenos_caixas_saldo_check check (saldo_atual >= 0 and saldo_atual <= valor_base),
  constraint pequenos_caixas_status_check check (status in ('ativo', 'inativo'))
);

create unique index if not exists pequenos_caixas_tenant_nome_idx
  on public.pequenos_caixas (tenant_id, lower(btrim(nome_caixa)));

create index if not exists pequenos_caixas_tenant_status_idx
  on public.pequenos_caixas (tenant_id, status, nome_caixa);

alter table public.pequenos_caixas
  add column if not exists dia_fechamento integer not null default 25;

alter table public.pequenos_caixas drop constraint if exists pequenos_caixas_valor_base_check;
alter table public.pequenos_caixas
  add constraint pequenos_caixas_valor_base_check check (valor_base > 0);

alter table public.pequenos_caixas drop constraint if exists pequenos_caixas_dia_fechamento_check;
alter table public.pequenos_caixas
  add constraint pequenos_caixas_dia_fechamento_check check (dia_fechamento between 1 and 31);

comment on table public.pequenos_caixas is
  'Pequenos caixas da igreja. Cada um tem responsável, valor-base e dia de fechamento próprios.';
comment on column public.pequenos_caixas.valor_base is
  'Limite máximo de recomposição deste caixa.';
comment on column public.pequenos_caixas.dia_fechamento is
  'Dia do mês da prestação. Se cair em fim de semana ou feriado, vale o dia útil seguinte.';

create table if not exists public.pequenos_caixas_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  caixa_id uuid not null references public.pequenos_caixas (id) on delete restrict,
  tipo text not null,
  valor numeric(12, 2) not null,
  descricao text not null,
  data_movimento date not null,
  comprovante_url text not null,
  status_aprovacao text not null default 'pendente',
  criado_por uuid not null references public.profiles (id) on delete restrict,
  decided_at timestamptz null,
  decided_by uuid null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint pequenos_caixas_mov_tipo_check check (tipo in ('despesa', 'reposicao')),
  constraint pequenos_caixas_mov_valor_check check (valor > 0),
  constraint pequenos_caixas_mov_descricao_check check (length(btrim(descricao)) >= 3),
  constraint pequenos_caixas_mov_status_check check (status_aprovacao in ('pendente', 'aprovado', 'rejeitado')),
  constraint pequenos_caixas_mov_comprovante_check check (length(btrim(comprovante_url)) > 0)
);

create index if not exists pequenos_caixas_mov_caixa_idx
  on public.pequenos_caixas_movimentacoes (caixa_id, data_movimento desc, created_at desc);

create index if not exists pequenos_caixas_mov_pendente_idx
  on public.pequenos_caixas_movimentacoes (caixa_id)
  where status_aprovacao = 'pendente';

comment on table public.pequenos_caixas_movimentacoes is
  'Despesas e reposições do pequeno caixa. O comprovante fica no bucket petty-cash-docs e o histórico não é apagado.';
comment on column public.pequenos_caixas_movimentacoes.comprovante_url is
  'Caminho do arquivo no bucket privado petty-cash-docs (não é URL pública).';

alter table public.pequenos_caixas_movimentacoes
  add column if not exists motivo_decisao text;

comment on column public.pequenos_caixas_movimentacoes.motivo_decisao is
  'Motivo informado na rejeição, para o responsável corrigir e reenviar.';

alter table public.pequenos_caixas enable row level security;
alter table public.pequenos_caixas_movimentacoes enable row level security;

revoke all on public.pequenos_caixas from public, anon, authenticated;
revoke all on public.pequenos_caixas_movimentacoes from public, anon, authenticated;

create or replace function public.petty_cash_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pequenos_caixas_touch_updated_at on public.pequenos_caixas;
create trigger pequenos_caixas_touch_updated_at
  before update on public.pequenos_caixas
  for each row
  execute function public.petty_cash_touch_updated_at();

-- Domingo de Páscoa (algoritmo gregoriano anônimo).
create or replace function public.petty_cash_easter_sunday(p_year integer)
returns date
language plpgsql
immutable
as $$
declare
  a integer;
  b integer;
  c integer;
  d integer;
  e integer;
  f integer;
  g integer;
  h integer;
  i integer;
  k integer;
  l integer;
  m integer;
  v_month integer;
  v_day integer;
begin
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  v_month := (h + l - 7 * m + 114) / 31;
  v_day := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, v_month, v_day);
end;
$$;

create or replace function public.petty_cash_is_holiday(p_date date)
returns boolean
language plpgsql
immutable
as $$
declare
  v_year integer;
  v_easter date;
  v_month_day text;
begin
  v_year := extract(year from p_date)::integer;
  v_easter := public.petty_cash_easter_sunday(v_year);
  v_month_day := to_char(p_date, 'MM-DD');

  if v_month_day in ('01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25') then
    return true;
  end if;

  -- Segunda e terça de carnaval, sexta-feira santa e Corpus Christi.
  if p_date in (v_easter - 48, v_easter - 47, v_easter - 2, v_easter + 60) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.petty_cash_shift_to_business_day(p_date date)
returns date
language plpgsql
immutable
as $$
declare
  v_date date := p_date;
  v_guard integer := 0;
begin
  while extract(dow from v_date) in (0, 6) or public.petty_cash_is_holiday(v_date) loop
    v_date := v_date + 1;
    v_guard := v_guard + 1;
    if v_guard > 14 then
      return v_date;
    end if;
  end loop;

  return v_date;
end;
$$;

create or replace function public.petty_cash_month_deadline(p_anchor date, p_day integer)
returns date
language plpgsql
immutable
as $$
declare
  v_last integer;
  v_day integer;
begin
  v_last := extract(
    day from (date_trunc('month', p_anchor::timestamp) + interval '1 month - 1 day')::date
  )::integer;
  v_day := least(greatest(coalesce(p_day, 25), 1), v_last);
  return public.petty_cash_shift_to_business_day(make_date(
    extract(year from p_anchor)::integer,
    extract(month from p_anchor)::integer,
    v_day
  ));
end;
$$;

create or replace function public.petty_cash_receipt_exists(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from storage.objects o
     where o.bucket_id = 'petty-cash-docs'
       and o.name = btrim(coalesce(p_path, ''))
       and (
         coalesce(o.metadata->>'mimetype', o.metadata->>'contentType', '') like 'image/%'
         or lower(o.name) ~ '\.(jpe?g|png|webp)$'
       )
  );
$$;

create or replace function public.petty_cash_deadline_for_today()
returns date
language plpgsql
stable
as $$
declare
  v_today date;
  v_this date;
begin
  v_today := (timezone('America/Sao_Paulo', now()))::date;
  v_this := public.petty_cash_shift_to_business_day(make_date(extract(year from v_today)::integer, extract(month from v_today)::integer, 25));

  if v_today <= v_this then
    return v_this;
  end if;

  return public.petty_cash_shift_to_business_day(
    make_date(
      extract(year from (v_today + interval '1 month'))::integer,
      extract(month from (v_today + interval '1 month'))::integer,
      25
    )
  );
end;
$$;

create or replace function public.petty_cash_require_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  perform public.require_session_tenant_id();
  v_actor := public.current_session_profile_id();

  if v_actor is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  return v_actor;
end;
$$;

create or replace function public.petty_cash_storage_parts(p_name text)
returns table (tenant_id uuid, caixa_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[];
begin
  v_parts := storage.foldername(p_name);

  if v_parts is null or cardinality(v_parts) < 2 then
    return;
  end if;

  if v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return;
  end if;

  tenant_id := v_parts[1]::uuid;
  caixa_id := v_parts[2]::uuid;
  return next;
end;
$$;

create or replace function public.petty_cash_storage_can_write(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_caixa uuid;
  v_session uuid;
begin
  select parts.tenant_id, parts.caixa_id
    into v_tenant, v_caixa
    from public.petty_cash_storage_parts(p_name) parts;

  v_session := public.current_session_tenant_id();

  if v_tenant is null or v_caixa is null or v_session is null or v_tenant is distinct from v_session then
    return false;
  end if;

  return exists (
    select 1
      from public.pequenos_caixas c
     where c.id = v_caixa
       and c.tenant_id = v_tenant
       and c.status = 'ativo'
       and c.responsavel_id = public.current_session_profile_id()
       and public.session_has_screen_access('financial.petty_cash', 'view')
  );
end;
$$;

create or replace function public.petty_cash_storage_can_read(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_caixa uuid;
  v_session uuid;
begin
  if public.petty_cash_storage_can_write(p_name) then
    return true;
  end if;

  select parts.tenant_id, parts.caixa_id
    into v_tenant, v_caixa
    from public.petty_cash_storage_parts(p_name) parts;

  v_session := public.current_session_tenant_id();

  if v_tenant is null or v_caixa is null or v_session is null or v_tenant is distinct from v_session then
    return false;
  end if;

  return public.session_has_screen_access('maintenance.finance.petty_cash', 'view')
    and exists (
      select 1
        from public.pequenos_caixas c
       where c.id = v_caixa
         and c.tenant_id = v_tenant
    );
end;
$$;

create or replace function public.petty_cash_caixa_json(p_caixa public.pequenos_caixas)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_corte timestamptz;
  v_despesas numeric(12, 2);
  v_pendente_despesa integer;
  v_pendente_reposicao integer;
  v_prazo date;
  v_nome text;
  v_today date;
  v_this date;
  v_due date;
  v_upcoming date;
  v_oldest date;
  v_anchor date;
  v_atrasada boolean := false;
  v_proxima boolean := false;
  v_reenvio boolean := false;
  v_dias integer := 0;
begin
  select max(m.decided_at)
    into v_corte
    from public.pequenos_caixas_movimentacoes m
   where m.caixa_id = p_caixa.id
     and m.tipo = 'reposicao'
     and m.status_aprovacao = 'aprovado';

  select coalesce(sum(m.valor), 0)
    into v_despesas
    from public.pequenos_caixas_movimentacoes m
   where m.caixa_id = p_caixa.id
     and m.tipo = 'despesa'
     and m.status_aprovacao = 'aprovado'
     and (v_corte is null or m.decided_at > v_corte);

  select count(*) filter (where m.tipo = 'despesa'),
         count(*) filter (where m.tipo = 'reposicao')
    into v_pendente_despesa, v_pendente_reposicao
    from public.pequenos_caixas_movimentacoes m
   where m.caixa_id = p_caixa.id
     and m.status_aprovacao = 'pendente';

  select p.full_name
    into v_nome
    from public.profiles p
   where p.id = p_caixa.responsavel_id;

  v_today := (timezone('America/Sao_Paulo', now()))::date;
  v_this := public.petty_cash_month_deadline(v_today, p_caixa.dia_fechamento);
  v_anchor := (date_trunc('month', v_today::timestamp) - interval '1 month')::date;

  if v_today <= v_this then
    v_due := public.petty_cash_month_deadline(v_anchor, p_caixa.dia_fechamento);
    v_upcoming := v_this;
  else
    v_due := v_this;
    v_anchor := (date_trunc('month', v_today::timestamp) + interval '1 month')::date;
    v_upcoming := public.petty_cash_month_deadline(v_anchor, p_caixa.dia_fechamento);
  end if;

  select min(m.data_movimento)
    into v_oldest
    from public.pequenos_caixas_movimentacoes m
   where m.caixa_id = p_caixa.id
     and m.tipo = 'despesa'
     and m.status_aprovacao = 'aprovado'
     and (v_corte is null or m.decided_at > v_corte);

  v_atrasada := p_caixa.status = 'ativo'
    and p_caixa.saldo_atual < p_caixa.valor_base
    and v_oldest is not null
    and v_oldest <= v_due;

  if v_atrasada then
    v_prazo := v_due;
  else
    v_prazo := v_upcoming;
  end if;

  v_dias := v_prazo - v_today;

  select exists (
    select 1
      from public.pequenos_caixas_movimentacoes m
     where m.caixa_id = p_caixa.id
       and m.status_aprovacao = 'rejeitado'
       and not exists (
         select 1
           from public.pequenos_caixas_movimentacoes n
          where n.caixa_id = m.caixa_id
            and n.tipo = m.tipo
            and n.created_at > m.created_at
            and n.status_aprovacao in ('pendente', 'aprovado')
       )
  )
    into v_reenvio;

  v_proxima := p_caixa.status = 'ativo'
    and not v_atrasada
    and v_dias between 0 and 5
    and (
      p_caixa.saldo_atual < p_caixa.valor_base
      or coalesce(v_pendente_despesa, 0) > 0
      or coalesce(v_pendente_reposicao, 0) > 0
      or v_reenvio
    );

  return jsonb_build_object(
    'id', p_caixa.id,
    'nome_caixa', p_caixa.nome_caixa,
    'responsavel_id', p_caixa.responsavel_id,
    'responsavel_nome', coalesce(v_nome, ''),
    'valor_base', p_caixa.valor_base,
    'dia_fechamento', p_caixa.dia_fechamento,
    'saldo_inicial', p_caixa.valor_base,
    'total_despesas', v_despesas,
    'saldo_atual', p_caixa.saldo_atual,
    'saldo_remanescente', p_caixa.saldo_atual,
    'valor_recomposicao', round(p_caixa.valor_base - p_caixa.saldo_atual, 2),
    'status', p_caixa.status,
    'despesas_pendentes', coalesce(v_pendente_despesa, 0),
    'reposicao_pendente', coalesce(v_pendente_reposicao, 0) > 0,
    'prazo', v_prazo,
    'dias_para_prazo', v_dias,
    'prestacao_atrasada', v_atrasada,
    'prestacao_proxima', v_proxima,
    'reenvio_pendente', v_reenvio
  );
end;
$$;

create or replace function public.petty_cash_listar_responsaveis()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_actor uuid;
begin
  v_tenant := public.require_session_tenant_id();
  v_actor := public.petty_cash_require_actor();

  if not public.session_has_screen_access('maintenance.finance.petty_cash', 'view') then
    raise exception 'Você não tem permissão para manter os pequenos caixas.';
  end if;

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.full_name) order by p.full_name)
      from public.profiles p
     where public.profile_belongs_to_tenant(p.id, v_tenant)
       and public.profile_visible_to_access_actor(v_actor, p.id)
       and length(btrim(coalesce(p.full_name, ''))) > 0
  ), '[]'::jsonb);
end;
$$;

create or replace function public.petty_cash_listar_caixas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_rows jsonb;
begin
  v_tenant := public.require_session_tenant_id();
  perform public.petty_cash_require_actor();

  if not public.session_has_screen_access('maintenance.finance.petty_cash', 'view') then
    raise exception 'Você não tem permissão para manter os pequenos caixas.';
  end if;

  select coalesce(jsonb_agg(public.petty_cash_caixa_json(c) order by c.status, c.nome_caixa), '[]'::jsonb)
    into v_rows
    from public.pequenos_caixas c
   where c.tenant_id = v_tenant;

  return jsonb_build_object(
    'prazo', public.petty_cash_deadline_for_today(),
    'caixas', v_rows
  );
end;
$$;

create or replace function public.petty_cash_meus_caixas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_rows jsonb;
begin
  v_tenant := public.require_session_tenant_id();
  v_actor := public.petty_cash_require_actor();

  if not public.session_has_screen_access('financial.petty_cash', 'view') then
    raise exception 'Você não tem permissão para controlar um pequeno caixa.';
  end if;

  select coalesce(jsonb_agg(public.petty_cash_caixa_json(c) order by c.nome_caixa), '[]'::jsonb)
    into v_rows
    from public.pequenos_caixas c
   where c.tenant_id = v_tenant
     and c.responsavel_id = v_actor
     and c.status = 'ativo';

  return jsonb_build_object(
    'prazo', public.petty_cash_deadline_for_today(),
    'caixas', v_rows
  );
end;
$$;

create or replace function public.petty_cash_assert_reader(p_caixa_id uuid)
returns public.pequenos_caixas
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_caixa public.pequenos_caixas;
begin
  v_tenant := public.require_session_tenant_id();
  v_actor := public.petty_cash_require_actor();

  select *
    into v_caixa
    from public.pequenos_caixas c
   where c.id = p_caixa_id
     and c.tenant_id = v_tenant;

  if v_caixa.id is null then
    raise exception 'Pequeno caixa não encontrado.';
  end if;

  if public.session_has_screen_access('maintenance.finance.petty_cash', 'view') then
    return v_caixa;
  end if;

  if v_caixa.responsavel_id = v_actor
     and public.session_has_screen_access('financial.petty_cash', 'view') then
    return v_caixa;
  end if;

  raise exception 'Você não tem permissão para ver este caixa.';
end;
$$;

create or replace function public.petty_cash_movimentos(p_caixa_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.petty_cash_assert_reader(p_caixa_id);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'tipo', m.tipo,
        'valor', m.valor,
        'descricao', m.descricao,
        'data_movimento', m.data_movimento,
        'comprovante_url', m.comprovante_url,
        'status_aprovacao', m.status_aprovacao,
        'motivo_decisao', m.motivo_decisao,
        'criado_por', m.criado_por,
        'created_at', m.created_at
      )
      order by m.data_movimento desc, m.created_at desc
    )
      from public.pequenos_caixas_movimentacoes m
     where m.caixa_id = p_caixa_id
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.petty_cash_salvar_caixa(uuid, text, uuid, text);

create or replace function public.petty_cash_salvar_caixa(
  p_id uuid,
  p_nome text,
  p_responsavel_id uuid,
  p_status text,
  p_valor_base numeric,
  p_dia_fechamento integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_nome text;
  v_status text;
  v_base numeric(12, 2);
  v_dia integer;
  v_caixa public.pequenos_caixas;
begin
  v_tenant := public.require_session_tenant_id();
  v_actor := public.petty_cash_require_actor();
  v_nome := btrim(coalesce(p_nome, ''));
  v_status := lower(btrim(coalesce(p_status, 'ativo')));
  v_base := round(coalesce(p_valor_base, 1000), 2);
  v_dia := coalesce(p_dia_fechamento, 25);

  if not public.session_has_screen_access('maintenance.finance.petty_cash', 'update') then
    raise exception 'Você não tem permissão para criar ou alterar pequenos caixas.';
  end if;

  if length(v_nome) < 2 then
    raise exception 'Informe o nome do caixa.';
  end if;

  if v_status not in ('ativo', 'inativo') then
    raise exception 'Situação inválida.';
  end if;

  if v_base <= 0 or v_base > 1000000 then
    raise exception 'Informe um valor-base maior que zero.';
  end if;

  if v_dia < 1 or v_dia > 31 then
    raise exception 'O dia de fechamento precisa estar entre 1 e 31.';
  end if;

  if p_responsavel_id is null then
    raise exception 'Escolha o responsável pelo caixa.';
  end if;

  if not public.profile_belongs_to_tenant(p_responsavel_id, v_tenant) then
    raise exception 'O responsável precisa pertencer a esta igreja.';
  end if;

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  if not public.profile_visible_to_access_actor(v_actor, p_responsavel_id) then
    raise exception 'Este perfil não pode ser escolhido como responsável.';
  end if;

  if p_id is null then
    insert into public.pequenos_caixas (
      tenant_id, nome_caixa, responsavel_id, valor_base, saldo_atual, status, dia_fechamento
    )
    values (v_tenant, v_nome, p_responsavel_id, v_base, v_base, v_status, v_dia)
    returning * into v_caixa;
  else
    if exists (
      select 1
        from public.pequenos_caixas c
       where c.id = p_id
         and c.tenant_id = v_tenant
         and c.saldo_atual > v_base
    ) then
      raise exception 'O valor-base não pode ficar abaixo do saldo atual.';
    end if;

    update public.pequenos_caixas c
       set nome_caixa = v_nome,
           responsavel_id = p_responsavel_id,
           status = v_status,
           valor_base = v_base,
           dia_fechamento = v_dia
     where c.id = p_id
       and c.tenant_id = v_tenant
    returning * into v_caixa;

    if v_caixa.id is null then
      raise exception 'Pequeno caixa não encontrado.';
    end if;
  end if;

  return public.petty_cash_caixa_json(v_caixa);
exception
  when unique_violation then
    raise exception 'Já existe um pequeno caixa com esse nome.';
end;
$$;

create or replace function public.petty_cash_registrar_movimento(
  p_caixa_id uuid,
  p_tipo text,
  p_valor numeric,
  p_descricao text,
  p_data date,
  p_comprovante_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_caixa public.pequenos_caixas;
  v_tipo text;
  v_descricao text;
  v_path text;
  v_valor numeric(12, 2);
  v_reservado numeric(12, 2);
  v_today date;
  v_id uuid;
begin
  v_tenant := public.require_session_tenant_id();
  v_actor := public.petty_cash_require_actor();
  v_tipo := lower(btrim(coalesce(p_tipo, '')));
  v_descricao := btrim(coalesce(p_descricao, ''));
  v_path := btrim(coalesce(p_comprovante_path, ''));
  v_today := (timezone('America/Sao_Paulo', now()))::date;

  if not public.session_has_screen_access('financial.petty_cash', 'view') then
    raise exception 'Você não tem permissão para controlar um pequeno caixa.';
  end if;

  select *
    into v_caixa
    from public.pequenos_caixas c
   where c.id = p_caixa_id
     and c.tenant_id = v_tenant
   for update;

  if v_caixa.id is null then
    raise exception 'Pequeno caixa não encontrado.';
  end if;

  if v_caixa.responsavel_id is distinct from v_actor then
    raise exception 'Somente o responsável deste caixa pode registrar movimentações.';
  end if;

  if v_caixa.status <> 'ativo' then
    raise exception 'Este caixa está inativo.';
  end if;

  if v_tipo not in ('despesa', 'reposicao') then
    raise exception 'Tipo de movimentação inválido.';
  end if;

  if length(v_descricao) < 3 then
    raise exception 'Descreva a movimentação.';
  end if;

  if p_data is null or p_data > v_today then
    raise exception 'Informe uma data válida, até hoje.';
  end if;

  if v_path = '' then
    raise exception 'Anexe a imagem do comprovante para concluir o registro.';
  end if;

  if lower(v_path) not like lower(v_tenant::text) || '/' || lower(p_caixa_id::text) || '/%' then
    raise exception 'O comprovante não pertence a este caixa.';
  end if;

  if exists (
    select 1
      from public.pequenos_caixas_movimentacoes m
     where m.caixa_id = v_caixa.id
       and m.tipo = 'reposicao'
       and m.status_aprovacao = 'pendente'
  ) then
    raise exception 'Há uma reposição aguardando conferência.';
  end if;

  if v_tipo = 'reposicao' then
    if exists (
      select 1
        from public.pequenos_caixas_movimentacoes m
       where m.caixa_id = v_caixa.id
         and m.tipo = 'despesa'
         and m.status_aprovacao = 'pendente'
    ) then
      raise exception 'Confira as despesas pendentes antes de pedir a reposição.';
    end if;

    v_valor := round(v_caixa.valor_base - v_caixa.saldo_atual, 2);

    if not public.petty_cash_receipt_exists(v_path) then
      raise exception 'A reposição só pode ser registrada com a imagem do comprovante salva no armazenamento.';
    end if;

    if v_valor <= 0 then
      raise exception 'O caixa já está no valor-base.';
    end if;

    v_descricao := 'Reposição ao valor-base';
  else
    v_valor := round(coalesce(p_valor, 0), 2);

    if v_valor <= 0 then
      raise exception 'Informe um valor maior que zero.';
    end if;

    select coalesce(sum(m.valor), 0)
      into v_reservado
      from public.pequenos_caixas_movimentacoes m
     where m.caixa_id = v_caixa.id
       and m.tipo = 'despesa'
       and m.status_aprovacao = 'pendente';

    if v_valor > round(v_caixa.saldo_atual - v_reservado, 2) then
      raise exception 'O valor passa do saldo disponível deste caixa.';
    end if;
  end if;

  insert into public.pequenos_caixas_movimentacoes (
    tenant_id, caixa_id, tipo, valor, descricao, data_movimento, comprovante_url, criado_por
  )
  values (
    v_tenant, v_caixa.id, v_tipo, v_valor, v_descricao, p_data, v_path, v_actor
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'valor', v_valor, 'tipo', v_tipo);
end;
$$;

drop function if exists public.petty_cash_decidir(uuid, text);

create or replace function public.petty_cash_decidir(
  p_movimento_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_decisao text;
  v_motivo text;
  v_mov public.pequenos_caixas_movimentacoes;
  v_caixa public.pequenos_caixas;
begin
  v_tenant := public.require_session_tenant_id();
  v_actor := public.petty_cash_require_actor();
  v_decisao := lower(btrim(coalesce(p_decisao, '')));
  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');

  if not public.session_has_screen_access('maintenance.finance.petty_cash', 'update') then
    raise exception 'Você não tem permissão para conferir os pequenos caixas.';
  end if;

  if v_decisao not in ('aprovado', 'rejeitado') then
    raise exception 'Decisão inválida.';
  end if;

  if v_decisao = 'rejeitado' and length(coalesce(v_motivo, '')) < 3 then
    raise exception 'Informe o motivo da rejeição para o responsável corrigir e reenviar.';
  end if;

  select *
    into v_mov
    from public.pequenos_caixas_movimentacoes m
   where m.id = p_movimento_id
     and m.tenant_id = v_tenant
   for update;

  if v_mov.id is null then
    raise exception 'Movimentação não encontrada.';
  end if;

  if v_mov.status_aprovacao <> 'pendente' then
    raise exception 'Esta movimentação já foi conferida.';
  end if;

  select *
    into v_caixa
    from public.pequenos_caixas c
   where c.id = v_mov.caixa_id
     and c.tenant_id = v_tenant
   for update;

  if v_decisao = 'aprovado' and v_mov.tipo = 'despesa' then
    if exists (
      select 1
        from public.pequenos_caixas_movimentacoes m
       where m.caixa_id = v_caixa.id
         and m.tipo = 'reposicao'
         and m.status_aprovacao = 'pendente'
    ) then
      raise exception 'Há uma reposição pendente. Decida-a antes de aprovar nova despesa.';
    end if;

    update public.pequenos_caixas c
       set saldo_atual = round(c.saldo_atual - v_mov.valor, 2)
     where c.id = v_caixa.id
       and c.saldo_atual >= v_mov.valor;

    if not found then
      raise exception 'Saldo insuficiente para aprovar esta despesa.';
    end if;
  elsif v_decisao = 'aprovado' and v_mov.tipo = 'reposicao' then
    if not public.petty_cash_receipt_exists(v_mov.comprovante_url) then
      raise exception 'A reposição só pode ser aprovada com a imagem do comprovante salva no armazenamento.';
    end if;

    if exists (
      select 1
        from public.pequenos_caixas_movimentacoes m
       where m.caixa_id = v_caixa.id
         and m.tipo = 'despesa'
         and m.status_aprovacao = 'pendente'
         and m.id <> v_mov.id
    ) then
      raise exception 'Ainda há despesas pendentes de conferência.';
    end if;

    if round(v_caixa.valor_base - v_caixa.saldo_atual, 2) <> v_mov.valor then
      raise exception 'O saldo mudou desde o pedido. Rejeite esta reposição e registre outra.';
    end if;

    update public.pequenos_caixas c
       set saldo_atual = c.valor_base
     where c.id = v_caixa.id;
  end if;

  update public.pequenos_caixas_movimentacoes m
     set status_aprovacao = v_decisao,
         decided_at = now(),
         decided_by = v_actor,
         motivo_decisao = case when v_decisao = 'rejeitado' then v_motivo else null end
   where m.id = v_mov.id;

  select *
    into v_caixa
    from public.pequenos_caixas c
   where c.id = v_mov.caixa_id;

  return public.petty_cash_caixa_json(v_caixa);
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'petty-cash-docs',
  'petty-cash-docs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists petty_cash_docs_select on storage.objects;
drop policy if exists petty_cash_docs_insert on storage.objects;
drop policy if exists petty_cash_docs_delete on storage.objects;

create policy petty_cash_docs_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'petty-cash-docs'
    and public.petty_cash_storage_can_read(name)
  );

create policy petty_cash_docs_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'petty-cash-docs'
    and public.petty_cash_storage_can_write(name)
  );

create policy petty_cash_docs_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'petty-cash-docs'
    and public.petty_cash_storage_can_write(name)
  );

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.finance.petty_cash',
    'Pequenos caixas (manutenção)',
    'Cria e mantém os pequenos caixas, escolhe o responsável e confere despesas e reposições.',
    true
  ),
  (
    'screen',
    'financial.petty_cash',
    'Controle do pequeno caixa',
    'Registra despesas e a reposição do caixa do qual a pessoa é responsável.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.finance.petty_cash'
 where r.code in ('super_admin', 'tesoureiro')
on conflict (role_id, resource_id) where (role_id is not null) do nothing;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'financial.petty_cash'
 where r.code in ('super_admin', 'tesoureiro')
on conflict (role_id, resource_id) where (role_id is not null) do nothing;

revoke all on function public.petty_cash_easter_sunday(integer) from public, anon, authenticated;
revoke all on function public.petty_cash_is_holiday(date) from public, anon, authenticated;
revoke all on function public.petty_cash_shift_to_business_day(date) from public, anon, authenticated;
revoke all on function public.petty_cash_month_deadline(date, integer) from public, anon, authenticated;
revoke all on function public.petty_cash_receipt_exists(text) from public, anon, authenticated;
revoke all on function public.petty_cash_deadline_for_today() from public, anon, authenticated;
revoke all on function public.petty_cash_require_actor() from public, anon, authenticated;
revoke all on function public.petty_cash_storage_parts(text) from public, anon, authenticated;
revoke all on function public.petty_cash_caixa_json(public.pequenos_caixas) from public, anon, authenticated;
revoke all on function public.petty_cash_assert_reader(uuid) from public, anon, authenticated;
revoke all on function public.petty_cash_touch_updated_at() from public, anon, authenticated;

grant execute on function public.petty_cash_storage_can_read(text) to anon, authenticated;
grant execute on function public.petty_cash_storage_can_write(text) to anon, authenticated;
grant execute on function public.petty_cash_listar_responsaveis() to anon, authenticated;
grant execute on function public.petty_cash_listar_caixas() to anon, authenticated;
grant execute on function public.petty_cash_meus_caixas() to anon, authenticated;
grant execute on function public.petty_cash_movimentos(uuid) to anon, authenticated;
grant execute on function public.petty_cash_salvar_caixa(uuid, text, uuid, text, numeric, integer) to anon, authenticated;
grant execute on function public.petty_cash_registrar_movimento(uuid, text, numeric, text, date, text) to anon, authenticated;
grant execute on function public.petty_cash_decidir(uuid, text, text) to anon, authenticated;

alter function public.petty_cash_require_actor() set row_security = off;
alter function public.petty_cash_storage_can_read(text) set row_security = off;
alter function public.petty_cash_storage_can_write(text) set row_security = off;
alter function public.petty_cash_caixa_json(public.pequenos_caixas) set row_security = off;
alter function public.petty_cash_listar_responsaveis() set row_security = off;
alter function public.petty_cash_listar_caixas() set row_security = off;
alter function public.petty_cash_meus_caixas() set row_security = off;
alter function public.petty_cash_assert_reader(uuid) set row_security = off;
alter function public.petty_cash_movimentos(uuid) set row_security = off;
alter function public.petty_cash_receipt_exists(text) set row_security = off;
alter function public.petty_cash_salvar_caixa(uuid, text, uuid, text, numeric, integer) set row_security = off;
alter function public.petty_cash_registrar_movimento(uuid, text, numeric, text, date, text) set row_security = off;
alter function public.petty_cash_decidir(uuid, text, text) set row_security = off;

notify pgrst, 'reload schema';

commit;
