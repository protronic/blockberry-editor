import {defineConfig} from '@opencloud-eu/extension-sdk';

export default defineConfig({
  name: 'blockberry-editor',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
