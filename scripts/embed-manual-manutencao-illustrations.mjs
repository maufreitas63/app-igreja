/**
 * Insere blocos de ilustração anotada no MANUAL_DASHBOARD_MANUTENCAO.md
 * (âncoras alinhadas aos grupos da engrenagem — 05/10/2026).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manualPath = path.join(root, 'MANUAL_DASHBOARD_MANUTENCAO.md');
const legendsPath = path.join(root, 'docs', 'manual-manutencao', 'screen-legends.json');
const legends = fs.existsSync(legendsPath)
  ? JSON.parse(fs.readFileSync(legendsPath, 'utf8'))
  : {};

const anchors = [
  { after: '## 1. Acesso, navegação e segurança', image: 'm00-acesso-engrenagem.png', title: 'Acesso pela engrenagem' },
  { after: '## 5. Visitantes / Cadastro Rápido', image: 'visitantes-cadastro-rapido.png', title: 'Visitantes / Cadastro Rápido' },
  { after: '## 6. Recepção Familiar', image: 'm13-recepcao-familiar.png', title: 'Recepção Familiar' },
  { after: '## 7. Régua de Acolhimento', image: 'visitor_followup.png', title: 'Régua de Acolhimento' },
  { after: '## 9. Cadastro de Usuário', image: 'm12-cadastro-usuario.png', title: 'Cadastro de Usuário' },
  { after: '## 13. Cuidados Pastorais', image: 'm09-cuidado-pastoral.png', title: 'Cuidados Pastorais' },
  { after: '## 20. Programação de Eventos', image: 'm02-programacao-eventos.png', title: 'Programação de Eventos' },
  { after: '## 21. Cronograma de Eventos', image: 'm04-cronograma.png', title: 'Cronograma de Eventos' },
  { after: '## 23. Sala(s) - Check In', image: 'm05-sala-checkin.png', title: 'Sala(s) - Check In' },
  { after: '## 24. Tipos de Escala', image: 'm06-tipos-escala.png', title: 'Tipos de Escala' },
  { after: '## 25. Servos em Disponibilidade', image: 'm07-servos-disponibilidade.png', title: 'Servos em Disponibilidade' },
  { after: '## 26. Programação de Escalas', image: 'm08-programacao-escalas.png', title: 'Programação de Escalas' },
  { after: '## 28. Informações Financeiras', image: 'm10-financeiro-manut.png', title: 'Informações Financeiras' },
  { after: '## 38. Controle de Acesso', image: 'access_control.png', title: 'Controle de Acesso' },
  { after: '## 39. Mudança Papéis', image: 'mudanca_papeis.png', title: 'Mudança Papéis' },
  { after: '## 41. Acesso Usuários', image: 'm16-acessos-usuarios.png', title: 'Acessos de Usuários' },
  { after: '## 43. Assinaturas e Billing', image: 'billing.png', title: 'Assinaturas' },
  { after: '## 44. Aliança Conecta Reino', image: 'alianca.png', title: 'Aliança Conecta Reino' },
];

function resolveLegendRows(image) {
  if (Array.isArray(legends[image])) return legends[image];
  if (image === 'access_control.png' && Array.isArray(legends['m14-controle-acesso.png'])) {
    return legends['m14-controle-acesso.png'];
  }
  if (image === 'mudanca_papeis.png' && Array.isArray(legends['m15-mudanca-papeis.png'])) {
    return legends['m15-mudanca-papeis.png'];
  }
  if (image === 'visitor_followup.png') return [];
  return [];
}

function block(image, title) {
  const tableRows = resolveLegendRows(image);
  const table = tableRows.length
    ? tableRows.map(([ref, text]) => `| ${ref} | ${text} |`).join('\n')
    : '| — | Captura de referência da tela publicada |';

  return `

### Ilustração — ${title}

![${title} — captura anotada](docs/manual-manutencao/screens/${image})

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
${table}
`;
}

let content = fs.readFileSync(manualPath, 'utf8');

content = content.replace(/\n### Ilustração —[\s\S]*?(?=\n### |\n# |\n## |\n---\n)/g, '\n');

let inserted = 0;
let skipped = 0;

for (const { after, image, title } of anchors) {
  if (content.includes(`docs/manual-manutencao/screens/${image}`)) {
    skipped += 1;
    continue;
  }

  const idx = content.indexOf(after);
  if (idx < 0) {
    console.warn(`Âncora não encontrada: ${after.slice(0, 60)}...`);
    continue;
  }

  const lineEnd = content.indexOf('\n', idx + after.length);
  const insertAt = lineEnd >= 0 ? lineEnd : idx + after.length;
  content = `${content.slice(0, insertAt)}${block(image, title)}${content.slice(insertAt)}`;
  inserted += 1;
}

fs.writeFileSync(manualPath, content, 'utf8');
console.log(`Ilustrações manutenção: +${inserted} inseridas, ${skipped} já presentes.`);
