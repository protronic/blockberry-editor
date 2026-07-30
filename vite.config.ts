import {defineConfig} from '@opencloud-eu/extension-sdk';

export default defineConfig({
  name: 'blockberry-editor',
  build: {
    outDir: 'dist/web',
    emptyOutDir: false,
  },
});
