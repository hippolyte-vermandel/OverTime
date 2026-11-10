import { error, json } from '@sveltejs/kit';
import { calculerCotes } from '#lib/server/cotes/index.js';
import { instant } from '#lib/server/admin.js';

// Aperçu des cotes calculées pendant la saisie d'un match (administrateur seulement).
// Les cotes enregistrées sont recalculées côté serveur au moment de l'ajout.
export async function GET({ url, locals }) {
	if (!locals.joueur?.estAdmin) error(403, 'Réservé à l’administrateur.');
	const q = url.searchParams;
	const bestOf = Number(q.get('bo'));
	const equipeA = (q.get('a') ?? '').trim();
	const equipeB = (q.get('b') ?? '').trim();
	if (!q.get('jeu') || !equipeA || !equipeB || ![1, 3, 5, 7].includes(bestOf) || !q.get('date') || !q.get('heure'))
		return json({ incomplet: true });
	if (equipeA.toLowerCase() === equipeB.toLowerCase()) return json({ incomplet: true });
	const quand = await instant(`${q.get('date')}T${q.get('heure')}`);
	return json(await calculerCotes({ jeu: q.get('jeu'), equipeA, equipeB, bestOf, quand }));
}
