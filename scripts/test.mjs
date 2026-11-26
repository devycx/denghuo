import { spawnSync } from 'node:child_process';
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

const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run'], {
  stdio: 'inherit',
  env,
});
process.exit(result.status ?? 1);
