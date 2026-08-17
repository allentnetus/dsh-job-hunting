import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distPath = path.join(repoRoot, 'dist');

if (path.basename(distPath) !== 'dist' || path.dirname(distPath) !== repoRoot) {
  throw new Error(`Refusing to clean unexpected path: ${distPath}`);
}

await rm(distPath, { recursive: true, force: true });
