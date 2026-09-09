/** Host público da PWA (domínio customizado no Cloudflare Pages). */
export const PRODUCTION_APP_HOST = 'app.conectamais.api.br';

/** URL pública de produção para links, QR, Stripe e APK. */
export const DEFAULT_PRODUCTION_APP_URL = `https://${PRODUCTION_APP_HOST}`;

/** Host legado do Cloudflare Pages — links antigos continuam válidos. */
export const LEGACY_PRODUCTION_APP_HOST = 'app-igreja.pages.dev';

export const LEGACY_PRODUCTION_APP_URL = `https://${LEGACY_PRODUCTION_APP_HOST}`;
