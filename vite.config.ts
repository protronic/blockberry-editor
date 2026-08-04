import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from '@opencloud-eu/extension-sdk';
import type {Plugin} from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const blocklyMediaSrc = join(root, 'node_modules/blockly/media');

/** Copy Blockly sprites/icons into dist so OpenCloud CSP (img-src 'self') allows them. */
function copyBlocklyMedia(): Plugin {
  return {
    name: 'copy-blockly-media',
    closeBundle() {
      if (!existsSync(blocklyMediaSrc)) {
        throw new Error(`Blockly media not found at ${blocklyMediaSrc}`);
      }
      const outDir = join(root, 'dist/web/media');
      mkdirSync(outDir, {recursive: true});
      cpSync(blocklyMediaSrc, outDir, {recursive: true});
    },
  };
}

export default defineConfig({
  name: 'blockberry-editor',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  plugins: [copyBlocklyMedia()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
