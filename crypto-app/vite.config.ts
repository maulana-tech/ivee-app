import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  },
  server: {
    port: 3001,
  },
  build: {
    outDir: 'dist',
  },
});
