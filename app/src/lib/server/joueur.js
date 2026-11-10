import { requete } from './db.js';

/**
 * Le joueur connecté, sa ligue et son solde de la saison en cours.
 * Une personne n'appartient pour l'instant qu'à une ligue (la première rejointe).
 * @param {string} authId identifiant Better Auth
 */
export async function chargerJoueur(authId) {
	const [j] = await requete(
		`
		SELECT u.id, u.pseudo,
		       l.id AS ligue_id, l.nom AS ligue_nom, l.mise_min, l.mise_max, l.combines_permis,
		       m.role,
		       solde(l.id, u.id) AS solde
		  FROM utilisateur u
		  LEFT JOIN membre_ligue m ON m.utilisateur_id = u.id
		  LEFT JOIN ligue l ON l.id = m.ligue_id
		 WHERE u.auth_id = $1
		 ORDER BY m.rejoint_le
		 LIMIT 1
		`,
		[authId]
	);
	if (!j) return null;
	return {
		id: j.id,
		pseudo: j.pseudo,
		role: j.role,
		// admin : matchs, résultats, membres ; propriétaire : en plus, nomme et retire les admins
		estAdmin: j.role === 'admin' || j.role === 'proprietaire',
		estProprietaire: j.role === 'proprietaire',
		solde: j.solde,
		ligue: j.ligue_id
			? { id: j.ligue_id, nom: j.ligue_nom, mise_min: j.mise_min, mise_max: j.mise_max, combines_permis: j.combines_permis }
			: null
	};
}
