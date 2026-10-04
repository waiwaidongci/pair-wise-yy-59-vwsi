// 用 esbuild 把 TS store 打包成临时 ESM，供 Node 逻辑验证（注入 localStorage 垫片）
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const outfile = new URL('./.store-bundle.tmp.mjs', import.meta.url);

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

export async function buildBundle() {
  globalThis.localStorage = new MemoryStorage();
  await build({
    entryPoints: [new URL('../src/store.ts', import.meta.url).pathname],
    outfile: outfile.pathname,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent'
  });
  const mod = await import(pathToFileURL(outfile.pathname).href);
  await rm(outfile.pathname, { force: true });
  return mod;
}
