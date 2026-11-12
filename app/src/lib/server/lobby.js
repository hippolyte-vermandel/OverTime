// Épreuves en lobby (Fortnite, Warzone, TFT) : saisie par un admin, paris « top X »,
// classement final et règlement. Les participants sont des groupes de joueurs
// (solo, duo, trio, quatuor) : « Peterbot / Pollo ».
import { requete, transaction } from './db.js';
import { ErreurSaisie } from './erreurs.js';
import { lireParticipants, lireClassement } from './lobby-texte.js';

export { lireParticipants, lireClassement };
import { cotesLobby } from './cotes/lobby-base.js';


/** Jeux en lobby */
export async function jeuxLobby() {
	return requete(`SELECT code, nom FROM jeu WHERE format = 'lobby' ORDER BY nom`);
}

/** Aperçu des cotes d'une épreuve, sans rien enregistrer */
export async function apercuEpreuve(jeu, texte, quand) {
	const groupes = lireParticipants(texte);
	if (groupes.length < 2) throw new ErreurSaisie('Il faut au moins deux participants.');
	return cotesLobby(jeu, groupes, quand);
}

const libelleTop = (x) => (x === 1 ? 'vainqueur' : `top ${x}`);

/**
 * Crée une épreuve à venir avec ses paris « top X » (oui ou non pour chaque groupe).
 * @param {{ jeu: string, competition: string, region: string, phase: string, quand: Date, texte: string }} e
 */
export async function creerEpreuve(e) {
	if (e.quand <= new Date()) throw new ErreurSaisie('La date de l’épreuve est déjà passée.');
	const apercu = await apercuEpreuve(e.jeu, e.texte, e.quand);
	if (!apercu.seuils.length) throw new ErreurSaisie('Trop peu de participants pour proposer un « top X ».');
	return transaction(async (c) => {
		const un = async (sql, params) => (await c.query(sql, params)).rows[0];
		const jeu = await un(`SELECT id FROM jeu WHERE code = $1 AND format = 'lobby'`, [e.jeu]);
		if (!jeu) throw new ErreurSaisie('Jeu en lobby inconnu.');
		const comp =
			(await un('SELECT id FROM competition WHERE jeu_id = $1 AND lower(nom) = lower($2)', [jeu.id, e.competition])) ??
			(await un('INSERT INTO competition (jeu_id, nom, region) VALUES ($1, $2, $3) RETURNING id', [jeu.id, e.competition, e.region || 'International']));
		const serie = await un(
			`INSERT INTO serie (competition_id, phase, date_prevue, best_of) VALUES ($1, $2, $3, NULL) RETURNING id, date_prevue`,
			[comp.id, e.phase || null, e.quand]
		);
		// Un joueur déjà vu dans ce jeu est retrouvé par son pseudo, sinon il est créé
		const joueur = async (pseudo) =>
			(await un(
				`SELECT jo.id FROM joueur jo
				  WHERE lower(jo.pseudo) = lower($1)
				    AND EXISTS (SELECT 1 FROM participation_joueur pj JOIN participation pa ON pa.id = pj.participation_id
				                  JOIN serie s ON s.id = pa.serie_id JOIN competition co ON co.id = s.competition_id
				                 WHERE pj.joueur_id = jo.id AND co.jeu_id = $2)
				  LIMIT 1`,
				[pseudo, jeu.id]
			)) ?? (await un('INSERT INTO joueur (pseudo) VALUES ($1) RETURNING id', [pseudo]));

		for (const g of apercu.groupes) {
			const pa = await un('INSERT INTO participation (serie_id, libelle) VALUES ($1, $2) RETURNING id', [serie.id, g.libelle]);
			for (const pseudo of g.joueurs) await c.query('INSERT INTO participation_joueur (participation_id, joueur_id) VALUES ($1, $2)', [pa.id, (await joueur(pseudo)).id]);
			for (const x of apercu.seuils) {
				const t = g.top[x];
				const mk = await un(
					`INSERT INTO marche (serie_id, type, participation_id, ligne, libelle, ferme_le) VALUES ($1, 'top', $2, $3, $4, $5) RETURNING id`,
					[serie.id, pa.id, x, `${g.libelle} : ${libelleTop(x)}`, serie.date_prevue]
				);
				const pNon = Math.min(0.9999, Math.max(0.0001, 1 - t.probabilite));
				await c.query(`INSERT INTO issue (marche_id, libelle, probabilite, cote) VALUES ($1, 'oui', $2, $3), ($1, 'non', $4, $5)`, [
					mk.id,
					t.probabilite.toFixed(4),
					t.cote,
					pNon.toFixed(4),
					Math.max(1.01, Math.round((1 / pNon) * 100) / 100)
				]);
			}
		}
		return { serieId: serie.id, nb: apercu.groupes.length, seuils: apercu.seuils, depart: apercu.depart };
	});
}

/** Épreuves commencées dont le classement n'est pas encore saisi */
export async function epreuvesAClasser() {
	return requete(`
		SELECT s.id, s.date_prevue, s.phase, c.nom AS competition, j.code AS jeu,
		       (SELECT count(DISTINCT ps.pari_id) FROM pari_selection ps JOIN issue i ON i.id = ps.issue_id
		          JOIN marche m ON m.id = i.marche_id WHERE m.serie_id = s.id)::int AS nb_paris,
		       (SELECT json_agg(pa.libelle ORDER BY pa.id) FROM participation pa WHERE pa.serie_id = s.id) AS participants
		  FROM serie s
		  JOIN competition c ON c.id = s.competition_id
		  JOIN jeu j ON j.id = c.jeu_id AND j.format = 'lobby'
		 WHERE s.date_prevue <= now() AND s.statut = 'programmee'
		   AND EXISTS (SELECT 1 FROM marche m WHERE m.serie_id = s.id AND m.statut NOT IN ('regle', 'annule'))
		 ORDER BY s.date_prevue
	`);
}

/** Participants d'une épreuve avec leurs joueurs */
async function participantsDe(serieId) {
	return requete(
		`SELECT pa.id, pa.libelle, coalesce(array_agg(jo.pseudo) FILTER (WHERE jo.id IS NOT NULL), '{}') AS joueurs
		   FROM participation pa LEFT JOIN participation_joueur pj ON pj.participation_id = pa.id LEFT JOIN joueur jo ON jo.id = pj.joueur_id
		  WHERE pa.serie_id = $1 GROUP BY pa.id ORDER BY pa.id`,
		[serieId]
	);
}

/**
 * Enregistre le classement final collé et règle les paris. Les lignes non reconnues bloquent
 * tout (rien n'est réglé) ; les groupes absents du classement sont remboursés.
 */
export async function classerEpreuve(serieId, texte) {
	const participants = await participantsDe(serieId);
	if (!participants.length) throw new ErreurSaisie('Épreuve introuvable.');
	const { places, inconnues, absents } = lireClassement(texte, participants);
	if (inconnues.length) throw new ErreurSaisie(`Ligne${inconnues.length > 1 ? 's' : ''} non reconnue${inconnues.length > 1 ? 's' : ''} : ${inconnues.slice(0, 5).join(' ; ')}${inconnues.length > 5 ? '…' : ''}. Vérifie l’orthographe des joueurs.`);
	if (!places.size) throw new ErreurSaisie('Colle le classement final, un groupe par ligne.');
	const nb = await transaction(async (c) => {
		for (const [id, place] of places) await c.query('UPDATE participation SET classement = $2 WHERE id = $1 AND serie_id = $3', [id, place, serieId]);
		return (await c.query('SELECT regler_epreuve($1) AS nb', [serieId])).rows[0].nb;
	});
	return { nb, classes: places.size, absents };
}
