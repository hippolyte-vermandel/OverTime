// Cotes des épreuves en lobby à partir de la base : on rejoue toutes les épreuves terminées
// du jeu (dans l'ordre), puis on simule l'épreuve à venir. Pour Fortnite, si une clé
// Fortnite Tracker est configurée, les notes de départ viennent des Power Rankings.
import { FORTNITE_TRACKER_KEY } from '$app/env/private';
import { requete } from '../db.js';
import { MoteurLobby, seuilsPour, departDepuisClassement, PARAMETRES_LOBBY } from './lobby.js';
import { cote } from './moteur.js';
import { lirePowerRankings } from './powerRankings.js';

const borner = (p) => Math.min(0.9999, Math.max(0.0001, p));

/** Épreuves terminées d'un jeu avant une date : pour chaque groupe, ses joueurs et sa place */
async function historique(jeu, avant) {
	const lignes = await requete(
		`SELECT s.id, pa.classement,
		        coalesce(array_agg(jo.pseudo ORDER BY jo.pseudo) FILTER (WHERE jo.id IS NOT NULL), '{}') AS joueurs
		   FROM serie s
		   JOIN competition c ON c.id = s.competition_id
		   JOIN jeu j ON j.id = c.jeu_id AND j.code = $1 AND j.format = 'lobby'
		   JOIN participation pa ON pa.serie_id = s.id
		   LEFT JOIN participation_joueur pj ON pj.participation_id = pa.id
		   LEFT JOIN joueur jo ON jo.id = pj.joueur_id
		  WHERE s.statut = 'terminee' AND s.date_prevue < $2
		  GROUP BY s.id, s.date_prevue, pa.id
		  ORDER BY s.date_prevue, s.id`,
		[jeu, avant]
	);
	const epreuves = new Map();
	for (const l of lignes) {
		if (!epreuves.has(l.id)) epreuves.set(l.id, []);
		epreuves.get(l.id).push({ joueurs: l.joueurs, place: l.classement });
	}
	return [...epreuves.values()];
}

/**
 * Probabilités et cotes « top X » pour une épreuve à venir.
 * @param {string} jeu code du jeu ('fortnite', 'warzone', 'tft')
 * @param {{ libelle: string, joueurs: string[] }[]} groupes
 * @param {Date} quand
 * @returns {Promise<{ seuils: number[], groupes: { libelle: string, joueurs: string[], note: number, top: Record<number, { probabilite: number, cote: number }> }[], depart: string }>}
 */
export async function cotesLobby(jeu, groupes, quand = new Date()) {
	let moteur = new MoteurLobby();
	let depart = 'notes neutres';
	if (jeu === 'fortnite' && String(FORTNITE_TRACKER_KEY ?? '').trim()) {
		try {
			const classement = await lirePowerRankings(String(FORTNITE_TRACKER_KEY).trim());
			if (classement.length) {
				const { depart: d, horsClassement } = departDepuisClassement(classement);
				moteur = new MoteurLobby({ depart: d, inconnu: horsClassement });
				depart = `Power Rankings (${classement.length} joueurs)`;
			}
		} catch (e) {
			console.error('Power Rankings indisponibles, notes neutres :', e.message);
		}
	}
	for (const e of await historique(jeu, quand)) moteur.jouer(e);

	const seuils = seuilsPour(jeu, groupes.length);
	const probas = moteur.probasTop(groupes.map((g) => g.joueurs), seuils);
	return {
		seuils,
		depart,
		groupes: groupes.map((g, i) => ({
			...g,
			note: Math.round(moteur.noteGroupe(g.joueurs)),
			top: Object.fromEntries(seuils.map((x) => {
				const p = borner(probas[i][x]);
				return [x, { probabilite: p, cote: cote(p, 0, PARAMETRES_LOBBY.plafond) }];
			}))
		}))
	};
}
