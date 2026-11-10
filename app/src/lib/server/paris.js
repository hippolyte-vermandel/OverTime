// Lectures pour les écrans Mes paris et Classement (saison en cours de la ligue).
import { FUSEAU_HORAIRE } from '$app/env/public';
import { requete } from './db.js';

export const SEUIL_CLASSEMENT = 10; // paris réglés dans la saison pour être classé

/** Saison en cours de la ligue : identifiant, nom, dates et jours restants */
export async function saisonCourante(ligueId) {
	const [s] = await requete(
		`SELECT s.id, s.nom, s.date_debut, s.date_fin, (s.date_fin - current_date) AS jours_restants,
		        (SELECT count(*) FROM membre_ligue WHERE ligue_id = $1)::int AS membres
		   FROM saison s WHERE s.id = saison_courante($1, current_date)`,
		[ligueId]
	);
	return s;
}

/** Début de la semaine en cours (lundi 0 h) dans le fuseau de la ligue */
const DEBUT_SEMAINE = `(date_trunc('week', now() AT TIME ZONE '${FUSEAU_HORAIRE.replace(/'/g, '')}') AT TIME ZONE '${FUSEAU_HORAIRE.replace(/'/g, '')}')`;

/** Les paris du joueur sur la saison en cours, du plus récent au plus ancien, avec leurs sélections */
export async function mesParis(joueur) {
	return requete(
		`
		SELECT p.id, p.mise, p.cote_totale, p.statut, p.gain, p.gain_reduit, p.place_le, p.regle_le,
		       json_agg(json_build_object(
		         'libelle', i.libelle, 'cote', ps.cote_prise, 'gagnante', i.gagnante,
		         'marche', m.libelle, 'type', m.type, 'statut_marche', m.statut,
		         'date', s.date_prevue, 'competition', c.nom, 'jeu', j.code,
		         'equipes', (SELECT json_agg(e.nom ORDER BY pa.cote_terrain) FROM participation pa JOIN equipe e ON e.id = pa.equipe_id WHERE pa.serie_id = s.id)
		       ) ORDER BY s.date_prevue) AS selections
		  FROM pari p
		  JOIN pari_selection ps ON ps.pari_id = p.id
		  JOIN issue i ON i.id = ps.issue_id
		  JOIN marche m ON m.id = i.marche_id
		  JOIN serie s ON s.id = m.serie_id
		  JOIN competition c ON c.id = s.competition_id
		  JOIN jeu j ON j.id = c.jeu_id
		 WHERE p.utilisateur_id = $1 AND p.ligue_id = $2 AND p.saison_id = saison_courante($2, current_date)
		 GROUP BY p.id
		 ORDER BY p.place_le DESC
		`,
		[joueur.id, joueur.ligue.id]
	);
}

/** Bilan de la semaine (depuis lundi) et date de la prochaine recharge */
export async function bilanSemaine(joueur) {
	const [b] = await requete(
		`
		SELECT coalesce(sum(p.mise) FILTER (WHERE p.place_le >= ${DEBUT_SEMAINE}), 0)::int AS mise,
		       coalesce(sum(p.gain) FILTER (WHERE p.regle_le >= ${DEBUT_SEMAINE} AND p.statut IN ('gagne', 'perdu')), 0)::int AS recupere,
		       coalesce(sum(p.mise) FILTER (WHERE p.regle_le >= ${DEBUT_SEMAINE} AND p.statut IN ('gagne', 'perdu')), 0)::int AS mise_reglee,
		       count(*) FILTER (WHERE p.regle_le >= ${DEBUT_SEMAINE} AND p.statut IN ('gagne', 'perdu'))::int AS regles,
		       count(*) FILTER (WHERE p.regle_le >= ${DEBUT_SEMAINE} AND p.statut = 'gagne')::int AS gagnes,
		       (SELECT max(mv.cree_le) + interval '7 days' FROM mouvement_noxus mv
		         WHERE mv.utilisateur_id = $1 AND mv.ligue_id = $2 AND mv.motif IN ('recharge', 'depart')) AS prochaine_recharge,
		       (SELECT recharge_hebdo FROM ligue WHERE id = $2) AS recharge
		  FROM pari p
		 WHERE p.utilisateur_id = $1 AND p.ligue_id = $2
		`,
		[joueur.id, joueur.ligue.id]
	);
	return b;
}

/**
 * Classement au bilan : noxus récupérés moins noxus misés, sur les paris réglés.
 * Saison : il faut SEUIL_CLASSEMENT paris réglés pour être classé. Semaine : au moins un.
 * En saison, chaque ligne indique aussi les places gagnées ou perdues depuis la veille.
 * @param {'saison' | 'semaine'} periode
 */
export async function classement(ligueId, periode) {
	const filtre = periode === 'semaine' ? `AND p.regle_le >= ${DEBUT_SEMAINE}` : '';
	const lignes = await requete(
		`
		SELECT u.id, u.pseudo,
		       count(p.id)::int AS regles,
		       count(p.id) FILTER (WHERE p.statut = 'gagne')::int AS gagnes,
		       coalesce(sum(p.mise), 0)::int AS mise,
		       coalesce(sum(p.gain), 0)::int AS recupere
		  FROM membre_ligue m
		  JOIN utilisateur u ON u.id = m.utilisateur_id
		  LEFT JOIN pari p ON p.utilisateur_id = u.id AND p.ligue_id = m.ligue_id
		       AND p.saison_id = saison_courante($1, current_date) AND p.statut IN ('gagne', 'perdu') ${filtre}
		 WHERE m.ligue_id = $1
		 GROUP BY u.id, u.pseudo
		`,
		[ligueId]
	);
	const seuil = periode === 'semaine' ? 1 : SEUIL_CLASSEMENT;
	const avecBilan = lignes.map((l) => ({ ...l, bilan: l.recupere - l.mise }));
	const classes = avecBilan
		.filter((l) => l.regles >= seuil)
		.sort((a, b) => b.bilan - a.bilan || b.regles - a.regles || a.pseudo.localeCompare(b.pseudo, 'fr'))
		.map((l, i) => ({ ...l, rang: i + 1, evolution: null }));
	const nonClasses = avecBilan.filter((l) => l.regles < seuil).sort((a, b) => b.regles - a.regles || a.pseudo.localeCompare(b.pseudo, 'fr'));

	if (periode === 'saison' && classes.length) {
		// Rang de la veille : le dernier relevé d'un jour précédent
		const veille = await requete(
			`SELECT utilisateur_id, rang FROM rang_classement
			  WHERE ligue_id = $1 AND saison_id = saison_courante($1, current_date)
			    AND jour = (SELECT max(jour) FROM rang_classement
			                 WHERE ligue_id = $1 AND saison_id = saison_courante($1, current_date) AND jour < $2::date)`,
			[ligueId, jourLigue()]
		);
		const avant = new Map(veille.map((v) => [v.utilisateur_id, v.rang]));
		for (const l of classes) if (avant.has(l.id)) l.evolution = avant.get(l.id) - l.rang; // positif : places gagnées
	}
	return { classes, nonClasses, seuil };
}

/** Date du jour dans le fuseau de la ligue (AAAA-MM-JJ) */
const jourLigue = () => new Date().toLocaleDateString('sv-SE', { timeZone: FUSEAU_HORAIRE });

/** Note le rang de chaque membre classé, pour aujourd'hui (remplace le relevé précédent du jour) */
export async function noterRangs(ligueId) {
	const { classes } = await classement(ligueId, 'saison');
	const jour = jourLigue();
	await requete(
		`DELETE FROM rang_classement WHERE ligue_id = $1 AND saison_id = saison_courante($1, current_date) AND jour = $2::date`,
		[ligueId, jour]
	);
	for (const l of classes)
		await requete(
			`INSERT INTO rang_classement (ligue_id, saison_id, utilisateur_id, jour, rang)
			 VALUES ($1, saison_courante($1, current_date), $2, $3::date, $4)`,
			[ligueId, l.id, jour, l.rang]
		);
}

/** Relevé des rangs pour toutes les ligues */
export async function noterTousLesRangs() {
	const ligues = await requete('SELECT id FROM ligue');
	for (const l of ligues) await noterRangs(l.id);
}

/** Dernier pari placé par un membre (pour la carte du rival) */
export async function dernierPari(ligueId, utilisateurId) {
	const [d] = await requete(
		`SELECT i.libelle, c.nom AS competition, s.date_prevue
		   FROM pari p JOIN pari_selection ps ON ps.pari_id = p.id JOIN issue i ON i.id = ps.issue_id
		   JOIN marche m ON m.id = i.marche_id JOIN serie s ON s.id = m.serie_id JOIN competition c ON c.id = s.competition_id
		  WHERE p.ligue_id = $1 AND p.utilisateur_id = $2
		  ORDER BY p.place_le DESC LIMIT 1`,
		[ligueId, utilisateurId]
	);
	return d ?? null;
}

/**
 * Les matchs sur lesquels le joueur a déjà parié dans sa ligue (un seul pari par match) :
 * pour chaque match, les issues qu'il a prises. Sert à figer ces matchs dans l'écran Matchs.
 * @returns {Promise<Record<number, number[]>>}
 */
export async function matchsParies(joueur) {
	if (!joueur?.ligue) return {};
	const lignes = await requete(
		`SELECT m.serie_id, array_agg(DISTINCT ps.issue_id) AS issues
		   FROM pari p
		   JOIN pari_selection ps ON ps.pari_id = p.id
		   JOIN issue  i ON i.id = ps.issue_id
		   JOIN marche m ON m.id = i.marche_id
		  WHERE p.ligue_id = $1 AND p.utilisateur_id = $2
		  GROUP BY m.serie_id`,
		[joueur.ligue.id, joueur.id]
	);
	return Object.fromEntries(lignes.map((l) => [l.serie_id, l.issues]));
}
