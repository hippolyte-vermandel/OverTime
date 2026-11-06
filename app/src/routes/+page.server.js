import { prochainsMatchs } from '#lib/server/matchs.js';

// Ce code tourne sur le serveur à chaque visite de la page d'accueil :
// il lit les prochains matchs dans PostgreSQL et les transmet à la page.
export async function load() {
	try {
		return { matchs: await prochainsMatchs(), erreur: null };
	} catch (e) {
		console.error('Lecture des matchs impossible :', e);
		return {
			matchs: [],
			erreur: "Impossible de joindre la base de données. Vérifie que PostgreSQL est lancé et que DATABASE_URL est correct dans le fichier .env."
		};
	}
}
