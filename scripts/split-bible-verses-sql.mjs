/**
 * Divide bible-verses-by-theme-data.sql em partes para o Supabase SQL Editor.
 *
 * Uso: node scripts/split-bible-verses-sql.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, 'bible-verses-by-theme-data.sql');
const OUT_DIR = join(__dirname, 'bible-verses-by-theme-data');
const INSERTS_PER_PART = 8; // ~400 versículos por arquivo (lotes de 50)

const sql = readFileSync(SOURCE, 'utf8');
const lines = sql.split(/\r?\n/);

const header = [];
const themeInserts = [];
const verseInsertBlocks = [];

let i = 0;
while (i < lines.length && !lines[i].startsWith('INSERT INTO bible_themes')) {
  header.push(lines[i]);
  i++;
}

while (i < lines.length && lines[i].startsWith('INSERT INTO bible_themes')) {
  themeInserts.push(lines[i]);
  i++;
}

while (i < lines.length) {
  if (!lines[i].startsWith('INSERT INTO bible_verses_by_theme')) {
    i++;
    continue;
  }

  const block = [lines[i]];
  i++;
  while (i < lines.length && !lines[i].startsWith('INSERT INTO bible_verses_by_theme')) {
    block.push(lines[i]);
    i++;
  }
  verseInsertBlocks.push(block.join('\n'));
}

mkdirSync(OUT_DIR, { recursive: true });

const setupSql = [
  ...header.filter((line) => line.trim().length > 0),
  '',
  '-- Parte 00: execute primeiro (apaga e recria temas).',
  ...themeInserts,
  '',
].join('\n');

writeFileSync(join(OUT_DIR, '00-truncate-themes.sql'), setupSql, 'utf8');

const partFiles = [];
for (let p = 0; p < verseInsertBlocks.length; p += INSERTS_PER_PART) {
  const chunk = verseInsertBlocks.slice(p, p + INSERTS_PER_PART);
  const partNum = Math.floor(p / INSERTS_PER_PART) + 1;
  const fileName = `${String(partNum).padStart(2, '0')}-verses-part-${String(partNum).padStart(2, '0')}.sql`;
  const partHeader = [
    `-- Parte ${String(partNum).padStart(2, '0')}: versículos (${chunk.length} blocos INSERT).`,
    '-- Execute bible-verses-by-theme.sql e 00-truncate-themes.sql antes.',
    '',
  ].join('\n');
  writeFileSync(join(OUT_DIR, fileName), partHeader + chunk.join('\n\n') + '\n', 'utf8');
  partFiles.push(fileName);
}

const readme = `# Versículos por tema — execução no Supabase

Execute **nesta ordem** no SQL Editor:

1. \`../bible-verses-by-theme.sql\` — cria tabelas, view e RPC (só na 1ª vez)
2. \`../bible-verses-by-theme-clear.sql\` — **limpa todos os dados** (temas e versículos)
3. \`00-truncate-themes.sql\` — insere os 161 temas
${partFiles.map((f, idx) => `${idx + 4}. \`${f}\``).join('\n')}

**Não** execute \`import-dailyverses-themes.mjs\` no Supabase (é JavaScript).

Arquivos gerados por \`node scripts/split-bible-verses-sql.mjs\`.
Fonte: ${header.find((l) => l.includes('Themes:')) ?? 'bible-verses-by-theme-data.sql'}

## Aplicação automática (terminal)

1. Crie \`.env.local\` na raiz com \`SUPABASE_DATABASE_URL\` (URI do Postgres no Supabase).
2. \`npm install\`
3. \`npm run apply:bible-verses\`

Opções: \`--schema-only\`, \`--data-only\`, \`--dry-run\`.
`;

writeFileSync(join(OUT_DIR, 'README.md'), readme, 'utf8');

console.log(`Wrote ${OUT_DIR}`);
console.log(`  00-truncate-themes.sql (${themeInserts.length} temas)`);
for (const f of partFiles) {
  console.log(`  ${f}`);
}
console.log(`Total: ${partFiles.length} partes de versículos, ${verseInsertBlocks.length} blocos INSERT`);
