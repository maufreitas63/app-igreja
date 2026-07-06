-- Parte 1/5 — tabela profile_sessions (execute sozinha; aguarde ~30s antes da parte 2)

create table if not exists public.profile_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profile_sessions_profile_id_idx
  on public.profile_sessions (profile_id);

create index if not exists profile_sessions_active_token_idx
  on public.profile_sessions (token)
  where revoked_at is null;

alter table public.profile_sessions enable row level security;
