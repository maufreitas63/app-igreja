#!/usr/bin/env node
/**
 * Aplica substituições de cores do tema escuro legado → vigilance nos painéis de manutenção.
 * Uso: node scripts/apply-maintenance-vigilance-theme.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const TARGET_GLOBS = [
  'components/Maintenance*.tsx',
  'components/EventsGanttChart.tsx',
  'components/EventOrchestratorPanel.tsx',
  'components/QuorumCheckinRegistryTable.tsx',
  'app/maintenance-dashboard.tsx',
];

const REPLACEMENTS = [
  ["const ACCENT = '#38BDF8';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#34D399';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#C084FC';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#A78BFA';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#F472B6';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#FCD34D';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#22D3EE';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#818CF8';", "const ACCENT = '#3A96DD';"],
  ["const ACCENT = '#10b981';", "const ACCENT = '#3A96DD';"],
  ["color: '#F8FAFC'", "color: '#3A96DD'"],
  ["color: '#E2E8F0'", "color: '#3A96DD'"],
  ["color: '#E0E7FF'", "color: '#3A96DD'"],
  ["color: '#E0F2FE'", "color: '#3A96DD'"],
  ["color: '#CBD5E1'", "color: '#3A96DD'"],
  ["color: '#94A3B8'", "color: 'rgba(58, 150, 221, 0.82)'"],
  ["color: '#64748B'", "color: 'rgba(58, 150, 221, 0.82)'"],
  ["color: '#7DD3FC'", "color: '#1B4F8A'"],
  ["borderColor: '#334155'", "borderColor: 'rgba(52, 211, 153, 0.35)'"],
  ["borderColor: '#475569'", "borderColor: 'rgba(52, 211, 153, 0.35)'"],
  ["borderBottomColor: '#334155'", "borderBottomColor: 'rgba(52, 211, 153, 0.35)'"],
  ["borderTopColor: '#334155'", "borderTopColor: 'rgba(52, 211, 153, 0.35)'"],
  ["borderBottomColor: 'rgba(51, 65, 85, 0.72)'", "borderBottomColor: 'rgba(52, 211, 153, 0.35)'"],
  ["backgroundColor: 'rgba(15, 23, 42, 0.55)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(15, 23, 42, 0.65)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(15, 23, 42, 0.68)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(15, 23, 42, 0.75)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(15, 23, 42, 0.88)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(30, 41, 59, 0.45)'", "backgroundColor: '#F8FAFC'"],
  ["backgroundColor: 'rgba(30, 41, 59, 0.7)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(30, 41, 59, 0.75)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(30, 41, 59, 0.8)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: '#0f172a'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: '#1E293B'", "backgroundColor: '#FFFFFF'"],
  ["borderColor: '#818CF8'", "borderColor: '#3A96DD'"],
  ["borderColor: '#A5B4FC'", "borderColor: '#3A96DD'"],
  ["backgroundColor: 'rgba(99, 102, 241, 0.22)'", "backgroundColor: '#F0F9FF'"],
  ["backgroundColor: 'rgba(99, 102, 241, 0.35)'", "backgroundColor: '#F0F9FF'"],
  ["color: '#C7D2FE'", "color: '#3A96DD'"],
  ["color: '#A5B4FC'", "color: '#1B4F8A'"],
  ["borderColor: 'rgba(129, 140, 248, 0.35)'", "borderColor: 'rgba(52, 211, 153, 0.35)'"],
  ["borderColor: 'rgba(129, 140, 248, 0.45)'", "borderColor: 'rgba(52, 211, 153, 0.35)'"],
  ["borderColor: 'rgba(129, 140, 248, 0.55)'", "borderColor: 'rgba(52, 211, 153, 0.35)'"],
  ["backgroundColor: 'rgba(99, 102, 241, 0.14)'", "backgroundColor: '#F0F9FF'"],
  ["backgroundColor: 'rgba(99, 102, 241, 0.2)'", "backgroundColor: '#F0F9FF'"],
  ["backgroundColor: 'rgba(15, 23, 42, 0.6)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: 'rgba(15, 23, 42, 0.95)'", "backgroundColor: '#FFFFFF'"],
  ["backgroundColor: '#A5B4FC'", "backgroundColor: '#3A96DD'"],
  ["color: '#0f172a'", "color: '#FFFFFF'"],
  ["color: '#BAE6FD'", "color: '#1B4F8A'"],
  ["color: '#CBD5E1'", "color: '#3A96DD'"],
  ["borderColor: '#64748B'", "borderColor: 'rgba(52, 211, 153, 0.35)'"],
];

function matchesPattern(name, pattern) {
  const base = path.basename(pattern);
  if (base.includes('*')) {
    const re = new RegExp('^' + base.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test(name);
  }
  return name === base;
}

function collectFiles() {
  const files = [];
  for (const pattern of TARGET_GLOBS) {
    const dir = path.dirname(pattern);
    const absDir = path.join(root, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const name of fs.readdirSync(absDir)) {
      if (matchesPattern(name, pattern)) {
        files.push(path.join(absDir, name));
      }
    }
  }
  return [...new Set(files)];
}

let totalFiles = 0;
let totalReplacements = 0;

for (const filePath of collectFiles()) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fileReplacements = 0;

  for (const [from, to] of REPLACEMENTS) {
    const parts = content.split(from);
    if (parts.length > 1) {
      fileReplacements += parts.length - 1;
      content = parts.join(to);
    }
  }

  if (fileReplacements > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles += 1;
    totalReplacements += fileReplacements;
    console.log(`${path.relative(root, filePath)}: ${fileReplacements} substituições`);
  }
}

console.log(`\nConcluído: ${totalReplacements} substituições em ${totalFiles} arquivo(s).`);
