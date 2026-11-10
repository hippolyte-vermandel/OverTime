import { error, fail, redirect } from '@sveltejs/kit';
import {
	jeuxDuels,
	referentiel,
	creerMatch,
	enregistrerMatchPasse,
	instant,
	resultatsAValider,
	validerResultat,
	annulerMatch,
	membres,
	codeInvitation,
	reinitialiserMotDePasse,
	changerRole,
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

export const actions = {
	creer: async ({ request, locals }) => {
		exigerAdmin(locals);
		const f = Object.fromEntries(await request.formData());
		const champs = { valeurs: f };
		const passe = f.deja_joue === 'on';
		if (!f.jeu || !String(f.competition ?? '').trim() || !String(f.equipe_a ?? '').trim() || !String(f.equipe_b ?? '').trim() || !f.date || !f.heure)
			return fail(400, { action: 'creer', erreur: 'Remplis le jeu, la compétition, les deux équipes, la date et l’heure.', ...champs });
		const bestOf = Number(f.best_of);
		if (![1, 3, 5, 7].includes(bestOf)) return fail(400, { action: 'creer', erreur: 'Le format doit être BO1, BO3, BO5 ou BO7.', ...champs });

		const m = {
			jeu: String(f.jeu),
			competition: String(f.competition).trim(),
			region: String(f.region ?? '').trim(),
			phase: String(f.phase ?? '').trim(),
			quand: await instant(`${f.date}T${f.heure}`),
			bestOf,
			equipeA: String(f.equipe_a).trim(),
			equipeB: String(f.equipe_b).trim()
		};
		try {
			if (passe) {
				await enregistrerMatchPasse({ ...m, scoreA: Number(f.score_a), scoreB: Number(f.score_b) });
				return { action: 'creer', succes: `Résultat ${m.equipeA} ${f.score_a}-${f.score_b} ${m.equipeB} enregistré dans l’historique.` };
			}
			await creerMatch(m);
		} catch (e) {
			return echec(e, 'creer', champs);
		}
		return { action: 'creer', succes: `${m.equipeA} contre ${m.equipeB} est ajouté, avec ses cotes. Les paris sont ouverts.` };
	},

	resultat: async ({ request, locals }) => {
		exigerAdmin(locals);
		const f = await request.formData();
		const serie = Number(f.get('serie'));
		const [scoreA, scoreB] = String(f.get('score') ?? '').split('-').map(Number);
		try {
			const { nb, gagnant } = await validerResultat(serie, scoreA, scoreB);
			return { action: 'resultat', succes: `Victoire de ${gagnant} (${scoreA}-${scoreB}) validée. ${nb} pari${nb > 1 ? 's' : ''} réglé${nb > 1 ? 's' : ''}.` };
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

	role: async ({ request, locals }) => {
		const j = exigerAdmin(locals);
		const f = await request.formData();
		const id = Number(f.get('utilisateur'));
		const admin = f.get('admin') === 'oui';
		try {
			await changerRole(j.ligue.id, id, admin);
		} catch (e) {
			return echec(e, 'membres');
		}
		// Qui se retire lui-même le rôle n'a plus accès à cette page
		if (id === j.id && !admin) redirect(303, '/profil');
		return { action: 'membres', succes: admin ? 'Nouvel administrateur nommé.' : 'Rôle d’administrateur retiré.' };
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
