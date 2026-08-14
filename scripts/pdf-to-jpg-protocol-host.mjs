/**
 * Aberto pelo protocolo Windows conectapdfjpg:// a partir do botão no PWA.
 * Executa scripts/convert-pdf-folder-to-jpg.mjs na pasta pedida (sem subpastas).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const converter = path.join(root, 'scripts', 'convert-pdf-folder-to-jpg.mjs');
const DEFAULT_DIR = String.raw`C:\IBN Tesouraria\Comprovantes\JPG`;

function parseFolderPath(argv) {
  const raw = argv.find((arg) => /conectapdfjpg:/i.test(arg)) || argv[0] || '';

  try {
    const url = new URL(raw.replace(/^conectapdfjpg:\/+/i, 'conectapdfjpg://'));
    const dir = url.searchParams.get('dir');
    if (dir?.trim()) {
      return dir.trim();
    }
  } catch {
    // ignore
  }

  const match = raw.match(/[?&]dir=([^&]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].replace(/\+/g, '%20')).trim();
    } catch {
      return match[1].trim();
    }
  }

  return DEFAULT_DIR;
}

function showMessage(text) {
  const escaped = text.replace(/'/g, "''");
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-STA',
      '-Command',
      `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${escaped}', 'PDF para JPG')`,
    ],
    { windowsHide: true }
  );
}

const folderPath = parseFolderPath(process.argv.slice(2));

if (!/^[A-Za-z]:[\\/]/.test(folderPath) && !folderPath.startsWith('\\\\')) {
  showMessage(`Caminho inválido:\n${folderPath}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [converter, '--in', folderPath, '--out', folderPath], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: false,
});

const stdout = String(result.stdout || '');
const stderr = String(result.stderr || '');
const summary =
  stdout.match(/Concluído —[^\n]+/)?.[0] ||
  stderr.trim() ||
  (result.status === 0 ? 'Conversão concluída.' : `Falha (código ${result.status}).`);

showMessage(`${summary}\n\nPasta:\n${folderPath}`);
process.exit(result.status === 0 ? 0 : 1);
