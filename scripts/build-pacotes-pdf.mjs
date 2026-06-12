import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'pdfs');

const files = [
  'INDICE_DOCUMENTACAO.md',
  'PACOTE_1_VISAO_GERAL.md',
  'PACOTE_2_OPERACAO.md',
  'PACOTE_3_GOVERNANCA_TI.md',
  'PACOTE_4_ANEXO_TECNICO.md',
  'PACOTE_5_MANUAL_PAINEL.md',
  'MANUAL_DASHBOARD_MEMBRO.md',
  'PACOTE_6_MANUAL_MANUTENCAO.md',
  'MANUAL_DASHBOARD_MANUTENCAO.md',
  'FUNCIONALIDADES.md',
  'MANUAL_TREINAMENTO.md',
  'FAQ.md',
  'MANUTENCAO_ECOSISTEMA.md',
  'MANUAL_CARD1_DASHBOARD.md',
  'MANUAL_CONTROLE_ACESSO.md',
  'CONTROLE_ACESSO.md',
  'CAMADAS_SEGURANCA.md',
  'BLUEPRINT.md',
  'ARQUITETURA_BLUEPRINT_PWA.md',
  'DASHBOARD_CARDS.md',
  'TSTMAX_SEED.md',
  'README.md',
  'CHECKLIST_VALIDACAO_POS_DEPLOY.md',
  'DEPLOY_CLOUDFLARE.md',
  'PAPEIS_CONTROLE_ACESSO.md',
];

const pdfCss = `
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1e293b;
    max-width: 100%;
  }
  h1 { font-size: 20pt; margin-top: 1.2em; page-break-after: avoid; }
  h2 { font-size: 16pt; margin-top: 1em; page-break-after: avoid; }
  h3 { font-size: 13pt; page-break-after: avoid; }
  pre, code { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; }
  pre { white-space: pre-wrap; word-break: break-word; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  th { background: #f1f5f9; }
  a { color: #4338ca; }
  blockquote { border-left: 3px solid #94a3b8; margin-left: 0; padding-left: 12px; color: #475569; }
`;

fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const inputPath = path.join(root, file);

  if (!fs.existsSync(inputPath)) {
    console.warn(`Ignorado (nao encontrado): ${file}`);
    continue;
  }

  const outputPath = path.join(outDir, file.replace(/\.md$/i, '.pdf'));
  process.stdout.write(`Gerando ${file} ... `);

  try {
    const pdf = await mdToPdf(
      { path: inputPath },
      {
        dest: outputPath,
        pdf_options: {
          format: 'A4',
          margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
          printBackground: true,
        },
        css: pdfCss,
        launch_options: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      }
    );

    if (!pdf?.filename) {
      throw new Error('PDF nao gerado');
    }

    console.log('ok');
  } catch (err) {
    console.log('erro');
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

console.log(`\nPDFs em: ${outDir}`);
