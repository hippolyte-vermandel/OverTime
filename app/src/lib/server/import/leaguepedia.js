// Source League of Legends : Leaguepedia (lol.fandom.com), le wiki de référence de l'esport LoL.
// Ses données sont publiques et interrogeables sans clé, sous licence CC BY-SA 3.0 :
// on doit citer Leaguepedia partout où elles s'affichent (voir le pied de l'écran Matchs).
// On interroge les tables Cargo « MatchSchedule » (le calendrier, avec scores) et
// « Tournaments » (le nom et la région de la compétition), au format JSON.
import { bestOfValide } from './outils.js';

export const SOURCE = { code: 'leaguepedia', nom: 'Leaguepedia', licence: 'CC BY-SA 3.0' };
export const JEU = { code: 'lol', nom: 'League of Legends' };

const ADRESSE = 'https://lol.fandom.com/wiki/Special:CargoExport';
// Leaguepedia demande d'identifier les programmes qui l'interrogent
const AGENT = 'OverTime/0.1 (application de pronostics entre amis ; https://github.com/hippolyte-vermandel/OverTime)';
const PAR_PAGE = 500; // maximum accepté par Cargo
const PAGES_MAX = 10;


const champs = [
	'MatchSchedule.MatchId=MatchId',
	'MatchSchedule.Team1=Team1',
	'MatchSchedule.Team2=Team2',
	'MatchSchedule.Team1Score=Team1Score',
	'MatchSchedule.Team2Score=Team2Score',
	'MatchSchedule.Winner=Winner',
	'MatchSchedule.BestOf=BestOf',
	'MatchSchedule.DateTime_UTC=Quand',
	'MatchSchedule.Tab=Tab',
	'MatchSchedule.IsNullified=Annule',
	'Tournaments.Name=Tournoi',
	'Tournaments.Region=Region'
];

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;
const dateCargo = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

/** Adresse d'une requête Cargo pour une fenêtre de dates (format attendu : JSON) */
export function adresseRequete(depuis, jusqua, regions, decalage = 0) {
	const ou = [
		`MatchSchedule.DateTime_UTC >= ${sql(dateCargo(depuis))}`,
		`MatchSchedule.DateTime_UTC <= ${sql(dateCargo(jusqua))}`,
		`Tournaments.TournamentLevel = 'Primary'`,
		regions.length ? `Tournaments.Region IN (${regions.map(sql).join(', ')})` : null
	].filter(Boolean);
	const p = new URLSearchParams({
		tables: 'MatchSchedule,Tournaments',
		'join on': 'MatchSchedule.OverviewPage=Tournaments.OverviewPage',
		fields: champs.join(','),
		where: ou.join(' AND '),
		'order by': 'MatchSchedule.DateTime_UTC',
		limit: String(PAR_PAGE),
		offset: String(decalage),
		format: 'json'
	});
	return `${ADRESSE}?${p}`;
}

// Cargo renvoie parfois les noms de champs avec des espaces à la place des « _ »
const lire = (ligne, nom) => ligne[nom] ?? ligne[nom.replace(/_/g, ' ')] ?? null;
const entier = (v) => {
	const n = Number.parseInt(String(v ?? ''), 10);
	return Number.isNaN(n) ? null : n;
};
const vrai = (v) => v === true || v === 1 || v === '1' || v === 'Yes' || v === 'true';

/**
 * Traduit une ligne Cargo en match normalisé, ou null si elle est inutilisable.
 * @returns {import('./commun.js').MatchNormalise | null}
 */
export function versMatch(ligne) {
	const quand = lire(ligne, 'Quand');
	const bestOf = bestOfValide(entier(lire(ligne, 'BestOf')) ?? 1);
	const id = lire(ligne, 'MatchId');
	if (!quand || !bestOf || !id) return null;
	const date = new Date(String(quand).replace(' ', 'T') + 'Z'); // heure UTC
	if (Number.isNaN(date.getTime())) return null;

	const gagnant = String(lire(ligne, 'Winner') ?? '');
	let scoreA = entier(lire(ligne, 'Team1Score'));
	let scoreB = entier(lire(ligne, 'Team2Score'));
	// BO1 sans score détaillé mais avec un gagnant : 1-0
	if (bestOf === 1 && (gagnant === '1' || gagnant === '2') && (scoreA === null || scoreB === null)) {
		scoreA = gagnant === '1' ? 1 : 0;
		scoreB = gagnant === '2' ? 1 : 0;
	}
	return {
		id: String(id),
		jeu: JEU.code,
		competition: String(lire(ligne, 'Tournoi') ?? '').trim() || 'Compétition LoL',
		region: String(lire(ligne, 'Region') ?? '').trim() || 'International',
		phase: String(lire(ligne, 'Tab') ?? '').trim(),
		quand: date,
		bestOf,
		equipeA: String(lire(ligne, 'Team1') ?? '').trim(),
		equipeB: String(lire(ligne, 'Team2') ?? '').trim(),
		termine: gagnant === '1' || gagnant === '2',
		scoreA,
		scoreB,
		annule: vrai(lire(ligne, 'Annule'))
	};
}

// --- Équipes : sigle officiel et logo (table Cargo « Teams ») ---
const EQUIPES_PAR_REQUETE = 40;

/** Adresse du logo d'une équipe : Special:FilePath redirige vers l'image, ici en 96 px */
export const adresseLogo = (fichier) => (fichier ? `https://lol.fandom.com/wiki/Special:FilePath/${encodeURIComponent(String(fichier).trim())}?width=96` : null);

export function adresseEquipes(noms) {
	const liste = noms.map(sql).join(', ');
	const p = new URLSearchParams({
		tables: 'Teams',
		fields: 'Teams.Name=Nom,Teams.OverviewPage=Page,Teams.Short=Sigle,Teams.Image=Image',
		where: `Teams.OverviewPage IN (${liste}) OR Teams.Name IN (${liste})`,
		limit: String(PAR_PAGE),
		format: 'json'
	});
	return `${ADRESSE}?${p}`;
}

/**
 * Sigles et logos des équipes citées dans les matchs, par nom (en minuscules).
 * Un échec ici n'empêche pas l'import des matchs : les équipes gardent leur blason neutre.
 */
export async function lireEquipes(noms, chercher = fetch) {
	const fiches = new Map();
	const uniques = [...new Set(noms.filter(Boolean))];
	for (let i = 0; i < uniques.length; i += EQUIPES_PAR_REQUETE) {
		const r = await chercher(adresseEquipes(uniques.slice(i, i + EQUIPES_PAR_REQUETE)), { headers: { 'User-Agent': AGENT, Accept: 'application/json' } });
		if (!r.ok) throw new Error(`Leaguepedia (équipes) a répondu ${r.status}`);
		const lignes = await r.json();
		if (!Array.isArray(lignes)) continue;
		for (const l of lignes) {
			const fiche = { sigle: lire(l, 'Sigle') || null, logo: adresseLogo(lire(l, 'Image')) };
			for (const cle of [lire(l, 'Page'), lire(l, 'Nom')]) if (cle) fiches.set(String(cle).toLowerCase(), fiche);
		}
	}
	return fiches;
}

/**
 * Matchs LoL entre deux dates, page par page.
 * @param {{ depuis: Date, jusqua: Date, regions: string[], chercher?: typeof fetch }} o
 * (chercher est remplaçable dans les tests)
 */
export async function lireMatchs({ depuis, jusqua, regions, chercher = fetch }) {
	const matchs = [];
	for (let page = 0; page < PAGES_MAX; page++) {
		const r = await chercher(adresseRequete(depuis, jusqua, regions, page * PAR_PAGE), { headers: { 'User-Agent': AGENT, Accept: 'application/json' } });
		if (!r.ok) throw new Error(`Leaguepedia a répondu ${r.status}`);
		const lignes = await r.json();
		if (!Array.isArray(lignes)) throw new Error(lignes?.error?.info ?? 'réponse inattendue de Leaguepedia');
		for (const l of lignes) {
			const m = versMatch(l);
			if (m) matchs.push(m);
		}
		if (lignes.length < PAR_PAGE) break;
	}
	try {
		const fiches = await lireEquipes(matchs.flatMap((m) => [m.equipeA, m.equipeB]), chercher);
		for (const m of matchs) {
			const a = fiches.get(m.equipeA.toLowerCase());
			const b = fiches.get(m.equipeB.toLowerCase());
			Object.assign(m, { sigleA: a?.sigle ?? null, logoA: a?.logo ?? null, sigleB: b?.sigle ?? null, logoB: b?.logo ?? null });
		}
	} catch (e) {
		console.error('Sigles et logos Leaguepedia indisponibles :', e.message);
	}
	return matchs;
}
