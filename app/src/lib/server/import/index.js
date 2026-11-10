// Lancement des imports automatiques : par la tâche horaire du serveur, ou par le bouton
// « Importer maintenant » de l'administration. Un seul import tourne à la fois.
import { LPDB_API_KEY, LPDB_TIERS, LEAGUEPEDIA_REGIONS, PANDASCORE_TOKEN } from '$app/env/private';
import { requete } from '../db.js';
import { preparerSource, rangerMatchs, resumer } from './commun.js';
import { equipeConnue } from './outils.js';
import * as leaguepedia from './leaguepedia.js';
import * as lpdb from './lpdb.js';
import * as pandascore from './pandascore.js';

const JOUR = 86_400_000;
const liste = (v) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
// Attente maximale d'une réponse : au-delà, on réessaiera à l'heure suivante
const chercher = (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(20_000) });

/** Les sources, telles que l'administration les affiche */
export const SOURCES = [
	{ cle: 'leaguepedia', jeu: 'League of Legends', nom: 'Leaguepedia', lien: 'https://lol.fandom.com', active: () => true },
	{ cle: 'liquipedia', jeu: 'VALORANT', nom: 'Liquipedia', lien: 'https://liquipedia.net/valorant', active: () => String(LPDB_API_KEY ?? '').trim() !== '', variable: 'LPDB_API_KEY' },
	{ cle: 'pandascore', jeu: 'Rocket League et Call of Duty', nom: 'PandaScore', lien: 'https://pandascore.co', active: () => String(PANDASCORE_TOKEN ?? '').trim() !== '', variable: 'PANDASCORE_TOKEN' }
];

// Premier import d'une source : on remonte 120 jours pour que le moteur de cotes ait un
// historique ; ensuite, 3 jours suffisent pour récupérer les résultats récents.
async function fenetre(sourceId) {
	const [{ n }] = await requete(`SELECT count(*)::int AS n FROM identifiant_externe WHERE source_id = $1 AND type_entite = 'serie'`, [sourceId]);
	const maintenant = Date.now();
	return { depuis: new Date(maintenant - (n === 0 ? 120 : 3) * JOUR), jusqua: new Date(maintenant + 14 * JOUR) };
}

async function lire(cle, f) {
	if (cle === 'leaguepedia') return leaguepedia.lireMatchs({ ...f, regions: liste(LEAGUEPEDIA_REGIONS), chercher });
	if (cle === 'pandascore') return pandascore.lireMatchs({ ...f, cle: String(PANDASCORE_TOKEN ?? '').trim(), chercher });
	return lpdb.lireMatchs({ ...f, cle: String(LPDB_API_KEY ?? '').trim(), niveaux: liste(LPDB_TIERS), chercher });
}
// La source et les jeux qu'elle alimente
function decrire(cle) {
	if (cle === 'leaguepedia') return { source: leaguepedia.SOURCE, jeux: [leaguepedia.JEU] };
	if (cle === 'pandascore') return { source: pandascore.SOURCE, jeux: pandascore.JEUX };
	return { source: lpdb.SOURCE, jeux: [lpdb.JEU] };
}

/** Dernier résultat de chaque source (en mémoire), pour l'administration */
export const derniers = /** @type {Record<string, { quand: Date, texte: string, erreur: boolean }>} */ ({});
let enCours = false;

/**
 * Importe une source. Avec apercu = true, rien n'est écrit : on renvoie ce qui serait importé.
 * @param {'leaguepedia' | 'liquipedia' | 'pandascore'} cle
 */
export async function importer(cle, { apercu = false } = {}) {
	const src = SOURCES.find((s) => s.cle === cle);
	if (!src) throw new Error('Source inconnue');
	if (!src.active()) return { texte: `${src.jeu} : pas encore de clé ${src.nom}. Ajoute ${src.variable} dans le fichier .env puis relance le serveur.`, erreur: true };
	const d = decrire(cle);
	const sourceId = await preparerSource(d.source, d.jeux);
	const f = await fenetre(sourceId);
	const matchs = await lire(cle, f);

	if (apercu) {
		const maintenant = new Date();
		const avenir = matchs.filter((x) => x.quand > maintenant && !x.termine);
		const exemples = avenir.filter((x) => !x.annule && equipeConnue(x.equipeA) && equipeConnue(x.equipeB)).slice(0, 6).map((x) => `${x.equipeA} contre ${x.equipeB}, ${x.competition}, BO${x.bestOf}`);
		return {
			texte: `${src.jeu} : ${matchs.length} match${matchs.length > 1 ? 's' : ''} trouvé${matchs.length > 1 ? 's' : ''} chez ${src.nom} (${matchs.length - avenir.length} passé${matchs.length - avenir.length > 1 ? 's' : ''} ou terminé${matchs.length - avenir.length > 1 ? 's' : ''}, ${avenir.length} à venir). Rien n’a été enregistré.`,
			exemples,
			erreur: false
		};
	}
	const bilan = await rangerMatchs(sourceId, matchs);
	for (const e of bilan.erreurs) console.error(`Import ${src.nom} :`, e);
	return { texte: resumer(src.jeu, bilan), erreur: bilan.erreurs.length > 0 };
}

/**
 * Les sources actives, l'une après l'autre (tâches automatiques).
 * @param {string[]} [seulement] limiter à certaines sources (ex. ['pandascore'])
 */
export async function toutImporter(seulement) {
	if (enCours) return;
	enCours = true;
	try {
		for (const s of SOURCES) {
			if (!s.active() || (seulement && !seulement.includes(s.cle))) continue;
			try {
				const r = await importer(/** @type {any} */ (s.cle));
				derniers[s.cle] = { quand: new Date(), texte: r.texte, erreur: r.erreur };
				console.log(`Import ${s.nom} : ${r.texte}`);
			} catch (e) {
				derniers[s.cle] = { quand: new Date(), texte: `${s.jeu} : import impossible (${e.message}).`, erreur: true };
				console.error(`Import ${s.nom} impossible :`, e.message);
			}
		}
	} finally {
		enCours = false;
	}
}

/** Pour le bouton de l'administration : refuse de lancer un import si un autre tourne */
export async function importerMaintenant(cle, apercu) {
	if (enCours) return { texte: 'Un import est déjà en cours, réessaie dans une minute.', erreur: true };
	enCours = true;
	try {
		const r = await importer(cle, { apercu });
		if (!apercu) derniers[cle] = { quand: new Date(), texte: r.texte, erreur: r.erreur };
		return r;
	} catch (e) {
		console.error(`Import ${cle} impossible :`, e);
		return { texte: `Import impossible : ${e.message}. Vérifie la connexion internet du serveur.`, erreur: true };
	} finally {
		enCours = false;
	}
}
