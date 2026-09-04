-- Bucket privado genérico para o APK (e futuros binários).
-- O arquivo não é público: a senha é validada em unlock_app_release.

begin;

create extension if not exists pgcrypto with schema extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-releases',
  'app-releases',
  false,
  209715200,
  array[
    'application/vnd.android.package-archive',
    'application/octet-stream',
    'application/zip'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_releases_storage_select on storage.objects;
drop policy if exists app_releases_storage_insert on storage.objects;
drop policy if exists app_releases_storage_update on storage.objects;
drop policy if exists app_releases_storage_delete on storage.objects;

create table if not exists public.app_releases (
  id text primary key default 'apk',
  bucket_id text not null default 'app-releases',
  object_path text not null,
  file_name text not null,
  password_hash text not null,
  signed_url text,
  signed_url_expires_at timestamptz,
  failed_attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_releases enable row level security;

revoke all on table public.app_releases from public, anon, authenticated;

create or replace function public.publish_app_release(
  p_object_path text,
  p_file_name text,
  p_signed_url text,
  p_signed_url_expires_at timestamptz,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_path text := nullif(trim(coalesce(p_object_path, '')), '');
  v_name text := nullif(trim(coalesce(p_file_name, '')), '');
  v_url text := nullif(trim(coalesce(p_signed_url, '')), '');
  v_password text := nullif(trim(coalesce(p_password, '')), '');
  v_hash text;
begin
  if v_path is null or v_name is null or v_url is null then
    raise exception 'path, file name and signed url are required';
  end if;

  if v_password is not null then
    if char_length(v_password) < 6 then
      raise exception 'password too short';
    end if;
    v_hash := crypt(v_password, gen_salt('bf', 10));
  else
    select password_hash into v_hash from public.app_releases where id = 'apk';
    if v_hash is null then
      raise exception 'password is required on first publish';
    end if;
  end if;

  insert into public.app_releases (
    id,
    bucket_id,
    object_path,
    file_name,
    password_hash,
    signed_url,
    signed_url_expires_at,
    failed_attempts,
    blocked_until,
    updated_at
  )
  values (
    'apk',
    'app-releases',
    v_path,
    v_name,
    v_hash,
    v_url,
    p_signed_url_expires_at,
    0,
    null,
    now()
  )
  on conflict (id) do update
    set object_path = excluded.object_path,
        file_name = excluded.file_name,
        password_hash = excluded.password_hash,
        signed_url = excluded.signed_url,
        signed_url_expires_at = excluded.signed_url_expires_at,
        failed_attempts = 0,
        blocked_until = null,
        updated_at = now();

  return jsonb_build_object('ok', true, 'object_path', v_path);
end;
$$;

revoke all on function public.publish_app_release(text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.publish_app_release(text, text, text, timestamptz, text)
  to service_role;

create or replace function public.unlock_app_release(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.app_releases%rowtype;
  v_password text := nullif(trim(coalesce(p_password, '')), '');
begin
  select * into v_row from public.app_releases where id = 'apk';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'O aplicativo ainda não foi publicado.');
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
    );
  end if;

  if v_password is null
     or v_row.password_hash is null
     or crypt(v_password, v_row.password_hash) <> v_row.password_hash then
    update public.app_releases
       set failed_attempts = failed_attempts + 1,
           blocked_until = case
             when failed_attempts + 1 >= 8 then now() + interval '15 minutes'
             else blocked_until
           end,
           updated_at = now()
     where id = 'apk';

    return jsonb_build_object('ok', false, 'error', 'Senha inválida.');
  end if;

  if v_row.signed_url is null
     or v_row.signed_url_expires_at is null
     or v_row.signed_url_expires_at < now() + interval '1 hour' then
    return jsonb_build_object(
      'ok', false,
      'error', 'O link de download expirou. Peça uma nova publicação.'
    );
  end if;

  update public.app_releases
     set failed_attempts = 0,
         blocked_until = null,
         updated_at = now()
   where id = 'apk';

  return jsonb_build_object(
    'ok', true,
    'url', v_row.signed_url,
    'file_name', v_row.file_name
  );
end;
$$;

revoke all on function public.unlock_app_release(text) from public;
grant execute on function public.unlock_app_release(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
