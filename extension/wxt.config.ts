import {defineConfig} from 'wxt';

export default defineConfig({
  root: '.',
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Page Proxy',
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
