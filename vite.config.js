import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	optimizeDeps: { exclude: ['layercake'] },
	plugins: [sveltekit()],
	base: "https://parabirb.github.io/transphobe-search/"
});
