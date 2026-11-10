// Tâches automatiques du serveur.
// Recharges : chaque membre reçoit 150 noxus (réglage de la ligue) quand il n'a rien reçu
// depuis 7 jours, et son solde de départ au début de chaque saison. La fonction SQL ne
// verse jamais deux fois : on peut donc la lancer souvent sans risque.
import { requete } from './db.js';
import { noterTousLesRangs } from './paris.js';
import { toutImporter } from './import/index.js';
import { IMPORT_AUTO } from '$app/env/private';

const UNE_HEURE = 60 * 60 * 1000;
let lancee = false;

export async function verserRecharges() {
	try {
		const [{ nb }] = await requete('SELECT crediter_recharges() AS nb');
		if (nb > 0) console.log(`Recharges : ${nb} versement${nb > 1 ? 's' : ''} effectué${nb > 1 ? 's' : ''}.`);
		return nb;
	} catch (e) {
		console.error('Recharges impossibles pour l’instant :', e.message);
		return 0;
	}
}

// Relevé horaire des rangs : le dernier relevé de la journée sert de référence le lendemain
export async function releverRangs() {
	try {
		await noterTousLesRangs();
	} catch (e) {
		console.error('Relevé des rangs impossible pour l’instant :', e.message);
	}
}

// Import des matchs (Leaguepedia, et Liquipedia si une clé est configurée) : nouveaux matchs,
// résultats, changements d'horaire. Le rang est relevé après, pour compter les paris réglés.
async function importerMatchs() {
	if (String(IMPORT_AUTO).toLowerCase() === 'non') return;
	try {
		await toutImporter();
	} catch (e) {
		console.error('Import des matchs impossible pour l’instant :', e.message);
	}
}

async function tourDeTaches() {
	await verserRecharges();
	await importerMatchs();
	await releverRangs();
}

// PandaScore donne les résultats dès la fin du match : on l'interroge toutes les 15 minutes,
// pour que les gains arrivent vite (2 requêtes à chaque fois, loin de la limite de 1 000 par heure).
// Les autres sources restent à une fois par heure, pour les ménager.
const QUINZE_MINUTES = 15 * 60 * 1000;
async function resultatsRapides() {
	if (String(IMPORT_AUTO).toLowerCase() === 'non') return;
	try {
		await toutImporter(['pandascore']);
		await releverRangs();
	} catch (e) {
		console.error('Import rapide impossible pour l’instant :', e.message);
	}
}

/** Lance les tâches au démarrage du serveur, puis toutes les heures (PandaScore : tous les quarts d'heure) */
export function demarrerTaches() {
	if (lancee) return;
	lancee = true;
	tourDeTaches();
	setInterval(tourDeTaches, UNE_HEURE).unref();
	// Décalé de 7 minutes pour ne pas tomber en même temps que le tour horaire
	setTimeout(() => {
		resultatsRapides();
		setInterval(resultatsRapides, QUINZE_MINUTES).unref();
	}, 7 * 60 * 1000).unref();
}
