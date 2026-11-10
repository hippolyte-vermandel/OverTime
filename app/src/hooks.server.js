import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.js';
import { chargerJoueur } from '#lib/server/joueur.js';

// Pages accessibles sans être connecté
const PUBLIQUES = ['/connexion', '/inscription'];

export async function handle({ event, resolve }) {
	event.locals.joueur = null;

	if (!building) {
		const session = await auth.api.getSession({ headers: event.request.headers });
		if (session) event.locals.joueur = await chargerJoueur(session.user.id);

		// OverTime est privé : sans compte, on est renvoyé vers la connexion
		const chemin = event.url.pathname;
		const libre = PUBLIQUES.includes(chemin) || chemin.startsWith('/api/auth');
		if (!event.locals.joueur && !libre) {
			if (chemin.startsWith('/api/')) return new Response('Connexion requise', { status: 401 });
			return new Response(null, { status: 303, headers: { location: '/connexion' } });
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
