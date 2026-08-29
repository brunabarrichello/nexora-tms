import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EXPECTED_NODE = '24.20.0';
const EXPECTED_PNPM = '11.24.0';
const root = fileURLToPath(new URL('../', import.meta.url));
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const failures = [];

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`✓ ${label}: ${actual}`);
    return;
  }

  failures.push(`${label}: expected ${expected}, found ${actual || 'not available'}`);
  console.error(`✗ ${label}: expected ${expected}, found ${actual || 'not available'}`);
}

check('Node.js', process.versions.node, EXPECTED_NODE);

const pnpm = spawnSync(pnpmCommand, ['--version'], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
});

check('pnpm', pnpm.status === 0 ? pnpm.stdout.trim() : '', EXPECTED_PNPM);

const lockfile = new URL('../pnpm-lock.yaml', import.meta.url);
if (existsSync(lockfile)) {
  console.log('✓ pnpm-lock.yaml: present');
} else {
  failures.push('pnpm-lock.yaml: missing');
  console.error('✗ pnpm-lock.yaml: missing');
}

if (failures.length > 0) {
  console.error('\nNexora toolchain check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nNexora local toolchain is ready.');
