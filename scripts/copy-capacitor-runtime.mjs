import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/@capacitor/core/dist/capacitor.js');
const target = resolve(root, 'www/capacitor.js');

if (!existsSync(source)) {
  console.error('[Capacitor runtime] Missing:', source);
  console.error('Run npm install first.');
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log('[Capacitor runtime] copied to www/capacitor.js');
