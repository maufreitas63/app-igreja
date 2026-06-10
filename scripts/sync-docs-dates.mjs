import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const skip = new Set(['AGENTS.md', 'CLAUDE.md', 'Cópia (1)BLUEPRINT.md']);

for (const file of fs.readdirSync(root)) {
  if (!file.endsWith('.md') || skip.has(file)) continue;

  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\*\*Atualizado em:\*\* \d{2}\/\d{2}\/\d{4}/g, '**Atualizado em:** 10/06/2026');
  content = content.replace(/\*Atualizado em \d{2}\/\d{2}\/\d{4}\*/g, '*Atualizado em 10/06/2026*');
  content = content.replace(/v2026-\d{2}-\d{2}/g, 'v2026-06-10');
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Datas de documentação sincronizadas para 10/06/2026.');
