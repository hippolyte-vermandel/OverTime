// Transmet à toutes les pages le joueur connecté (pseudo, ligue, solde), ou null.
export function load({ locals }) {
	return { joueur: locals.joueur };
}
