import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const skip = new Set(['AGENTS.md', 'CLAUDE.md', 'Cópia (1)BLUEPRINT.md']);
const dateBr = '23/06/2026';
const dateIso = 'v2026-06-23';
const dateLong = '23 de junho de 2026';

for (const file of fs.readdirSync(root)) {
  if (!file.endsWith('.md') || skip.has(file)) continue;

  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\*\*Atualizado em:\*\* \d{2}\/\d{2}\/\d{4}/g, `**Atualizado em:** ${dateBr}`);
  content = content.replace(/\*Atualizado em \d{2}\/\d{2}\/\d{4}\*/g, `*Atualizado em ${dateBr}*`);
  content = content.replace(/\*\*Data deste documento:\*\* \d{1,2} de \w+ de \d{4}/g, `**Data deste documento:** ${dateLong}`);
  content = content.replace(/\*\*Data:\*\* \d{1,2} de \w+ de \d{4}/g, `**Data:** ${dateLong}`);
  content = content.replace(/v2026-\d{2}-\d{2}/g, dateIso);
  content = content.replace(/Documentação v2026-\d{2}-\d{2}/g, `Documentação ${dateIso}`);
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`Datas de documentação sincronizadas para ${dateBr}.`);
