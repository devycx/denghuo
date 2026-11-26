import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Windows 上 esbuild 的临时目录常被安全软件锁住，指到项目内目录即可稳定构建。
const tmp = resolve('.tmp');
mkdirSync(tmp, { recursive: true });
const env = { ...process.env };
if (process.platform === 'win32') {
  env.TEMP = tmp;
  env.TMP = tmp;
  env.TMPDIR = tmp;
}

const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env,
});
process.exit(result.status ?? 1);
