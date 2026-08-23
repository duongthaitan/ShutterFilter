import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            minify: 'esbuild',
            rollupOptions: {
              external: ['electron', 'exifr'],
            },
          },
        },
      },
      preload: {
        input: 'src/main/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            minify: 'esbuild',
          },
        },
      },
    }),
  ],
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
    cssMinify: true,
  },
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
  },
});
