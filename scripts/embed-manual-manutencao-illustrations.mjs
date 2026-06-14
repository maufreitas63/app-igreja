/**
 * Insere blocos de ilustração anotada no MANUAL_DASHBOARD_MANUTENCAO.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manualPath = path.join(root, 'MANUAL_DASHBOARD_MANUTENCAO.md');
const legends = JSON.parse(
  fs.readFileSync(path.join(root, 'docs', 'manual-manutencao', 'screen-legends.json'), 'utf8')
);

const anchors = [
  { after: '### Caminho\n**Índice do Aplicativo** → rodapé → ícone **engrenagem**', image: 'm00-acesso-engrenagem.png', title: 'Acesso pela engrenagem' },
  { after: '### Caminho\nRodapé **‹** · **Menu** ou **Voltar**', image: 'm01-menu-modulos.png', title: 'Menu de módulos' },
  { after: '### Caminho\n**Programação de Eventos** → **Novo evento**', image: 'm02-programacao-eventos.png', title: 'Programação de Eventos' },
  { after: '### Passo a passo — criar evento', image: 'm03-editor-evento.png', title: 'Editor de evento' },
  { after: '### Caminho\n**Cronograma de Eventos**', image: 'm04-cronograma.png', title: 'Cronograma de Eventos' },
  { after: '### Caminho\n**Sala(s) - Check In**', image: 'm05-sala-checkin.png', title: 'Sala(s) - Check In' },
  { after: '### Caminho\n**Tipos de Escala**', image: 'm06-tipos-escala.png', title: 'Tipos de Escala' },
  { after: '### Caminho\n**Servos em Disponibilidade**', image: 'm07-servos-disponibilidade.png', title: 'Servos em Disponibilidade' },
  { after: '### Caminho\n**Programação de Escalas**', image: 'm08-programacao-escalas.png', title: 'Programação de Escalas' },
  { after: '### Caminho\n**Cuidado Pastoral**', image: 'm09-cuidado-pastoral.png', title: 'Cuidado Pastoral' },
  { after: '### Caminho\n**Informações Financeiras**', image: 'm10-financeiro-manut.png', title: 'Informações Financeiras' },
  { after: '### Caminho\n**Lista de Presença**', image: 'm11-lista-presenca.png', title: 'Lista de Presença' },
  { after: '### Caminho\n**Cadastro de Usuário**', image: 'm12-cadastro-usuario.png', title: 'Cadastro de Usuário' },
  { after: '### Caminho\n**Recepção Familiar**', image: 'm13-recepcao-familiar.png', title: 'Recepção Familiar' },
  { after: '### Caminho\n**Controle de Acesso**', image: 'm14-controle-acesso.png', title: 'Controle de Acesso' },
  { after: '### Caminho\n**Mudança de Papéis**', image: 'm15-mudanca-papeis.png', title: 'Mudança de Papéis' },
  { after: '### Caminho\n**Acessos de Usuários**', image: 'm16-acessos-usuarios.png', title: 'Acessos de Usuários' },
];

function block(image, title) {
  const rows = legends[image] ?? [];
  const table = rows.map(([ref, text]) => `| ${ref} | ${text} |`).join('\n');

  return `

### Ilustração — ${title} *(dados fictícios)*

![${title} — captura anotada](docs/manual-manutencao/screens/${image})

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
${table}
`;
}

let content = fs.readFileSync(manualPath, 'utf8');

content = content.replace(/\n### Ilustração —[\s\S]*?(?=\n### |\n# |\n## |\n---\n\n# )/g, '\n');

// Garante linha de legenda no manual de manutenção
if (!content.includes('| **Ilustração** |')) {
  content = content.replace(
    '| **Dica** | Atalho ou cuidado útil |',
    '| **Dica** | Atalho ou cuidado útil |\n| **Ilustração** | Captura da tela com **marcadores numerados** (①②③…); tabela **Ref.** explica cada ponto *(dados fictícios)* |'
  );
}

for (const { after, image, title } of anchors) {
  const idx = content.indexOf(after);
  if (idx < 0) {
    console.warn(`Âncora não encontrada: ${after.slice(0, 50)}...`);
    continue;
  }

  const lineEnd = content.indexOf('\n', idx + after.length);
  const insertAt = lineEnd >= 0 ? lineEnd : idx + after.length;
  content = `${content.slice(0, insertAt)}${block(image, title)}${content.slice(insertAt)}`;
}

fs.writeFileSync(manualPath, content, 'utf8');
console.log('Ilustrações inseridas em MANUAL_DASHBOARD_MANUTENCAO.md');
