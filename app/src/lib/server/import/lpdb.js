// Source VALORANT : l'API LPDB de Liquipedia (api.liquipedia.net, version 3).
// L'accès demande une clé personnelle, accordée pour un seul jeu (VALORANT) :
// elle se met dans le .env (LPDB_API_KEY=...) et ne doit jamais être publiée sur GitHub.
// Sans clé, cette source est simplement inactive. Conditions de Liquipedia : code ouvert,
// données citées (CC BY-SA 3.0), et des requêtes économes (le serveur ne l'interroge
// qu'une fois par heure, en quelques requêtes).
import { bestOfValide } from './outils.js';

export const SOURCE = { code: 'liquipedia', nom: 'Liquipedia', licence: 'CC BY-SA 3.0' };
export const JEU = { code: 'valorant', nom: 'VALORANT' };

const ADRESSE = 'https://api.liquipedia.net/api/v3/match';
const AGENT = 'OverTime/0.1 (application de pronostics entre amis ; https://github.com/hippolyte-vermandel/OverTime)';
const PAR_PAGE = 500;
const PAGES_MAX = 4;


const dateLpdb = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

export function adresseRequete(depuis, jusqua, niveaux, decalage = 0) {
	const conditions = [
		`[[date::>${dateLpdb(depuis)}]]`,
		`[[date::<${dateLpdb(jusqua)}]]`,
		niveaux.length ? `(${niveaux.map((n) => `[[liquipediatier::${n}]]`).join(' OR ')})` : null
	].filter(Boolean);
	const p = new URLSearchParams({
		wiki: 'valorant',
		conditions: conditions.join(' AND '),
		query: 'match2id,date,dateexact,finished,winner,bestof,resulttype,tournament,tickername,section,match2opponents',
		order: 'date ASC',
		limit: String(PAR_PAGE),
		offset: String(decalage)
	});
	return `${ADRESSE}?${p}`;
}

const entier = (v) => {
	const n = Number.parseInt(String(v ?? ''), 10);
	return Number.isNaN(n) ? null : n;
};

const logo = (adversaire) => {
	const t = adversaire?.teamtemplate;
	const url = t?.imagedarkurl || t?.imageurl || null;
	return typeof url === 'string' && url.startsWith('https://') ? url : null;
};

/** @returns {import('./commun.js').MatchNormalise | null} */
export function versMatch(r) {
	const [a, b] = Array.isArray(r?.match2opponents) ? r.match2opponents : [];
	const bestOf = bestOfValide(entier(r?.bestof) ?? 1);
	if (!r?.match2id || !r?.date || !a || !b || !bestOf) return null;
	if ((a.type && a.type !== 'team') || (b.type && b.type !== 'team')) return null;
	const date = new Date(String(r.date).replace(' ', 'T') + 'Z');
	if (Number.isNaN(date.getTime())) return null;
	const fini = r.finished === 1 || r.finished === '1' || r.finished === true;
	const gagnant = String(r.winner ?? '');
	const scoreA = entier(a.score);
	const scoreB = entier(b.score);
	return {
		id: String(r.match2id),
		jeu: JEU.code,
		competition: String(r.tickername || r.tournament || '').trim() || 'Compétition VALORANT',
		region: 'International',
		phase: String(r.section ?? '').trim(),
		quand: date,
		bestOf,
		equipeA: String(a.name ?? '').trim(),
		equipeB: String(b.name ?? '').trim(),
		termine: fini && (gagnant === '1' || gagnant === '2') && scoreA !== null && scoreA >= 0 && scoreB !== null && scoreB >= 0,
		scoreA,
		scoreB,
		// « np » : match qui ne sera pas joué
		annule: fini && r.resulttype === 'np',
		// Sigle et logo de l'équipe (modèle d'équipe Liquipedia). Le logo « sombre »,
		// prévu pour les fonds foncés, convient mieux au thème d'OverTime.
		sigleA: a.teamtemplate?.shortname ?? null,
		sigleB: b.teamtemplate?.shortname ?? null,
		logoA: logo(a),
		logoB: logo(b)
	};
}

/**
 * Matchs VALORANT entre deux dates. niveaux : 1 = VCT et grands tournois.
 * @param {{ depuis: Date, jusqua: Date, cle: string, niveaux: string[], chercher?: typeof fetch }} o
 */
export async function lireMatchs({ depuis, jusqua, cle, niveaux, chercher = fetch }) {
	if (!cle) throw new Error('aucune clé LPDB_API_KEY dans le fichier .env');
	const matchs = [];
	for (let page = 0; page < PAGES_MAX; page++) {
		const r = await chercher(adresseRequete(depuis, jusqua, niveaux, page * PAR_PAGE), {
			headers: { Authorization: `Apikey ${cle}`, Accept: 'application/json', 'Accept-Encoding': 'gzip', 'User-Agent': AGENT }
		});
		if (r.status === 401 || r.status === 403) throw new Error('clé LPDB refusée (vérifie LPDB_API_KEY)');
		if (!r.ok) throw new Error(`Liquipedia a répondu ${r.status}`);
		const corps = await r.json();
		const lignes = corps?.result;
		if (!Array.isArray(lignes)) throw new Error(corps?.error?.[0] ?? 'réponse inattendue de Liquipedia');
		for (const l of lignes) {
			const m = versMatch(l);
			if (m) matchs.push(m);
		}
		if (lignes.length < PAR_PAGE) break;
	}
	return matchs;
}
