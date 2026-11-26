import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Windows 上 workerd/miniflare 的默认临时目录常被拒绝访问，指到项目内目录。
const tmp = resolve('.tmp');
mkdirSync(tmp, { recursive: true });
const env = { ...process.env };
if (process.platform === 'win32') {
  env.TEMP = tmp;
  env.TMP = tmp;
  env.TMPDIR = tmp;
}

const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'dev', '--host', '0.0.0.0', '--port', '5173'],
  { stdio: 'inherit', env }
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 0));
