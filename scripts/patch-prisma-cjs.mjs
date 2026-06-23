import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'dist/src/lib/generated/prisma/client.js');

if (!existsSync(target)) {
  console.error('[patch-prisma-cjs] File not found:', target);
  process.exit(1);
}

let content = readFileSync(target, 'utf8');

// Replace import.meta.url with CJS-compatible equivalent
// This is needed because tsc compiles the Prisma-generated ESM .ts to CJS .js
// but leaves import.meta.url verbatim, which Node.js v24+ treats as ESM scope.
content = content.replace(/import\.meta\.url/g, 'require("url").pathToFileURL(__filename).href');

// Also remove any remaining ESM hint that could confuse Node's module detection
// The Prisma generator may write an .mjs extension hint — strip top-level import.meta usage

writeFileSync(target, content, 'utf8');
console.log('[patch-prisma-cjs] Patched import.meta.url in', target);
