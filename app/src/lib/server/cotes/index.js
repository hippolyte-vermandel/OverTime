// Calcul des cotes d'un match à partir de l'historique de la base.
// On rejoue tous les matchs terminés du jeu, dans l'ordre, puis on demande au moteur
// sa prévision pour le match à venir. Rien n'est inventé : sans historique, une équipe
// part de la note moyenne (1 500) et les cotes sont équilibrées.
import { requete } from '../db.js';
import { cleJour } from '#lib/format.js';
import { MoteurCotes, marchesSerie, scoresSerie, cote, PARAMETRES } from './moteur.js';

// Marge retirée des cotes. 0 = cotes « justes » (cote = 1 / probabilité) : sur la durée,
// personne n'est avantagé par la maison, seuls les bons pronostics font monter le rendement.
export const MARGE = 0;
// Bornes des probabilités enregistrées (la base refuse 0 et 1)
const borner = (p) => Math.min(0.9999, Math.max(0.0001, p));

/**
 * Matchs terminés d'un jeu, avec le score en manches et l'effectif titulaire de chaque équipe
 * à la date du match (vide si les contrats ne sont pas renseignés).
 */
async function historique(jeu) {
	return requete(
		`
		SELECT s.date_prevue, s.best_of,
		       ea.nom AS equipe_a, pa.score AS maps_a, eb.nom AS equipe_b, pb.score AS maps_b,
		       (SELECT coalesce(array_agg(jo.pseudo ORDER BY jo.pseudo), '{}') FROM contrat ct JOIN joueur jo ON jo.id = ct.joueur_id
		         WHERE ct.equipe_id = ea.id AND ct.jeu_id = c.jeu_id AND ct.statut = 'titulaire'
		           AND ct.date_debut <= s.date_prevue::date AND (ct.date_fin IS NULL OR ct.date_fin >= s.date_prevue::date)) AS roster_a,
		       (SELECT coalesce(array_agg(jo.pseudo ORDER BY jo.pseudo), '{}') FROM contrat ct JOIN joueur jo ON jo.id = ct.joueur_id
		         WHERE ct.equipe_id = eb.id AND ct.jeu_id = c.jeu_id AND ct.statut = 'titulaire'
		           AND ct.date_debut <= s.date_prevue::date AND (ct.date_fin IS NULL OR ct.date_fin >= s.date_prevue::date)) AS roster_b
		  FROM serie s
		  JOIN competition c ON c.id = s.competition_id
		  JOIN jeu j ON j.id = c.jeu_id
		  JOIN participation pa ON pa.serie_id = s.id AND pa.cote_terrain = 'A'
		  JOIN participation pb ON pb.serie_id = s.id AND pb.cote_terrain = 'B'
		  JOIN equipe ea ON ea.id = pa.equipe_id
		  JOIN equipe eb ON eb.id = pb.equipe_id
		 WHERE j.code = $1 AND s.statut = 'terminee' AND pa.score IS NOT NULL AND pb.score IS NOT NULL
		 ORDER BY s.date_prevue, s.id
		`,
		[jeu]
	);
}

/** Effectif titulaire actuel d'une équipe (par son nom) pour un jeu */
async function rosterActuel(jeu, equipe, jour) {
	const [r] = await requete(
		`SELECT coalesce(array_agg(jo.pseudo ORDER BY jo.pseudo), '{}') AS roster
		   FROM contrat ct JOIN joueur jo ON jo.id = ct.joueur_id JOIN equipe e ON e.id = ct.equipe_id JOIN jeu j ON j.id = ct.jeu_id
		  WHERE j.code = $1 AND lower(e.nom) = lower($2) AND ct.statut = 'titulaire'
		    AND ct.date_debut <= $3::date AND (ct.date_fin IS NULL OR ct.date_fin >= $3::date)`,
		[jeu, equipe, jour]
	);
	return r?.roster ?? [];
}

/**
 * Probabilités et cotes d'un match à venir.
 * @param {{ jeu: string, equipeA: string, equipeB: string, bestOf: number, quand: Date }} m
 */
export async function calculerCotes(m) {
	const moteur = new MoteurCotes();
	const passe = await historique(m.jeu);
	const nbMatchs = new Map();
	const jour = cleJour(m.quand.toISOString());
	const cle = (nom) => nom.toLowerCase();

	for (const h of passe) {
		if (new Date(h.date_prevue) >= m.quand) break; // jamais d'information postérieure au match
		moteur.enregistrer({
			jour: cleJour(new Date(h.date_prevue).toISOString()),
			equipe_a: cle(h.equipe_a),
			equipe_b: cle(h.equipe_b),
			maps_a: h.maps_a,
			maps_b: h.maps_b,
			roster_a: h.roster_a,
			roster_b: h.roster_b
		});
		for (const e of [h.equipe_a, h.equipe_b]) nbMatchs.set(cle(e), (nbMatchs.get(cle(e)) ?? 0) + 1);
	}

	const [rosterA, rosterB] = await Promise.all([rosterActuel(m.jeu, m.equipeA, jour), rosterActuel(m.jeu, m.equipeB, jour)]);
	const prev = moteur.probaMap(cle(m.equipeA), cle(m.equipeB), rosterA, rosterB, jour);
	const marches = marchesSerie(prev.p_map, m.bestOf);

	const scores = [...scoresSerie(prev.p_map, m.bestOf)].map(([libelle, p]) => ({ libelle, p: borner(p), cote: cote(p, MARGE) }));
	const derniere = m.bestOf > 1 ? marches[`map_${m.bestOf}_jouee`] : null;

	return {
		pA: borner(marches.victoire_A),
		pB: borner(marches.victoire_B),
		coteA: cote(marches.victoire_A, MARGE),
		coteB: cote(marches.victoire_B, MARGE),
		scores: m.bestOf > 1 ? scores : [],
		derniere: derniere === null ? null : { oui: { p: borner(derniere), cote: cote(derniere, MARGE) }, non: { p: borner(1 - derniere), cote: cote(1 - derniere, MARGE) } },
		detail: {
			pMap: prev.p_map,
			noteA: prev.note_a,
			noteB: prev.note_b,
			noteInitiale: PARAMETRES.noteInitiale,
			matchsA: nbMatchs.get(cle(m.equipeA)) ?? 0,
			matchsB: nbMatchs.get(cle(m.equipeB)) ?? 0,
			h2hMaps: prev.maps_h2h,
			correctifH2h: prev.correctif_h2h,
			effectifsConnus: rosterA.length > 0 && rosterB.length > 0
		}
	};
}
