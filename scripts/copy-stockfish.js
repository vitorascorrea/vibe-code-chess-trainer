import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dest = resolve(root, 'public/stockfish');

if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

const stockfishDir = resolve(root, 'node_modules/stockfish/src');

const files = ['stockfish-nnue-16-single.js', 'stockfish-nnue-16-single.wasm'];
for (const file of files) {
  const src = resolve(stockfishDir, file);
  if (existsSync(src)) {
    copyFileSync(src, resolve(dest, file));
    console.log(`Copied ${file}`);
  } else {
    console.warn(`Not found: ${src}`);
  }
}
