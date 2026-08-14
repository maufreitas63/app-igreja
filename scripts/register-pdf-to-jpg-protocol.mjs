/**
 * Registra o protocolo conectapdfjpg:// no Windows (HKCU, sem admin).
 * O botão do PWA abre esse protocolo para converter PDF → JPG no disco.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const host = path.join(root, 'scripts', 'pdf-to-jpg-protocol-host.mjs');
const command = `"${process.execPath}" "${host}" "%1"`;
const key = 'HKCU\\Software\\Classes\\conectapdfjpg';

execFileSync('reg', ['add', key, '/ve', '/d', 'URL:Conecta PDF JPG', '/f'], { stdio: 'inherit' });
execFileSync('reg', ['add', key, '/v', 'URL Protocol', '/d', '', '/f'], { stdio: 'inherit' });
execFileSync('reg', ['add', `${key}\\shell\\open\\command`, '/ve', '/d', command, '/f'], {
  stdio: 'inherit',
});

console.log('Protocolo conectapdfjpg:// registrado.');
console.log(command);
