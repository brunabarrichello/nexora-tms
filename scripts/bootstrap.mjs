import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('Nexora TMS local bootstrap');
console.log('==========================\n');

run(process.execPath, ['scripts/doctor.mjs']);
console.log('\nInstalling workspace dependencies from the committed lockfile...');
run(pnpmCommand, ['install', '--frozen-lockfile']);

console.log('\nBootstrap complete.');
console.log('Next commands:');
console.log('  pnpm validate');
console.log('  pnpm dev:web');
console.log('  pnpm dev:api');
console.log('  pnpm dev:worker');
console.log(
  '\nBefore starting the API, configure runtime environment variables from apps/api/.env.example.',
);
