import {defineConfig} from 'vite';

const webPath = 'webapps-dev';
const app = 'blockberry-editor';

export default defineConfig(({mode}) => ({
  base: mode === 'production' ? `/static/${webPath}/${app}/` : '/',
  build: {
    outDir: 'dist/web',
    emptyOutDir: false,
  },
}));
