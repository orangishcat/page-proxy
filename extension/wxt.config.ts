import {defineConfig} from 'wxt';
import {fileURLToPath} from 'node:url';

const monacoMainCssStubPath = fileURLToPath(
  new URL('./src/lib/code-editor/empty-monaco-main.css', import.meta.url),
);
const monacoCodiconCssStubPath = fileURLToPath(
  new URL('./src/lib/code-editor/empty-monaco-codicon.css', import.meta.url),
);

export default defineConfig({
  root: '.',
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/module-svelte'],
  vite: () => ({
    resolve: {
      alias: [
        {
          find: 'monaco-editor/min/vs/editor/editor.main.css',
          replacement: monacoMainCssStubPath,
        },
        {
          find: 'monaco-editor/dev/vs/editor/editor.main.css',
          replacement: monacoMainCssStubPath,
        },
        {
          find: /^(?:\.\.\/)+base\/browser\/ui\/codicons\/codicon\/codicon\.css$/,
          replacement: monacoCodiconCssStubPath,
        },
      ],
    },
    esbuild: {
      charset: 'ascii'
    },
    build: {
      assetsInlineLimit: 0
    }
  }),
  manifest: {
    name: 'Page Proxy',
    version: '0.1.0',
    description: 'Proxy and restyle pages with an extension-based UI.',
    action: {
      default_title: 'Page Proxy',
      default_icon: {
        16: 'logo_filled.png',
        32: 'logo_filled.png',
        48: 'logo_filled.png',
        128: 'logo_filled.png'
      }
    },
    icons: {
      16: 'logo_filled.png',
      32: 'logo_filled.png',
      48: 'logo_filled.png',
      128: 'logo_filled.png'
    },
    permissions: ['storage', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['page-wrapper.js', 'sandbox-main-world.js', 'code-runner-main-world.js', 'tailwindcss.min.js'],
        matches: ['<all_urls>']
      }
    ]
  }
});
