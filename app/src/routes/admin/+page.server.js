import { error, fail } from '@sveltejs/kit';
import {
	jeuxDuels,
	referentiel,
	creerMatch,
	resultatsAValider,
	validerVainqueur,
	annulerMatch,
	membres,
	codeInvitation,
	reinitialiserMotDePasse,
	ErreurSaisie
} from '#lib/server/admin.js';

// Réservé aux administrateurs de la ligue
function exigerAdmin(locals) {
	const j = locals.joueur;
	if (!j?.ligue || j.role !== 'admin') error(403, 'Cette page est réservée à l’administrateur de la ligue.');
	return j;
}

export async function load({ locals }) {
	const j = exigerAdmin(locals);
	const [jeux, ref, resultats, liste, code] = await Promise.all([
		jeuxDuels(),
		referentiel(),
		resultatsAValider(),
		membres(j.ligue.id),
		codeInvitation(j.ligue.id)
	]);
	return { jeux, ...ref, resultats, membres: liste, code };
}

// Transforme une erreur en message pour l'administrateur
function echec(e, action, champs = {}) {
	if (e instanceof ErreurSaisie || e?.code === 'P0001') return fail(400, { action, erreur: e.message, ...champs });
	console.error(`Administration (${action}) :`, e);
	return fail(500, { action, erreur: 'Une erreur est survenue. Réessaie dans un instant.', ...champs });
}

const cote = (v) => Number(String(v ?? '').replace(',', '.'));

export const actions = {
	creer: async ({ request, locals }) => {
		exigerAdmin(locals);
		const f = Object.fromEntries(await request.formData());
		const champs = { valeurs: f };
		const m = {
			jeu: String(f.jeu ?? ''),
			competition: String(f.competition ?? '').trim(),
			region: String(f.region ?? '').trim(),
			phase: String(f.phase ?? '').trim(),
			quand: `${f.date}T${f.heure}`,
			bestOf: Number(f.best_of),
			equipeA: String(f.equipe_a ?? '').trim(),
			equipeB: String(f.equipe_b ?? '').trim(),
			coteA: cote(f.cote_a),
			coteB: cote(f.cote_b)
		};
		if (!m.jeu || !m.competition || !m.equipeA || !m.equipeB || !f.date || !f.heure)
			return fail(400, { action: 'creer', erreur: 'Remplis le jeu, la compétition, les deux équipes, la date et l’heure.', ...champs });
		if (![1, 3, 5, 7].includes(m.bestOf)) return fail(400, { action: 'creer', erreur: 'Le format doit être BO1, BO3, BO5 ou BO7.', ...champs });
		if (!(m.coteA >= 1.01 && m.coteB >= 1.01 && m.coteA <= 100 && m.coteB <= 100))
			return fail(400, { action: 'creer', erreur: 'Chaque cote doit être comprise entre 1,01 et 100.', ...champs });

		try {
			await creerMatch(m);
		} catch (e) {
			return echec(e, 'creer', champs);
		}
		return { action: 'creer', succes: `${m.equipeA} contre ${m.equipeB} est ajouté. Les paris sont ouverts.` };
	},

	vainqueur: async ({ request, locals }) => {
		exigerAdmin(locals);
		const f = await request.formData();
		const serie = Number(f.get('serie'));
		const gagnant = String(f.get('gagnant') ?? '');
		try {
			const nb = await validerVainqueur(serie, gagnant);
			return { action: 'resultat', succes: `Victoire de ${gagnant} validée. ${nb} pari${nb > 1 ? 's' : ''} réglé${nb > 1 ? 's' : ''}.` };
		} catch (e) {
			return echec(e, 'resultat');
		}
	},

	annuler: async ({ request, locals }) => {
		exigerAdmin(locals);
		const serie = Number((await request.formData()).get('serie'));
		try {
			await annulerMatch(serie);
			return { action: 'resultat', succes: 'Match annulé : les paris sont remboursés selon les règles.' };
		} catch (e) {
			return echec(e, 'resultat');
		}
	},

	motDePasse: async ({ request, locals }) => {
		const j = exigerAdmin(locals);
		const id = Number((await request.formData()).get('utilisateur'));
		try {
			const r = await reinitialiserMotDePasse(j.ligue.id, id);
			return { action: 'membres', reinitialise: r };
		} catch (e) {
			return echec(e, 'membres');
		}
	}
};
