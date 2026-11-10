import { classement, saisonCourante, dernierPari } from '#lib/server/paris.js';

export async function load({ locals, url }) {
	const j = locals.joueur;
	if (!j?.ligue) return { vide: true };
	const periode = url.searchParams.get('periode') === 'semaine' ? 'semaine' : 'saison';
	const [saison, cl] = await Promise.all([saisonCourante(j.ligue.id), classement(j.ligue.id, periode)]);

	// Le rival : le membre classé juste devant soi
	const rang = cl.classes.findIndex((l) => l.id === j.id);
	let rival = null;
	if (rang > 0) {
		const devant = cl.classes[rang - 1];
		rival = { pseudo: devant.pseudo, ecart: devant.rendement - cl.classes[rang].rendement, dernier: await dernierPari(j.ligue.id, devant.id) };
	}
	return { periode, saison, ...cl, rival, moi: j.id };
}
