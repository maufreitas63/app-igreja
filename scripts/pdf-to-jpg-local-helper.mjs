/**
 * Conversor local (HTTP). Roda neste computador e grava JPG no disco.
 *
 *   npm run pdf-to-jpg:helper
 *
 * Abra http://127.0.0.1:47821 — o botão desta página executa a conversão.
 * O PWA só abre esta página numa aba nova (não converte no navegador da nuvem).
 */
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const converter = path.join(root, 'scripts', 'convert-pdf-folder-to-jpg.mjs');
const PORT = Number.parseInt(process.env.PDF_TO_JPG_HELPER_PORT || '47821', 10);
const DEFAULT_DIR = String.raw`C:\IBN Tesouraria\Comprovantes\JPG`;

const PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Converter PDF → JPG</title>
  <style>
    body { font-family: Segoe UI, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; }
    input { width: 100%; padding: 10px; font-size: 14px; box-sizing: border-box; }
    button { margin-top: 12px; padding: 12px 18px; font-size: 16px; cursor: pointer; }
    .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    #back { background: #e2e8f0; border: 1px solid #94a3b8; }
    pre { background: #111; color: #d1fae5; padding: 12px; white-space: pre-wrap; min-height: 80px; }
  </style>
</head>
<body>
  <h1>Converter PDF → JPG</h1>
  <p>Só os arquivos <code>.pdf</code> desta pasta (sem subpastas). JPG já existente é pulado.</p>
  <label>Pasta</label>
  <input id="dir" value="${DEFAULT_DIR.replace(/\\/g, '\\\\')}"/>
  <p class="actions">
    <button id="go" type="button">Converter agora</button>
    <button id="back" type="button">Fechar e voltar às Informações Financeiras</button>
  </p>
  <pre id="out">Pronto.</pre>
  <script>
    const params = new URLSearchParams(location.search);
    const dirInput = document.getElementById('dir');
    const out = document.getElementById('out');
    const go = document.getElementById('go');
    const back = document.getElementById('back');
    if (params.get('dir')) dirInput.value = params.get('dir');

    function returnToFinancials() {
      const ret = params.get('return');
      window.close();
      window.setTimeout(() => {
        if (!ret) return;
        try {
          const target = new URL(ret);
          if (target.protocol === 'https:' || target.protocol === 'http:') {
            location.href = target.href;
          }
        } catch (error) {}
      }, 150);
    }

    async function convert() {
      go.disabled = true;
      out.textContent = 'Convertendo…';
      try {
        const response = await fetch('/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: dirInput.value })
        });
        const payload = await response.json();
        out.textContent = payload.message || payload.stdout || JSON.stringify(payload, null, 2);
        if (payload.stdout) out.textContent += '\\n\\n' + payload.stdout;
      } catch (error) {
        out.textContent = String(error);
      } finally {
        go.disabled = false;
      }
    }

    go.addEventListener('click', convert);
    back.addEventListener('click', returnToFinancials);
    if (params.get('run') === '1') convert();
  </script>
</body>
</html>`;

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function runConverter(folderPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [converter, '--in', folderPath, '--out', folderPath], {
      cwd: root,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function isWindowsFolderPath(folderPath) {
  return /^[A-Za-z]:[\\/]/.test(folderPath) || folderPath.startsWith('\\\\');
}

function isJpegFileName(fileName) {
  const lower = String(fileName || '').toLowerCase();
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.jpe') ||
    lower.endsWith('.jfif')
  );
}

function resolveUnderFolder(folderPath, relativePath) {
  const root = path.resolve(folderPath);
  const full = path.resolve(root, relativePath.replace(/\//g, path.sep));
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (full !== root && !full.toLowerCase().startsWith(rootWithSep.toLowerCase())) {
    throw new Error('Caminho de arquivo fora da pasta informada.');
  }
  return full;
}

function listJpegFiles(folderPath, prefix = '', depth = 0) {
  if (depth > 4) {
    return [];
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(
        ...listJpegFiles(path.join(folderPath, entry.name), `${prefix}${entry.name}/`, depth + 1)
      );
      continue;
    }

    if (!entry.isFile() || !isJpegFileName(entry.name) || entry.name.toLowerCase().startsWith('updated_')) {
      continue;
    }

    files.push({
      fileName: entry.name,
      relativePath: `${prefix}${entry.name}`,
    });
  }

  return files;
}

function parseSummary(stdout) {
  const match = stdout.match(
    /Concluído — ok: (\d+) · pulados: (\d+) · falhas: (\d+) · páginas: (\d+)/
  );
  if (!match) {
    return { ok: 0, skipped: 0, failed: 0, pages: 0 };
  }
  return {
    ok: Number(match[1]),
    skipped: Number(match[2]),
    failed: Number(match[3]),
    pages: Number(match[4]),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, defaultDir: DEFAULT_DIR });
      return;
    }
    send(res, 200, PAGE, { 'Content-Type': 'text/html; charset=utf-8' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/convert') {
    try {
      const body = await readJson(req);
      const folderPath =
        typeof body.folderPath === 'string' && body.folderPath.trim()
          ? body.folderPath.trim()
          : DEFAULT_DIR;

      if (!isWindowsFolderPath(folderPath)) {
        sendJson(res, 400, { ok: false, message: 'Informe um caminho absoluto de pasta no Windows.' });
        return;
      }

      if (!fs.existsSync(folderPath)) {
        sendJson(res, 400, { ok: false, message: `Pasta não encontrada: ${folderPath}` });
        return;
      }

      const result = await runConverter(folderPath);
      const summary = parseSummary(result.stdout);
      sendJson(res, result.code === 0 ? 200 : 500, {
        ok: result.code === 0,
        folderPath,
        converted: summary.ok,
        skipped: summary.skipped,
        failed: summary.failed,
        pages: summary.pages,
        stdout: result.stdout,
        stderr: result.stderr,
        message: `Concluído — ok: ${summary.ok} · pulados: ${summary.skipped} · falhas: ${summary.failed} · páginas: ${summary.pages}`,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/list-receipts') {
    try {
      const body = await readJson(req);
      const folderPath =
        typeof body.folderPath === 'string' && body.folderPath.trim()
          ? body.folderPath.trim()
          : DEFAULT_DIR;

      if (!isWindowsFolderPath(folderPath)) {
        sendJson(res, 400, { ok: false, message: 'Informe um caminho absoluto de pasta no Windows.' });
        return;
      }

      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        sendJson(res, 400, { ok: false, message: `Pasta não encontrada: ${folderPath}` });
        return;
      }

      const files = listJpegFiles(folderPath);
      sendJson(res, 200, {
        ok: true,
        folderPath,
        fileCount: files.length,
        files,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/receipt-file') {
    try {
      const body = await readJson(req);
      const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : '';
      const relativePath = typeof body.relativePath === 'string' ? body.relativePath.trim() : '';

      if (!isWindowsFolderPath(folderPath) || !relativePath) {
        sendJson(res, 400, { ok: false, message: 'Informe a pasta e o arquivo.' });
        return;
      }

      const full = resolveUnderFolder(folderPath, relativePath);
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        sendJson(res, 404, { ok: false, message: `Arquivo não encontrado: ${relativePath}` });
        return;
      }

      const fileName = path.basename(full);
      const buffer = fs.readFileSync(full);
      sendJson(res, 200, {
        ok: true,
        fileName,
        dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/rename-receipt') {
    try {
      const body = await readJson(req);
      const folderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : '';
      const relativePath = typeof body.relativePath === 'string' ? body.relativePath.trim() : '';
      const nextName = typeof body.nextName === 'string' ? body.nextName.trim() : '';

      if (!isWindowsFolderPath(folderPath) || !relativePath || !nextName) {
        sendJson(res, 400, { ok: false, message: 'Informe pasta, arquivo e novo nome.' });
        return;
      }

      if (nextName.includes('/') || nextName.includes('\\') || nextName.includes('..')) {
        sendJson(res, 400, { ok: false, message: 'Nome de arquivo inválido.' });
        return;
      }

      const full = resolveUnderFolder(folderPath, relativePath);
      const dest = path.join(path.dirname(full), nextName);
      if (!fs.existsSync(full)) {
        sendJson(res, 404, { ok: false, message: `Arquivo não encontrado: ${relativePath}` });
        return;
      }

      fs.renameSync(full, dest);
      sendJson(res, 200, { ok: true, fileName: nextName });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, message: 'Rota não encontrada.' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Conversor PDF→JPG: http://127.0.0.1:${PORT}`);
  console.log(`Padrão: ${DEFAULT_DIR}`);
  console.log('Deixe este terminal aberto.');
});
