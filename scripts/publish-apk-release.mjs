/**
 * Baixa o APK do EAS, envia ao bucket privado `app-releases/generic/`
 * e grava o link assinado protegido por senha.
 *
 *   node scripts/publish-apk-release.mjs
 *   node scripts/publish-apk-release.mjs --password "sua-senha"
 *
 * Requer .env.local: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const DEFAULT_EAS_APK_URL =
  'https://expo.dev/artifacts/eas/YF-fwxDYLiRsx0_hxO3bOgQmW-1e8Xr31-yQURukOfM.apk';
const BUCKET = 'app-releases';
const OBJECT_PATH = 'generic/comunidade-digital.apk';
const FILE_NAME = 'Comunidade-Digital.apk';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 180;

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
};

loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.local'));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    password: process.env.APK_RELEASE_PASSWORD || '',
    apkUrl: process.env.EAS_APK_URL || DEFAULT_EAS_APK_URL,
  };

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--password') {
      options.password = args[index + 1] ?? options.password;
      index += 1;
    }
    if (args[index] === '--url') {
      options.apkUrl = args[index + 1] ?? options.apkUrl;
      index += 1;
    }
  }

  return options;
};

const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (size) =>
    Array.from({ length: size }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  return `CD-${pick(4)}-${pick(4)}`;
};

const options = parseArgs();
const password = options.password.trim() || generatePassword();
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tmpFile = path.join(os.tmpdir(), FILE_NAME);

console.log('Baixando APK do EAS...');
const apkResponse = await fetch(options.apkUrl);
if (!apkResponse.ok) {
  console.error(`Falha ao baixar o APK: HTTP ${apkResponse.status}`);
  process.exit(1);
}

const apkBuffer = Buffer.from(await apkResponse.arrayBuffer());
fs.writeFileSync(tmpFile, apkBuffer);
console.log(`APK local: ${tmpFile} (${(apkBuffer.length / (1024 * 1024)).toFixed(1)} MB)`);

console.log('Enviando para o Storage (app-releases/generic/)...');
const { error: uploadError } = await supabase.storage.from(BUCKET).upload(OBJECT_PATH, apkBuffer, {
  contentType: 'application/vnd.android.package-archive',
  upsert: true,
  cacheControl: '3600',
});

let downloadUrl = '';
let expiresAt = '';
let storageMode = 'supabase';

if (uploadError) {
  const sizeBlocked = /exceeded the maximum allowed size/i.test(uploadError.message || '');
  if (!sizeBlocked) {
    console.error('Falha no upload:', uploadError.message);
    process.exit(1);
  }

  // Limite global do projeto (em geral 50 MB no plano Free) é menor que o APK.
  // A senha continua no banco; o binário fica no artefato EAS até a validade.
  console.warn(`Storage recusou o APK (${uploadError.message}). Usando o artefato EAS atrás da senha.`);
  downloadUrl = options.apkUrl;
  expiresAt = '2026-09-17T23:32:32.903Z';
  storageMode = 'eas-fallback';
} else {
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(OBJECT_PATH, SIGNED_URL_SECONDS, { download: FILE_NAME });

  if (signError || !signed?.signedUrl) {
    console.error('Falha ao assinar URL:', signError?.message || 'sem URL');
    process.exit(1);
  }

  downloadUrl = signed.signedUrl;
  expiresAt = new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString();
}
const { data: published, error: publishError } = await supabase.rpc('publish_app_release', {
  p_object_path: OBJECT_PATH,
  p_file_name: FILE_NAME,
  p_signed_url: downloadUrl,
  p_signed_url_expires_at: expiresAt,
  p_password: password,
});

if (publishError) {
  console.error('Falha ao gravar a senha/link:', publishError.message);
  process.exit(1);
}

try {
  fs.unlinkSync(tmpFile);
} catch {
  // temp
}

console.log(JSON.stringify({
  ok: true,
  published,
  storageMode,
  objectPath: OBJECT_PATH,
  pageUrl: 'https://app-igreja.pages.dev/baixar-app',
  password,
  signedUrlExpiresAt: expiresAt,
}, null, 2));
