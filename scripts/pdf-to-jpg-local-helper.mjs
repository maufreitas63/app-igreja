/**
 * Helper local: o PWA pede a conversão; este processo grava JPG no disco.
 *
 * Uso (deixar aberto neste computador):
 *   node scripts/pdf-to-jpg-local-helper.mjs
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const converter = path.join(root, 'scripts', 'convert-pdf-folder-to-jpg.mjs');
const PORT = Number.parseInt(process.env.PDF_TO_JPG_HELPER_PORT || '47821', 10);
const DEFAULT_DIR = String.raw`C:\IBN Tesouraria\Comprovantes\JPG`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
  res.end(JSON.stringify(body));
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
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, defaultDir: DEFAULT_DIR });
    return;
  }

  if (req.method === 'POST' && req.url === '/convert') {
    try {
      const body = await readJson(req);
      const folderPath =
        typeof body.folderPath === 'string' && body.folderPath.trim()
          ? body.folderPath.trim()
          : DEFAULT_DIR;

      if (!/^[A-Za-z]:[\\/]/.test(folderPath) && !folderPath.startsWith('\\\\')) {
        send(res, 400, { ok: false, message: 'Informe um caminho absoluto de pasta no Windows.' });
        return;
      }

      const result = await runConverter(folderPath);
      const summary = parseSummary(result.stdout);

      send(res, result.code === 0 ? 200 : 500, {
        ok: result.code === 0,
        folderPath,
        okCount: summary.ok,
        skipped: summary.skipped,
        failed: summary.failed,
        pages: summary.pages,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (error) {
      send(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  send(res, 404, { ok: false, message: 'Rota não encontrada.' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Helper PDF→JPG em http://127.0.0.1:${PORT}`);
  console.log(`Padrão: ${DEFAULT_DIR}`);
  console.log('Deixe este terminal aberto enquanto usar o botão no PWA.');
});
