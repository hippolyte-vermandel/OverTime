import { mesParis, bilanSemaine } from '#lib/server/paris.js';

export async function load({ locals }) {
	const j = locals.joueur;
	if (!j?.ligue) return { paris: [], bilan: null };
	const [paris, bilan] = await Promise.all([mesParis(j), bilanSemaine(j)]);
	return { paris, bilan };
}
