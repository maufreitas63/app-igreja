-- =============================================================================
-- Patch: bucket ptt-audio aceita webm/ogg/mp4 (sem rejeitar gravação do browser)
-- =============================================================================
-- Erro no Walkie-Talkie: "mime type audio/webm;codecs=opus is not supported"
-- O app já envia content-type sem codecs; este script amplia o allowlist do bucket.
-- Execute no SQL Editor do Supabase.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ptt-audio',
  'ptt-audio',
  true,
  10485760,
  array[
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-m4a',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
