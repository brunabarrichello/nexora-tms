import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url));

async function collectSpecs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const specs = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      specs.push(...(await collectSpecs(path)));
    } else if (entry.isFile() && entry.name.endsWith('.spec.js')) {
      specs.push(path);
    }
  }

  return specs;
}

const specs = (await collectSpecs(distDirectory)).sort();

if (specs.length === 0) {
  throw new Error('No compiled API spec files were found');
}

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--test', ...specs], {
    stdio: 'inherit',
  });

  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});

process.exitCode = exitCode;
