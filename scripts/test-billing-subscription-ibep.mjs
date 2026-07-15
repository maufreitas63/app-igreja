/**
 * Teste simples IBEP: ativa assinatura de teste e valida status no Supabase.
 *
 * Uso:
 *   node scripts/test-billing-subscription-ibep.mjs
 *
 * Requer .env.local com:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * e SQL scripts/billing-plans-subscriptions.sql aplicado.
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error('Defina EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const planCode = (process.argv[2] || 'semente').toLowerCase();

const { data: activate, error: activateError } = await supabase.rpc(
  'billing_test_activate_ibep_subscription',
  { p_plan_code: planCode }
);

if (activateError) {
  console.error('Falha ao ativar assinatura IBEP:', activateError.message);
  process.exit(1);
}

const activateRecord = activate ?? {};
if (activateRecord.success !== true) {
  console.error('Ativação recusada:', activateRecord);
  process.exit(1);
}

const tenantId = activateRecord.tenant_id;
const { data: status, error: statusError } = await supabase.rpc('get_tenant_billing_status', {
  p_tenant_id: tenantId,
});

if (statusError) {
  console.error('Falha ao ler status:', statusError.message);
  process.exit(1);
}

const ok =
  status?.success === true
  && status?.tenant_id === tenantId
  && status?.status === 'active'
  && status?.access_allowed === true
  && String(status?.plan?.code || '').toLowerCase() === planCode;

console.log(
  JSON.stringify(
    {
      ok,
      tenant_id: tenantId,
      plan: status?.plan?.code,
      status: status?.status,
      access_allowed: status?.access_allowed,
      member_count: status?.member_count,
      max_members: status?.max_members,
    },
    null,
    2
  )
);

if (!ok) {
  process.exit(1);
}

console.log('OK — assinatura IBEP atualizada e status válido no Supabase.');
