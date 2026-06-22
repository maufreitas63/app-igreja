/**
 * Cloudflare Pages: quando o painel não define build command, gera dist no pós-install.
 * Só roda com CF_PAGES=1 (variável injetada pelo Cloudflare durante o build).
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (process.env.CF_PAGES !== '1') {
  process.exit(0);
}

if (existsSync('dist/index.html')) {
  console.log('[cloudflare-pages-build] dist/ já existe — build ignorado.');
  process.exit(0);
}

console.log('[cloudflare-pages-build] Gerando dist/ com npm run build:web ...');
execSync('npm run build:web', { stdio: 'inherit' });
