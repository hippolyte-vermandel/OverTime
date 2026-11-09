import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node : l'application tourne comme un serveur Node.js classique,
			// sur votre PC (Windows aujourd'hui, Linux plus tard).
			adapter: adapter(),

			// Adresse publique de l'application (ex. http://192.168.1.20:3000), lue au moment du build.
			// Elle sert à la protection contre les envois de formulaires depuis un autre site.
			// Derrière un proxy HTTPS (Caddy...), on peut la laisser vide et régler PROTOCOL_HEADER.
			paths: { origin: process.env.ORIGIN || undefined }
		})
	]
});
