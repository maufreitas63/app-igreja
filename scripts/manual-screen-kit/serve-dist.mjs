import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DIST_DIR = path.resolve(__dirname, '..', '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root)) return null;
  return abs;
}

function resolveFile(absPath) {
  if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) return absPath;
  if (fs.existsSync(`${absPath}.html`)) return `${absPath}.html`;
  if (fs.existsSync(path.join(absPath, 'index.html'))) return path.join(absPath, 'index.html');
  return null;
}

/**
 * @param {number} [port=8765]
 */
export async function startDistServer(port = 8765) {
  const server = http.createServer((req, res) => {
    const urlPath = req.url === '/' ? '/index.html' : req.url ?? '/index.html';
    const abs = safeJoin(DIST_DIR, urlPath);
    if (!abs) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const file = resolveFile(abs) ?? path.join(DIST_DIR, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }

    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
