/**
 * Build de produção do PWA (local e Cloudflare Pages).
 * Evita postinstall no npm install; o Cloudflare deve usar: npm run build:web
 */
import { execSync } from 'node:child_process';

const run = (command) => {
  execSync(command, { stdio: 'inherit', env: process.env });
};

if (process.env.CF_PAGES === '1' || process.env.CI === 'true') {
  const current = process.env.NODE_OPTIONS?.trim() ?? '';
  if (!current.includes('max-old-space-size')) {
    process.env.NODE_OPTIONS = current
      ? `${current} --max-old-space-size=6144`
      : '--max-old-space-size=6144';
  }
}

run('node scripts/write-build-info.mjs');
run('node scripts/generate-app-icons.mjs');
run('npx expo export -p web');
run('npm run build:family-form');
