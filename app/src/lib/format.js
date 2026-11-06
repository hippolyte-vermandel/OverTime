// Petites fonctions d'affichage, utilisables partout (serveur et navigateur).
import { FUSEAU_HORAIRE } from '$app/env/public';

/** Cote à la française : 1,47 */
export function formatCote(cote) {
	return cote.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Heure du match : 18:00 */
export function formatHeure(iso) {
	return new Date(iso).toLocaleTimeString('fr-FR', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: FUSEAU_HORAIRE
	});
}

/** Clé de jour (AAAA-MM-JJ) dans le fuseau d'affichage, pour regrouper les matchs */
export function cleJour(iso) {
	return new Date(iso).toLocaleDateString('sv-SE', { timeZone: FUSEAU_HORAIRE });
}

/** Titre de jour : "Aujourd'hui", "Demain", ou "samedi 8 novembre" */
export function titreJour(cle, maintenant = new Date()) {
	const aujourdhui = cleJour(maintenant.toISOString());
	const demain = cleJour(new Date(maintenant.getTime() + 864e5).toISOString());
	if (cle === aujourdhui) return "Aujourd'hui";
	if (cle === demain) return 'Demain';
	return new Date(cle + 'T12:00:00Z').toLocaleDateString('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	});
}
