// Power Rankings de Fortnite Tracker : le classement des joueurs pros de Fortnite,
// qui sert de note de départ aux cotes. API officielle de Tracker Network, avec une clé
// gratuite (FORTNITE_TRACKER_KEY dans le .env, créée sur fortnitetracker.com/site-api).
// Le classement change peu : il est gardé en mémoire 24 heures.
const ADRESSE = 'https://api.fortnitetracker.com/v1/powerrankings/top500';
const UN_JOUR = 86_400_000;
let cache = /** @type {{ quand: number, pseudos: string[] } | null} */ (null);

/** Extrait les pseudos, du meilleur au moins bon, d'une réponse dont le format exact reste à confirmer */
export function pseudosDepuisReponse(corps) {
	const liste = Array.isArray(corps) ? corps : (corps?.data ?? corps?.items ?? corps?.players ?? corps?.rankings ?? []);
	if (!Array.isArray(liste)) return [];
	const lignes = liste
		.map((l, i) => ({
			pseudo: l?.name ?? l?.epicName ?? l?.displayName ?? l?.player ?? l?.nickname ?? null,
			rang: Number(l?.rank ?? l?.position ?? NaN),
			points: Number(l?.points ?? NaN),
			i
		}))
		.filter((l) => typeof l.pseudo === 'string' && l.pseudo.trim());
	lignes.sort((a, b) =>
		Number.isFinite(a.rang) && Number.isFinite(b.rang) ? a.rang - b.rang
		: Number.isFinite(a.points) && Number.isFinite(b.points) ? b.points - a.points
		: a.i - b.i
	);
	return lignes.map((l) => l.pseudo.trim());
}

/** @param {string} cle @param {typeof fetch} [chercher] */
export async function lirePowerRankings(cle, chercher = fetch) {
	if (cache && Date.now() - cache.quand < UN_JOUR) return cache.pseudos;
	const r = await chercher(ADRESSE, { headers: { 'TRN-Api-Key': cle, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
	if (r.status === 401 || r.status === 403) throw new Error('clé Fortnite Tracker refusée (vérifie FORTNITE_TRACKER_KEY)');
	if (!r.ok) throw new Error(`Fortnite Tracker a répondu ${r.status}`);
	const pseudos = pseudosDepuisReponse(await r.json());
	cache = { quand: Date.now(), pseudos };
	return pseudos;
}
