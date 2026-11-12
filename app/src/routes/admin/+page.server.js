import { error, fail } from '@sveltejs/kit';
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
import { noterRangs } from '#lib/server/paris.js';
import { jeuxLobby, apercuEpreuve, creerEpreuve, epreuvesAClasser, classerEpreuve } from '#lib/server/lobby.js';
import { SOURCES, derniers, importerMaintenant } from '#lib/server/import/index.js';

// Réservé aux administrateurs de la ligue
function exigerAdmin(locals) {
	const j = locals.joueur;
	if (!j?.ligue || !j.estAdmin) error(403, 'Cette page est réservée à l’administrateur de la ligue.');
	return j;
}

export async function load({ locals }) {
	const j = exigerAdmin(locals);
	const [jeux, jeuxLobbys, epreuves, ref, resultats, liste, code] = await Promise.all([
		jeuxDuels(),
		jeuxLobby(),
		epreuvesAClasser(),
		referentiel(),
		resultatsAValider(),
		membres(j.ligue.id),
		codeInvitation(j.ligue.id)
	]);
	const sources = SOURCES.map((s) => ({ cle: s.cle, jeu: s.jeu, nom: s.nom, lien: s.lien, variable: s.variable ?? null, active: s.active(), dernier: derniers[s.cle] ?? null }));
	return { jeux, jeuxLobby: jeuxLobbys, epreuves, ...ref, resultats, membres: liste, code, sources };
}

// Transforme une erreur en message pour l'administrateur
function echec(e, action, champs = {}) {
	if (e instanceof ErreurSaisie || e?.code === 'P0001') return fail(400, { action, erreur: e.message, ...champs });
	console.error(`Administration (${action}) :`, e);
	return fail(500, { action, erreur: 'Une erreur est survenue. Réessaie dans un instant.', ...champs });
}

export const actions = {
	// Import automatique des matchs (Leaguepedia, Liquipedia) : aperçu sans rien écrire, ou import réel
	importer: async ({ request, locals }) => {
		const j = exigerAdmin(locals);
		const f = await request.formData();
		const source = String(f.get('source') ?? '');
		if (!SOURCES.some((s) => s.cle === source)) return fail(400, { action: 'importer', erreur: 'Source inconnue.' });
		const apercu = f.get('apercu') === 'oui';
		const r = await importerMaintenant(source, apercu);
		if (!apercu && !r.erreur) await noterRangs(j.ligue.id).catch((e) => console.error('Relevé des rangs :', e.message));
		return r.erreur ? fail(502, { action: 'importer', erreur: r.texte }) : { action: 'importer', succes: r.texte, exemples: r.exemples ?? null };
	},

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

	// Épreuve en lobby : aperçu des cotes (rien n'est enregistré) ou création avec ses paris « top X »
	epreuve: async ({ request, locals }) => {
		exigerAdmin(locals);
		const f = Object.fromEntries(await request.formData());
		const champs = { valeurs: f };
		if (!f.jeu || !String(f.competition ?? '').trim() || !String(f.participants ?? '').trim() || !f.date || !f.heure)
			return fail(400, { action: 'epreuve', erreur: 'Remplis le jeu, la compétition, la date, l’heure et la liste des participants.', ...champs });
		const e = {
			jeu: String(f.jeu),
			competition: String(f.competition).trim(),
			region: String(f.region ?? '').trim(),
			phase: String(f.phase ?? '').trim(),
			quand: await instant(`${f.date}T${f.heure}`),
			texte: String(f.participants)
		};
		try {
			if (f.apercu === 'oui') {
				const a = await apercuEpreuve(e.jeu, e.texte, e.quand);
				const groupes = [...a.groupes].sort((x, y) => y.note - x.note);
				return { action: 'epreuve', apercu: { seuils: a.seuils, depart: a.depart, groupes }, ...champs };
			}
			const r = await creerEpreuve(e);
			return { action: 'epreuve', succes: `Épreuve ajoutée : ${r.nb} participants, paris ${r.seuils.map((x) => (x === 1 ? 'vainqueur' : `top ${x}`)).join(', ')} ouverts (${r.depart}).` };
		} catch (err) {
			return echec(err, 'epreuve', champs);
		}
	},

	// Classement final collé : règle tous les paris « top X » de l'épreuve
	classer: async ({ request, locals }) => {
		exigerAdmin(locals);
		const f = await request.formData();
		const serie = Number(f.get('serie'));
		try {
			const r = await classerEpreuve(serie, String(f.get('classement') ?? ''));
			await noterRangs(locals.joueur.ligue.id).catch((e) => console.error('Relevé des rangs :', e.message));
			const absents = r.absents.length ? ` ${r.absents.length} participant${r.absents.length > 1 ? 's' : ''} absent${r.absents.length > 1 ? 's' : ''} du classement : paris remboursés.` : '';
			return { action: 'resultat', succes: `Classement de ${r.classes} participants enregistré. ${r.nb} pari${r.nb > 1 ? 's' : ''} réglé${r.nb > 1 ? 's' : ''}.${absents}` };
		} catch (e) {
			return echec(e, 'classer', { serie });
		}
	},

	resultat: async ({ request, locals }) => {
		exigerAdmin(locals);
		const f = await request.formData();
		const serie = Number(f.get('serie'));
		const [scoreA, scoreB] = String(f.get('score') ?? '').split('-').map(Number);
		try {
			const { nb, gagnant } = await validerResultat(serie, scoreA, scoreB);
			await noterRangs(locals.joueur.ligue.id).catch((e) => console.error('Relevé des rangs :', e.message));
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
			await changerRole(j, id, admin);
		} catch (e) {
			return echec(e, 'membres');
		}
		return { action: 'membres', succes: admin ? 'Nouvel administrateur nommé.' : 'Rôle d’administrateur retiré.' };
	},

	motDePasse: async ({ request, locals }) => {
		const j = exigerAdmin(locals);
		const id = Number((await request.formData()).get('utilisateur'));
		try {
			const r = await reinitialiserMotDePasse(j, id);
			return { action: 'membres', reinitialise: r };
		} catch (e) {
			return echec(e, 'membres');
		}
	}
};
