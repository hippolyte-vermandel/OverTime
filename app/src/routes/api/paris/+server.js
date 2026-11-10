import { json } from '@sveltejs/kit';
import { requete } from '#lib/server/db.js';

// Placer un pari : { mise: 50, issues: [12, 37] }
// Toutes les vérifications (ligue, solde, mise, marchés ouverts) sont faites
// par la fonction placer_pari de la base, en une seule opération.
export async function POST({ request, locals }) {
	const joueur = locals.joueur;
	if (!joueur?.ligue) return json({ erreur: 'Rejoins une ligue pour parier.' }, { status: 403 });

	const corps = await request.json().catch(() => null);
	const mise = Number(corps?.mise);
	const issues = Array.isArray(corps?.issues) ? corps.issues.map(Number) : [];
	if (!Number.isInteger(mise) || issues.length === 0 || issues.some((i) => !Number.isInteger(i)))
		return json({ erreur: 'Pari incomplet.' }, { status: 400 });

	try {
		const [{ pari }] = await requete('SELECT placer_pari($1, $2, $3, $4::int[]) AS pari', [joueur.id, joueur.ligue.id, mise, issues]);
		const [{ solde }] = await requete('SELECT solde($1, $2) AS solde', [joueur.ligue.id, joueur.id]);
		return json({ pari, solde });
	} catch (e) {
		// Les refus de la base (solde insuffisant, paris fermés...) sont des messages en français
		if (e.code === 'P0001') return json({ erreur: e.message }, { status: 400 });
		console.error('Pari impossible :', e);
		return json({ erreur: 'Le pari n’a pas pu être enregistré. Réessaie dans un instant.' }, { status: 500 });
	}
}
