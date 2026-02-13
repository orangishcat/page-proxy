import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  plugins: [sveltekit()],
  base: command === 'serve' ? '/' : '/page-proxy/'
}));
