// Source Rocket League et Call of Duty : l'API PandaScore (api.pandascore.co), offre gratuite
// « fixtures » (calendrier, équipes, résultats ; pas de direct). L'accès demande une clé
// personnelle, à mettre dans le .env (PANDASCORE_TOKEN=...) et à ne jamais publier.
// Sans clé, cette source est inactive. L'offre gratuite autorise 1 000 requêtes par heure :
// le serveur n'en fait que quelques-unes par heure.
import { bestOfValide } from './outils.js';

export const SOURCE = { code: 'pandascore', nom: 'PandaScore', licence: null };
// code : notre code de jeu ; slug : le nom du jeu dans les adresses de PandaScore
export const JEUX = [
	{ code: 'rocket', nom: 'Rocket League', slug: 'rl' },
	{ code: 'cod', nom: 'Call of Duty', slug: 'codmw' }
];

const ADRESSE = 'https://api.pandascore.co';
const PAR_PAGE = 100; // maximum de PandaScore
const PAGES_MAX = 5;

export function adresseRequete(slug, depuis, jusqua, page = 1) {
	const p = new URLSearchParams({
		'range[scheduled_at]': `${depuis.toISOString()},${jusqua.toISOString()}`,
		sort: 'scheduled_at',
		per_page: String(PAR_PAGE),
		page: String(page)
	});
	return `${ADRESSE}/${slug}/matches?${p}`;
}

/** Format de la série : « best_of 5 » -> BO5 ; « first_to 3 » -> BO5 ; le reste est ignoré */
function formatSerie(m) {
	const n = Number(m?.number_of_games);
	if (!Number.isInteger(n) || n < 1) return null;
	if (m.match_type === 'best_of') return bestOfValide(n);
	if (m.match_type === 'first_to') return bestOfValide(2 * n - 1);
	return null;
}

/**
 * @param {any} m un match PandaScore
 * @param {{ code: string }} jeu
 * @returns {import('./commun.js').MatchNormalise | null}
 */
export function versMatch(m, jeu) {
	const [a, b] = (Array.isArray(m?.opponents) ? m.opponents : []).map((o) => o?.opponent);
	const bestOf = formatSerie(m);
	const quand = new Date(m?.scheduled_at ?? m?.begin_at ?? '');
	if (!m?.id || !a || !b || !bestOf || Number.isNaN(quand.getTime())) return null;
	if (m.opponents.some((o) => o?.type && o.type !== 'Team')) return null;

	const score = (equipe) => {
		const r = (m.results ?? []).find((x) => x.team_id === equipe.id);
		return Number.isInteger(r?.score) ? r.score : null;
	};
	const fini = m.status === 'finished' && m.winner_id != null && !m.forfeit;
	const competition = [m.league?.name, m.serie?.full_name].filter(Boolean).join(' ').trim();
	return {
		id: String(m.id),
		jeu: jeu.code,
		competition: competition || `Compétition ${jeu.code}`,
		region: 'International',
		phase: String(m.tournament?.name ?? '').trim(),
		quand,
		bestOf,
		equipeA: String(a.name ?? '').trim(),
		equipeB: String(b.name ?? '').trim(),
		termine: fini,
		scoreA: score(a),
		scoreB: score(b),
		annule: m.status === 'canceled'
	};
}

/**
 * Matchs des jeux suivis entre deux dates.
 * @param {{ depuis: Date, jusqua: Date, cle: string, chercher?: typeof fetch }} o
 */
export async function lireMatchs({ depuis, jusqua, cle, chercher = fetch }) {
	if (!cle) throw new Error('aucune clé PANDASCORE_TOKEN dans le fichier .env');
	const matchs = [];
	for (const jeu of JEUX) {
		for (let page = 1; page <= PAGES_MAX; page++) {
			// La clé part dans l'en-tête, jamais dans l'adresse (qui peut finir dans des journaux)
			const r = await chercher(adresseRequete(jeu.slug, depuis, jusqua, page), { headers: { Authorization: `Bearer ${cle}`, Accept: 'application/json' } });
			if (r.status === 401 || r.status === 403) throw new Error('clé PandaScore refusée (vérifie PANDASCORE_TOKEN)');
			if (r.status === 429) throw new Error('trop de requêtes vers PandaScore, réessaie dans une heure');
			if (!r.ok) throw new Error(`PandaScore a répondu ${r.status}`);
			const lignes = await r.json();
			if (!Array.isArray(lignes)) throw new Error('réponse inattendue de PandaScore');
			for (const l of lignes) {
				const m = versMatch(l, jeu);
				if (m) matchs.push(m);
			}
			if (lignes.length < PAR_PAGE) break;
		}
	}
	return matchs;
}
