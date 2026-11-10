// Tâches automatiques du serveur.
// Recharges : chaque membre reçoit 150 noxus (réglage de la ligue) quand il n'a rien reçu
// depuis 7 jours, et son solde de départ au début de chaque saison. La fonction SQL ne
// verse jamais deux fois : on peut donc la lancer souvent sans risque.
import { requete } from './db.js';
import { noterTousLesRangs } from './paris.js';

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

async function tourDeTaches() {
	await verserRecharges();
	await releverRangs();
}

/** Lance les tâches au démarrage du serveur, puis toutes les heures */
export function demarrerTaches() {
	if (lancee) return;
	lancee = true;
	tourDeTaches();
	setInterval(tourDeTaches, UNE_HEURE).unref();
}
