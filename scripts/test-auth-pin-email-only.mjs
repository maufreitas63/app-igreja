/**
 * Regressão: PIN de autenticação não pode sair por WhatsApp.
 * Executar: node scripts/test-auth-pin-email-only.mjs
 *
 * Valida o contrato do gateway no código-fonte (sem rede).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const failures = [];

const accessPin = read('lib/accessPin.ts');
const authService = read('lib/authNotificationService.ts');
const loginScreen = read('app/index.tsx');
const authSql = read('scripts/auth-pin-email-only.sql');

const expectIncludes = (label, source, snippet) => {
  if (!source.includes(snippet)) {
    failures.push(`${label}: esperado conter "${snippet}"`);
  }
};

const expectNotIncludes = (label, source, snippet) => {
  if (source.includes(snippet)) {
    failures.push(`${label}: não deveria conter "${snippet}"`);
  }
};

expectIncludes('authNotificationService', authService, "AUTH_NOTIFICATION_CHANNEL = 'email'");
expectIncludes('authNotificationService', authService, 'AUTH_CHANNEL_BLOCKED');
expectIncludes('authNotificationService', authService, 'dispatchAuthAccessPinEmail');
expectIncludes('authNotificationService', authService, 'rejectAuthWhatsAppDelivery');

expectIncludes('accessPin', accessPin, "reason: 'auth_channel_blocked'");
expectIncludes('accessPin', accessPin, 'AUTH_CHANNEL_BLOCKED_MESSAGE');
expectNotIncludes('accessPin.sendAccessPinViaWhatsApp', accessPin, 'openWhatsAppPhone(');

expectIncludes('login', loginScreen, 'Receber código por e-mail');
expectIncludes('login', loginScreen, 'dispatchAuthAccessPinEmail');
expectNotIncludes('login', loginScreen, 'Receber código no WhatsApp');
expectNotIncludes('login', loginScreen, 'sendAccessPinViaWhatsApp');
expectNotIncludes('login', loginScreen, 'openWhatsAppLikeBirthdays');

expectIncludes('sql', authSql, "select 'email'::text");
expectIncludes('sql', authSql, 'AUTH_CHANNEL_BLOCKED');
expectIncludes('sql', authSql, 'dispatch_auth_access_pin_email');
expectIncludes('sql', authSql, 'send_password_recovery_pin_email');
expectNotIncludes('sql', authSql, 'wa.me');
expectNotIncludes('sql', authSql.toLowerCase(), 'whatsapp');

if (failures.length) {
  console.error('FALHA — rastros de WhatsApp em autenticação:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('OK — autenticação de PIN restrita a e-mail (sem WhatsApp no fluxo de auth).');
