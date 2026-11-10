// Petits outils sans base de données, partagés par les sources (et testables seuls).

const EQUIPE_INCONNUE = /^(tbd|tba|to be determined|)$/i;

/** Une équipe encore inconnue (« TBD ») : on attend qu'elle soit désignée */
export const equipeConnue = (nom) => typeof nom === 'string' && !EQUIPE_INCONNUE.test(nom.trim());

/** Le score est-il un score de série possible pour ce format ? (ex. 3-1 en BO5) */
export function scoreValide(bestOf, a, b) {
	const g = Math.floor(bestOf / 2) + 1;
	return Number.isInteger(a) && Number.isInteger(b) && Math.max(a, b) === g && Math.min(a, b) >= 0 && Math.min(a, b) < g;
}

/** Les formats de série acceptés par la base */
export const bestOfValide = (n) => ([1, 3, 5, 7].includes(n) ? n : null);
