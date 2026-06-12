import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'public', 'build-info.json');

let commit = 'unknown';

try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  commit = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown';
}

const info = {
  commit,
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(outPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
console.log(`build-info.json → commit ${commit}`);
