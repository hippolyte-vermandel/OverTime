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

/** Lance les tâches au démarrage du serveur, puis toutes les heures */
export function demarrerTaches() {
	if (lancee) return;
	lancee = true;
	tourDeTaches();
	setInterval(tourDeTaches, UNE_HEURE).unref();
}
