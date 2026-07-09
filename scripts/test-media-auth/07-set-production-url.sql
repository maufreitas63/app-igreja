-- TESTE 7 — Cadastrar URL pública do app (link no e-mail)
-- Substitua pela URL real do Cloudflare Pages antes de executar.

do $$
declare
  v_url text := 'https://seu-app.pages.dev';
begin
  if not exists (
    select 1
      from public.app_parameters
     where lower(trim(parameter)) = 'media_authorization_app_url'
  ) then
    insert into public.app_parameters (parameter, value)
    values ('media_authorization_app_url', v_url);
  else
    update public.app_parameters
       set value = v_url
     where lower(trim(parameter)) = 'media_authorization_app_url';
  end if;
end;
$$;

select parameter, value
  from public.app_parameters
 where lower(trim(parameter)) in ('media_authorization_app_url', 'app_public_url');
