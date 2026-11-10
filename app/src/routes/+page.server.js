import { prochainsMatchs, sourcesCitees } from '#lib/server/matchs.js';
import { matchsParies } from '#lib/server/paris.js';

// Ce code tourne sur le serveur à chaque visite de la page d'accueil :
// il lit les prochains matchs dans PostgreSQL et les transmet à la page,
// avec les matchs sur lesquels le joueur a déjà parié (un seul pari par match).
export async function load({ locals }) {
	try {
		const [matchs, paries, sources] = await Promise.all([prochainsMatchs(), matchsParies(locals.joueur), sourcesCitees()]);
		return { matchs, paries, sources, erreur: null };
	} catch (e) {
		console.error('Lecture des matchs impossible :', e);
		return {
			matchs: [],
			paries: {},
			sources: [],
			erreur: "Impossible de joindre la base de données. Vérifie que PostgreSQL est lancé et que DATABASE_URL est correct dans le fichier .env."
		};
	}
}
