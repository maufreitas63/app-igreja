/**
 * Aplica no Supabase os scripts de versículos por tema (schema + dados em partes).
 *
 * Pré-requisito: SUPABASE_DATABASE_URL no ambiente ou em .env.local na raiz do projeto.
 * Obtenha em: Supabase → Project Settings → Database → Connection string (URI).
 *
 * Uso:
 *   npm run apply:bible-verses
 *   node --env-file=.env.local scripts/apply-bible-verses-supabase.mjs
 *   node scripts/apply-bible-verses-supabase.mjs --data-only
 *   node scripts/apply-bible-verses-supabase.mjs --schema-only
 *   node scripts/apply-bible-verses-supabase.mjs --dry-run
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCHEMA_FILE = join(__dirname, 'bible-verses-by-theme.sql');
const CLEAR_FILE = join(__dirname, 'bible-verses-by-theme-clear.sql');
const DATA_DIR = join(__dirname, 'bible-verses-by-theme-data');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const schemaOnly = args.has('--schema-only');
const dataOnly = args.has('--data-only');

function loadEnvLocal() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function getDatabaseUrl() {
  const url = process.env.SUPABASE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'Defina SUPABASE_DATABASE_URL (ou DATABASE_URL) em .env.local ou no ambiente.\n'
        + 'Supabase → Settings → Database → Connection string (URI).'
    );
  }
  return url;
}

function listDataSqlFiles() {
  if (!existsSync(DATA_DIR)) {
    throw new Error(
      `Pasta não encontrada: ${DATA_DIR}\n`
        + 'Gere as partes com: node scripts/split-bible-verses-sql.mjs'
    );
  }

  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function buildPlan() {
  const files = [];

  if (!dataOnly) {
    files.push({ label: 'schema', path: SCHEMA_FILE });
  }

  if (!schemaOnly) {
    files.push({ label: 'clear-data', path: CLEAR_FILE });
    for (const name of listDataSqlFiles()) {
      files.push({ label: name, path: join(DATA_DIR, name) });
    }
  }

  return files;
}

async function runSqlFile(client, filePath) {
  const sql = readFileSync(filePath, 'utf8');
  if (!sql.trim()) {
    return;
  }
  await client.query(sql);
}

async function verifyCounts(client) {
  const themes = await client.query('SELECT COUNT(*)::int AS n FROM public.bible_themes');
  const verses = await client.query('SELECT COUNT(*)::int AS n FROM public.bible_verses_by_theme');
  return {
    themes: themes.rows[0]?.n ?? 0,
    verses: verses.rows[0]?.n ?? 0,
  };
}

async function main() {
  loadEnvLocal();
  const plan = buildPlan();

  if (plan.length === 0) {
    console.log('Nada a executar.');
    return;
  }

  console.log(`Plano (${plan.length} arquivo(s)):`);
  for (const item of plan) {
    console.log(`  - ${item.label}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nenhum SQL foi executado.');
    return;
  }

  const connectionString = getDatabaseUrl();
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\nConectando ao Postgres...');
  await client.connect();
  console.log('Conectado.\n');

  try {
    for (let i = 0; i < plan.length; i += 1) {
      const item = plan[i];
      process.stdout.write(`[${i + 1}/${plan.length}] ${item.label}... `);
      const started = Date.now();
      await runSqlFile(client, item.path);
      console.log(`ok (${Date.now() - started}ms)`);
    }

    if (!schemaOnly) {
      const counts = await verifyCounts(client);
      console.log(`\nConcluído: ${counts.themes} temas, ${counts.verses} versículos.`);
    } else {
      console.log('\nSchema aplicado.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('\nFalha ao aplicar SQL:', error.message || error);
  process.exit(1);
});
