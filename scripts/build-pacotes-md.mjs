import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readLines(file, start = 1, end = 0) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = content.split(/\r?\n/);
  const from = start - 1;
  const to = end > 0 ? end : lines.length;
  return lines.slice(from, to);
}

function sectionHeader(title) {
  return ['', '---', '', `# ${title}`, '', '---', ''];
}

function writePackage(filename, intro, parts) {
  const chunks = [intro.join('\n')];
  for (const part of parts) {
    chunks.push(sectionHeader(part.title).join('\n'));
    chunks.push(readLines(part.file, part.start ?? 1, part.end ?? 0).join('\n'));
  }
  fs.writeFileSync(path.join(root, filename), `${chunks.join('\n')}\n`, 'utf8');
}

writePackage('PACOTE_1_VISAO_GERAL.md', [
  '# Pacote 1 — Visão Geral',
  '',
  'Documentação **autocontida** para diretoria, membros, famílias e voluntários.',
  '',
  '**Atualizado em:** 09/06/2026',
  '',
  'Conteúdo integrado: Funcionalidades · Manual de Treinamento · FAQ',
], [
  { title: 'Parte 1 — Funcionalidades do aplicativo IBN', file: 'FUNCIONALIDADES.md' },
  { title: 'Parte 2 — Manual de Treinamento (Mão na Massa)', file: 'MANUAL_TREINAMENTO.md' },
  { title: 'Parte 3 — Perguntas e Respostas (FAQ)', file: 'FAQ.md' },
]);

writePackage('PACOTE_2_OPERACAO.md', [
  '# Pacote 2 — Operação da Igreja',
  '',
  'Documentação **autocontida** para secretaria, eventos, salas Kids/Teens e líderes de escala.',
  '',
  '**Atualizado em:** 09/06/2026',
  '',
  'Conteúdo integrado: Manutenção como ecossistema · Missão B4 (escalas) · Card Agenda · FAQ Totem/Manutenção',
], [
  { title: 'Parte 1 — Manutenção como ecossistema vivo', file: 'MANUTENCAO_ECOSISTEMA.md' },
  { title: 'Parte 2 — Missão B4: Escalas em equipe (Manual de Treinamento)', file: 'MANUAL_TREINAMENTO.md', start: 265, end: 324 },
  { title: 'Parte 3 — Manual do Card 1: Agenda da Família', file: 'MANUAL_CARD1_DASHBOARD.md' },
  { title: 'Parte 4 — FAQ: Totem e Manutenção (equipe)', file: 'FAQ.md', start: 427, end: 470 },
]);

writePackage('PACOTE_3_GOVERNANCA_TI.md', [
  '# Pacote 3 — Governança, Permissões e TI',
  '',
  'Documentação **autocontida** para super administrador, TI e desenvolvedor.',
  '',
  '**Atualizado em:** 09/06/2026',
  '',
  'Conteúdo integrado: Manual operacional ACL · Modelo de controle de acesso · Camadas de segurança · Blueprint completo',
], [
  { title: 'Parte 1 — Manual operacional de Controle de Acesso', file: 'MANUAL_CONTROLE_ACESSO.md' },
  { title: 'Parte 2 — Controle de acesso: modelo e inventário', file: 'CONTROLE_ACESSO.md' },
  { title: 'Parte 3 — Especificação das camadas de segurança', file: 'CAMADAS_SEGURANCA.md' },
  { title: 'Parte 4 — Blueprint completo', file: 'BLUEPRINT.md' },
]);

writePackage('PACOTE_4_ANEXO_TECNICO.md', [
  '# Pacote 4 — Anexo Técnico',
  '',
  'Documentação **autocontida** de arquitetura e referências técnicas.',
  '',
  '**Atualizado em:** 09/06/2026',
  '',
  'Conteúdo integrado: Arquitetura Blueprint PWA · Cards do Dashboard',
], [
  { title: 'Parte 1 — Blueprint de Arquitetura e Especificação Técnica', file: 'ARQUITETURA_BLUEPRINT_PWA.md' },
  { title: 'Parte 2 — Cards do Dashboard', file: 'DASHBOARD_CARDS.md' },
]);

console.log('Pacotes gerados com sucesso.');
