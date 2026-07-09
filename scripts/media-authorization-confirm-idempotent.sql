-- Patch: idempotência na confirmação da autorização de mídia.
-- Execute no Supabase se media-authorization-schema.sql já foi aplicado antes desta coluna.

alter table public.authorizations
  add column if not exists confirmation_token text null;

create unique index if not exists authorizations_confirmation_token_uidx
  on public.authorizations (confirmation_token)
  where confirmation_token is not null;

-- Depois reexecute scripts/media-authorization-rpc.sql
