-- Paletas de tema persistentes (cores globais do app).
-- Execute no SQL Editor do Supabase.
--
-- Leitura: anon/authenticated (SELECT).
-- Troca da paleta ativa: RPC set_active_paleta (super_admin) ou SQL manual.

create table if not exists public.paletas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  primary_color text not null,
  secondary_color text not null,
  bg_color text not null,
  accent_color text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint paletas_nome_unique unique (nome),
  constraint paletas_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint paletas_secondary_color_hex check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint paletas_bg_color_hex check (bg_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint paletas_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

comment on table public.paletas is
  'Temas visuais globais do app (primary, secondary, background, accent). Apenas uma paleta com is_active = true.';

-- Garante no máximo uma paleta ativa por vez.
create unique index if not exists paletas_only_one_active_idx
  on public.paletas ((true))
  where is_active;

create index if not exists idx_paletas_is_active
  on public.paletas (is_active)
  where is_active;

alter table public.paletas enable row level security;

drop policy if exists paletas_select_anon on public.paletas;

create policy paletas_select_anon
  on public.paletas
  for select
  to anon, authenticated
  using (true);

grant select on public.paletas to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: 6 paletas iniciais (idempotente por nome)
-- ---------------------------------------------------------------------------

insert into public.paletas (nome, primary_color, secondary_color, bg_color, accent_color, is_active)
values
  (
    'Padrão',
    '#10B981',
    '#0F172A',
    '#020617',
    '#34D399',
    true
  ),
  (
    'Acolhimento',
    '#FB7185',
    '#FFF7ED',
    '#1E293B',
    '#FDA4AF',
    false
  ),
  (
    'Tecnológico',
    '#06B6D4',
    '#164E63',
    '#0F172A',
    '#22D3EE',
    false
  ),
  (
    'Serenidade',
    '#818CF8',
    '#312E81',
    '#1E1B4B',
    '#A5B4FC',
    false
  ),
  (
    'Minimalista',
    '#94A3B8',
    '#334155',
    '#0F172A',
    '#E2E8F0',
    false
  ),
  (
    'Vibrante',
    '#FBBF24',
    '#B45309',
    '#1C1917',
    '#FCD34D',
    false
  )
on conflict (nome) do update
  set primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      bg_color = excluded.bg_color,
      accent_color = excluded.accent_color;

-- Garante uma única ativa após seed (preferência: Padrão).
update public.paletas
   set is_active = false
 where nome <> 'Padrão';

update public.paletas
   set is_active = true
 where nome = 'Padrão';

-- ---------------------------------------------------------------------------
-- RPC: ativar paleta (desmarca todas e marca a escolhida)
-- ---------------------------------------------------------------------------

create or replace function public.set_active_paleta(p_paleta_id uuid)
returns public.paletas
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.paletas%rowtype;
begin
  if p_paleta_id is null then
    raise exception 'Informe o id da paleta.';
  end if;

  select *
    into v_row
    from public.paletas p
   where p.id = p_paleta_id;

  if not found then
    raise exception 'Paleta não encontrada.';
  end if;

  update public.paletas
     set is_active = false
   where is_active;

  update public.paletas
     set is_active = true
   where id = p_paleta_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_active_paleta_by_nome(p_nome text)
returns public.paletas
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
begin
  select p.id
    into v_id
    from public.paletas p
   where lower(trim(p.nome)) = lower(trim(coalesce(p_nome, '')))
   limit 1;

  if v_id is null then
    raise exception 'Paleta "%" não encontrada.', coalesce(p_nome, '');
  end if;

  return public.set_active_paleta(v_id);
end;
$$;

grant execute on function public.set_active_paleta(uuid) to anon, authenticated;
grant execute on function public.set_active_paleta_by_nome(text) to anon, authenticated;

notify pgrst, 'reload schema';
