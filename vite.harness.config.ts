import vue from '@vitejs/plugin-vue';
import {defineConfig} from 'vite';
import {buildInfoDefine} from './build-info';

// Dev-only config for test/harness: mounts src/App.vue the same way the
// OpenCloud AppWrapper does, without Module Federation.
export default defineConfig({
  root: 'test/harness',
  plugins: [vue()],
  define: buildInfoDefine(),
  server: {
    port: 5199,
    strictPort: true,
  },
});
