-- Atualiza a URL pública da PWA para o subdomínio no domínio já registrado.
-- O host legado app-igreja.pages.dev continua válido no Cloudflare.

update public.app_parameters
set value = 'https://app.conectamais.api.br'
where lower(parameter) in ('app_public_url', 'media_authorization_app_url')
  and (
    value is null
    or trim(value) = ''
    or value ilike '%app-igreja.pages.dev%'
    or value ilike '%conectamais.app%'
    or value ilike '%seu-dominio%'
    or value ilike '%localhost%'
  );

select parameter, value
from public.app_parameters
where lower(parameter) in ('app_public_url', 'media_authorization_app_url')
order by parameter;
