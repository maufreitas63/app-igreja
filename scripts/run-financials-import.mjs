/**
 * Lê o CSV no disco local e chama a RPC no Supabase (sem embutir dados no SQL).
 *
 * Uso:
 *   node scripts/run-financials-import.mjs
 *   node scripts/run-financials-import.mjs csv/financeiro.csv
 *
 * Variáveis em .env.local ou .env:
 *   EXPO_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (recomendado) ou EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const defaultCsvCandidates = [
  path.join(projectRoot, 'csv', 'financeiro.csv'),
  path.join(__dirname, 'data', 'financeiro.csv'),
];

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
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
};

loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.local'));

const csvArg = process.argv[2];
const csvPath =
  csvArg ??
  defaultCsvCandidates.find((candidate) => fs.existsSync(candidate));

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('CSV não encontrado. Informe o caminho:');
  console.error('  node scripts/run-financials-import.mjs csv/financeiro.csv');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, 'utf8');
const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase.rpc('importar_lancamentos_financeiros_csv', {
  p_csv_conteudo: csvContent,
  p_substituir: false,
});

if (error) {
  console.error('Falha na RPC:', error.message);
  console.error('Execute scripts/financials-import-rpc.sql no Supabase antes de importar.');
  process.exit(1);
}

console.log(`CSV: ${csvPath}`);
console.log(JSON.stringify(data, null, 2));

if (!data?.success) {
  process.exit(1);
}
