import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['electron/main.ts', 'electron/preload.ts'],
  outDir: 'dist-electron',
  format: ['cjs'],
  target: 'node18',
  clean: true,
  sourcemap: false,
  minify: true,
  external: ['electron', 'sqlite3', '@prisma/client', 'bcryptjs', 'node-zklib', 'digest-fetch'],
});
