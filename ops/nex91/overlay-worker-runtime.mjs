import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const repository = 'brunabarrichello/nexora-tms';
const workerSha = '76dc3924b9e379a29553e908d654cfd624822eb2';
const files = [
  'apps/worker/package.json',
  'apps/worker/src/config.test.ts',
  'apps/worker/src/config.ts',
  'apps/worker/src/handlers.ts',
  'apps/worker/src/health.ts',
  'apps/worker/src/logger.ts',
  'apps/worker/src/main.ts',
  'apps/worker/src/runtime.test.ts',
  'apps/worker/src/runtime.ts',
  'apps/worker/src/store.ts',
  'pnpm-lock.yaml',
];

for (const path of files) {
  const url = `https://raw.githubusercontent.com/${repository}/${workerSha}/${path}`;
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${path} from ${workerSha}: HTTP ${response.status}`);
  }
  const content = await response.text();
  if (content.length === 0) {
    throw new Error(`Refusing to write empty overlay file: ${path}`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  console.log(`NEX91_OVERLAY_FILE=${path}`);
}

console.log(`NEX91_OVERLAY_SHA=${workerSha}`);
console.log(`NEX91_OVERLAY_COUNT=${files.length}`);
