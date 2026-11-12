import { requete } from './db.js';

/**
 * Les prochains matchs entre deux équipes, avec le marché "vainqueur"
 * et ses cotes, du plus proche au plus lointain.
 * Les jeux en lobby (Fortnite, Warzone, TFT) auront leur propre affichage.
 */
export async function prochainsMatchs(limite = 200) {
	const lignes = await requete(
		`
		SELECT s.id, s.date_prevue, s.best_of, s.phase,
		       c.nom AS competition, c.categorie,
		       j.code AS jeu, j.nom AS jeu_nom,
		       (SELECT json_agg(json_build_object(
		                 'nom', e.nom, 'sigle', e.sigle, 'logo_url', e.logo_url, 'cote_terrain', p.cote_terrain)
		                 ORDER BY p.cote_terrain)
		          FROM participation p JOIN equipe e ON e.id = p.equipe_id
		         WHERE p.serie_id = s.id) AS equipes,
		       (SELECT json_build_object(
		                 'id', m.id, 'statut', m.statut, 'ferme_le', m.ferme_le,
		                 'issues', (SELECT json_agg(json_build_object(
		                                     'id', i.id, 'libelle', i.libelle, 'cote', i.cote)
		                                     ORDER BY i.id)
		                              FROM issue i WHERE i.marche_id = m.id))
		          FROM marche m
		         WHERE m.serie_id = s.id AND m.type = 'vainqueur'
		         LIMIT 1) AS marche_vainqueur,
		       (SELECT COUNT(*) FROM marche m
		         WHERE m.serie_id = s.id AND m.statut = 'ouvert')::int AS nb_marches
		  FROM serie s
		  JOIN competition c ON c.id = s.competition_id
		  JOIN jeu j ON j.id = c.jeu_id
		 WHERE s.statut = 'programmee'
		   AND s.date_prevue > now()
		   AND j.format IN ('equipes', 'duel')
		 ORDER BY s.date_prevue
		 LIMIT $1
		`,
		[limite]
	);

	// On associe à chaque équipe la cote de "sa" victoire
	return lignes.map((m) => {
		const issues = m.marche_vainqueur?.issues ?? [];
		return {
			...m,
			date_prevue: m.date_prevue.toISOString(),
			equipes: (m.equipes ?? []).map((e) => ({
				...e,
				issue: issues.find((i) => i.libelle === e.nom) ?? null
			})),
			marche_ouvert: m.marche_vainqueur?.statut === 'ouvert'
		};
	});
}

/** Sources automatiques dont des matchs sont dans la base, pour les citer (licence CC BY-SA) */
const LIENS = { leaguepedia: 'https://lol.fandom.com', liquipedia: 'https://liquipedia.net', pandascore: 'https://pandascore.co' };
export async function sourcesCitees() {
	const lignes = await requete(
		`SELECT so.code, so.nom, so.licence FROM source so
		  WHERE EXISTS (SELECT 1 FROM identifiant_externe ie WHERE ie.source_id = so.id)
		  ORDER BY so.nom`
	);
	return lignes.map((l) => ({ ...l, lien: LIENS[l.code] ?? null }));
}

/**
 * Les prochaines épreuves en lobby (Fortnite, Warzone, TFT) : chaque participant avec ses
 * paris « top X » (la cote du « oui »). Même forme générale que les matchs, avec lobby: true.
 */
export async function prochainesEpreuves(limite = 50) {
	const lignes = await requete(
		`SELECT s.id, s.date_prevue, s.phase, c.nom AS competition, c.categorie, j.code AS jeu, j.nom AS jeu_nom,
		        (SELECT json_agg(json_build_object(
		                  'id', pa.id, 'libelle', pa.libelle,
		                  'top', (SELECT json_agg(json_build_object(
		                                   'x', m.ligne::int, 'ouvert', m.statut = 'ouvert',
		                                   'issue', (SELECT json_build_object('id', i.id, 'libelle', i.libelle, 'cote', i.cote)
		                                               FROM issue i WHERE i.marche_id = m.id AND i.libelle = 'oui'),
		                                   'issues', (SELECT json_agg(i.id) FROM issue i WHERE i.marche_id = m.id))
		                                   ORDER BY m.ligne DESC)
		                            FROM marche m WHERE m.participation_id = pa.id AND m.type = 'top'))
		                  ORDER BY pa.id)
		           FROM participation pa WHERE pa.serie_id = s.id) AS participants
		   FROM serie s
		   JOIN competition c ON c.id = s.competition_id
		   JOIN jeu j ON j.id = c.jeu_id AND j.format = 'lobby'
		  WHERE s.statut = 'programmee' AND s.date_prevue > now()
		  ORDER BY s.date_prevue
		  LIMIT $1`,
		[limite]
	);
	return lignes.map((e) => {
		const participants = (e.participants ?? []).map((p) => ({ ...p, top: p.top ?? [] }));
		// Du plus au moins favori : la cote de victoire (le plus petit seuil) la plus basse d'abord
		const coteVictoire = (p) => p.top.at(-1)?.issue?.cote ?? Infinity;
		participants.sort((a, b) => coteVictoire(a) - coteVictoire(b));
		const seuils = participants[0]?.top.map((t) => t.x) ?? [];
		return { ...e, date_prevue: e.date_prevue.toISOString(), lobby: true, equipes: [], seuils, participants, nb_marches: 0 };
	});
}
