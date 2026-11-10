// Petites fonctions d'affichage, utilisables partout (serveur et navigateur).
import { FUSEAU_HORAIRE } from '$app/env/public';

/** Cote à la française : 1,47 */
export function formatCote(cote) {
	return Number(cote).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Nombre entier avec espace fine : 1 240 */
export function formatNombre(n) {
	return Math.trunc(n).toLocaleString('fr-FR');
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

/** Ajoute n jours à une clé de jour (calcul en UTC, sans effet de fuseau) */
export function decalerJour(cle, n) {
	const d = new Date(cle + 'T12:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** Jour de la semaine d'une clé, 0 = lundi ... 6 = dimanche */
export function indiceSemaine(cle) {
	return (new Date(cle + 'T12:00:00Z').getUTCDay() + 6) % 7;
}

/** Lundi de la semaine qui contient ce jour */
export function lundiDe(cle) {
	return decalerJour(cle, -indiceSemaine(cle));
}

const nomUTC = (cle, options) => new Date(cle + 'T12:00:00Z').toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });

/** "vendredi 6 novembre" */
export function nomJour(cle) {
	return nomUTC(cle, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "ven." */
export function jourCourt(cle) {
	return nomUTC(cle, { weekday: 'short' });
}

/** "Novembre 2026" */
export function nomMois(cle) {
	const t = nomUTC(cle, { month: 'long', year: 'numeric' });
	return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Titre de jour : "Aujourd'hui, vendredi 6 novembre", "Demain, ...", ou "Samedi 8 novembre" */
export function titreJour(cle, maintenant = new Date()) {
	const aujourdhui = cleJour(maintenant.toISOString());
	const prefixe = cle === aujourdhui ? "Aujourd'hui, " : cle === decalerJour(aujourdhui, 1) ? 'Demain, ' : '';
	const t = prefixe + nomJour(cle);
	return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Délai avant la fermeture des paris (au coup d'envoi), pour les matchs du jour.
 * Renvoie null pour un autre jour ou un match déjà commencé.
 */
export function fermeture(iso, maintenant = new Date()) {
	if (cleJour(iso) !== cleJour(maintenant.toISOString())) return null;
	const minutes = Math.floor((new Date(iso).getTime() - maintenant.getTime()) / 60000);
	if (minutes <= 0) return null;
	if (minutes < 60) return { texte: `ferme dans ${minutes} min`, court: `dans ${minutes} min`, bientot: true };
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	const duree = `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}`;
	return { texte: `dans ${duree}`, court: `dans ${duree}`, bientot: false };
}
