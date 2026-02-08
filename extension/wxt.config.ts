import {fileURLToPath} from 'node:url';
import {defineConfig} from 'wxt';

const rootNodeModules = fileURLToPath(new URL('../node_modules/', import.meta.url));

const codemirrorAliases = {
  '@codemirror/autocomplete': `${rootNodeModules}@codemirror/autocomplete`,
  '@codemirror/commands': `${rootNodeModules}@codemirror/commands`,
  '@codemirror/lang-javascript': `${rootNodeModules}@codemirror/lang-javascript`,
  '@codemirror/language': `${rootNodeModules}@codemirror/language`,
  '@codemirror/lint': `${rootNodeModules}@codemirror/lint`,
  '@codemirror/state': `${rootNodeModules}@codemirror/state`,
  '@codemirror/view': `${rootNodeModules}@codemirror/view`,
  '@lezer/common': `${rootNodeModules}@lezer/common`,
  '@lezer/highlight': `${rootNodeModules}@lezer/highlight`,
  '@lezer/lr': `${rootNodeModules}@lezer/lr`
};

export default defineConfig({
  root: '.',
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/module-svelte'],
  vite: () => ({
    resolve: {
      alias: codemirrorAliases,
      dedupe: [
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/lang-javascript',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr'
      ]
    },
    esbuild: {
      charset: 'ascii'
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
