// Outils de l'administrateur : saisie des matchs, validation des résultats, membres.
import { randomInt } from 'node:crypto';
import { FUSEAU_HORAIRE } from '$app/env/public';
import { requete, transaction } from './db.js';
import { auth } from './auth.js';

/** Jeux en face-à-face (deux équipes ou deux joueurs) : les seuls saisissables pour l'instant */
export async function jeuxDuels() {
	return requete(`SELECT code, nom FROM jeu WHERE format IN ('equipes', 'duel') ORDER BY nom`);
}

/** Compétitions existantes et noms d'équipes, pour les propositions de saisie */
export async function referentiel() {
	const [competitions, equipes] = await Promise.all([
		requete(`SELECT c.id, c.nom, c.region, j.code AS jeu FROM competition c JOIN jeu j ON j.id = c.jeu_id ORDER BY c.nom`),
		requete(`SELECT nom, sigle FROM equipe WHERE active ORDER BY nom`)
	]);
	return { competitions, equipes };
}

/**
 * Crée un match en face-à-face avec son marché « Vainqueur » et les deux cotes.
 * Tout est fait dans une transaction : rien n'est créé si une étape échoue.
 * @param {{ jeu: string, competition: string, region: string, phase: string, quand: string,
 *           bestOf: number, equipeA: string, equipeB: string, coteA: number, coteB: number }} m
 *   quand : date et heure locales « AAAA-MM-JJTHH:MM », dans le fuseau de la ligue
 */
export async function creerMatch(m) {
	return transaction(async (c) => {
		const un = async (sql, params) => (await c.query(sql, params)).rows[0];

		const jeu = await un('SELECT id FROM jeu WHERE code = $1', [m.jeu]);
		if (!jeu) throw new ErreurSaisie('Jeu inconnu.');

		// Compétition : celle qui existe déjà pour ce jeu, sinon on la crée
		const comp =
			(await un('SELECT id FROM competition WHERE jeu_id = $1 AND lower(nom) = lower($2)', [jeu.id, m.competition])) ??
			(await un('INSERT INTO competition (jeu_id, nom, region) VALUES ($1, $2, $3) RETURNING id', [jeu.id, m.competition, m.region || 'International']));

		// Équipes : retrouvées par leur nom, ou créées avec un sigle de trois lettres
		const equipe = async (nom) =>
			(await un('SELECT id, nom FROM equipe WHERE lower(nom) = lower($1)', [nom])) ??
			(await un('INSERT INTO equipe (nom, sigle) VALUES ($1, $2) RETURNING id, nom', [nom, sigleDe(nom)]));
		const a = await equipe(m.equipeA);
		const b = await equipe(m.equipeB);
		if (a.id === b.id) throw new ErreurSaisie('Les deux équipes doivent être différentes.');

		const serie = await un(
			`INSERT INTO serie (competition_id, phase, date_prevue, best_of)
			 VALUES ($1, $2, ($3::timestamp AT TIME ZONE $4), $5) RETURNING id, date_prevue`,
			[comp.id, m.phase || null, m.quand, FUSEAU_HORAIRE, m.bestOf]
		);
		if (new Date(serie.date_prevue) <= new Date()) throw new ErreurSaisie('La date du match est déjà passée.');

		await c.query(`INSERT INTO participation (serie_id, equipe_id, cote_terrain) VALUES ($1, $2, 'A'), ($1, $3, 'B')`, [serie.id, a.id, b.id]);

		// Les paris ferment au coup d'envoi
		const marche = await un(`INSERT INTO marche (serie_id, type, libelle, ferme_le) VALUES ($1, 'vainqueur', 'Vainqueur', $2) RETURNING id`, [serie.id, serie.date_prevue]);

		// Probabilités tirées des cotes, ramenées à 100 % (on retire la marge éventuelle)
		const ia = 1 / m.coteA;
		const ib = 1 / m.coteB;
		const pa = ia / (ia + ib);
		await c.query(`INSERT INTO issue (marche_id, libelle, probabilite, cote) VALUES ($1, $2, $3, $4), ($1, $5, $6, $7)`, [
			marche.id,
			a.nom,
			pa.toFixed(4),
			m.coteA,
			b.nom,
			(1 - pa).toFixed(4),
			m.coteB
		]);
		return serie.id;
	});
}

/** Matchs commencés dont le résultat n'est pas encore validé (marché Vainqueur ouvert ou verrouillé) */
export async function resultatsAValider() {
	return requete(`
		SELECT s.id, s.date_prevue, s.best_of, s.phase, c.nom AS competition, j.code AS jeu,
		       m.id AS marche_id,
		       (SELECT count(DISTINCT ps.pari_id) FROM pari_selection ps JOIN issue i ON i.id = ps.issue_id
		         WHERE i.marche_id IN (SELECT id FROM marche WHERE serie_id = s.id))::int AS nb_paris,
		       json_agg(json_build_object('nom', e.nom, 'sigle', e.sigle, 'logo_url', e.logo_url) ORDER BY p.cote_terrain) AS equipes
		  FROM serie s
		  JOIN competition c ON c.id = s.competition_id
		  JOIN jeu j ON j.id = c.jeu_id
		  JOIN marche m ON m.serie_id = s.id AND m.type = 'vainqueur' AND m.partie_numero IS NULL
		  JOIN participation p ON p.serie_id = s.id
		  JOIN equipe e ON e.id = p.equipe_id
		 WHERE s.date_prevue <= now()
		   AND m.statut IN ('ouvert', 'verrouille')
		 GROUP BY s.id, c.nom, j.code, m.id
		 ORDER BY s.date_prevue
	`);
}

/**
 * Valide le vainqueur d'un match : règle le marché Vainqueur (les paris sont payés),
 * annule les autres marchés du match qu'on ne sait pas encore régler, et clôt le match.
 */
export async function validerVainqueur(serieId, nomGagnant) {
	return transaction(async (c) => {
		const { rows: marches } = await c.query(`SELECT id, type, partie_numero FROM marche WHERE serie_id = $1 AND statut NOT IN ('regle', 'annule') FOR UPDATE`, [serieId]);
		const vainqueur = marches.find((m) => m.type === 'vainqueur' && m.partie_numero === null);
		if (!vainqueur) throw new ErreurSaisie('Ce match est déjà réglé.');

		const { rows } = await c.query('SELECT regler_marche($1, $2) AS nb', [vainqueur.id, nomGagnant]);
		for (const m of marches) if (m !== vainqueur) await c.query('SELECT annuler_marche($1)', [m.id]);

		await c.query(
			`UPDATE participation p SET classement = CASE WHEN e.nom = $2 THEN 1 ELSE 2 END
			   FROM equipe e WHERE e.id = p.equipe_id AND p.serie_id = $1`,
			[serieId, nomGagnant]
		);
		await c.query(`UPDATE serie SET statut = 'terminee', resultat_valide = true WHERE id = $1`, [serieId]);
		return rows[0].nb;
	});
}

/** Annule un match : tous ses marchés sont annulés et les paris remboursés selon les règles */
export async function annulerMatch(serieId) {
	return transaction(async (c) => {
		const { rows: marches } = await c.query(`SELECT id FROM marche WHERE serie_id = $1 AND statut NOT IN ('regle', 'annule') FOR UPDATE`, [serieId]);
		if (marches.length === 0) throw new ErreurSaisie('Ce match est déjà réglé ou annulé.');
		for (const m of marches) await c.query('SELECT annuler_marche($1)', [m.id]);
		await c.query(`UPDATE serie SET statut = 'annulee', resultat_valide = true WHERE id = $1`, [serieId]);
	});
}

/** Membres de la ligue, avec leur solde */
export async function membres(ligueId) {
	return requete(
		`SELECT u.id, u.pseudo, m.role, m.rejoint_le, u.auth_id IS NOT NULL AS a_un_compte, solde($1, u.id) AS solde
		   FROM membre_ligue m JOIN utilisateur u ON u.id = m.utilisateur_id
		  WHERE m.ligue_id = $1
		  ORDER BY m.role, lower(u.pseudo)`,
		[ligueId]
	);
}

export async function codeInvitation(ligueId) {
	const [l] = await requete('SELECT code_invitation FROM ligue WHERE id = $1', [ligueId]);
	return l?.code_invitation ?? null;
}

/**
 * Remplace le mot de passe d'un membre par un mot de passe temporaire, renvoyé une seule fois
 * à l'administrateur. Toutes les sessions du membre sont fermées.
 */
export async function reinitialiserMotDePasse(ligueId, utilisateurId) {
	const [cible] = await requete(
		`SELECT u.pseudo, u.auth_id FROM utilisateur u JOIN membre_ligue m ON m.utilisateur_id = u.id
		  WHERE u.id = $1 AND m.ligue_id = $2`,
		[utilisateurId, ligueId]
	);
	if (!cible?.auth_id) throw new ErreurSaisie('Ce membre n’a pas de compte de connexion.');

	const temporaire = motDePasseTemporaire();
	const ctx = await auth.$context;
	const hache = await ctx.password.hash(temporaire); // même hachage que Better Auth à l'inscription
	await transaction(async (c) => {
		const r = await c.query(`UPDATE account SET password = $1, "updatedAt" = now() WHERE "userId" = $2 AND "providerId" = 'credential'`, [hache, cible.auth_id]);
		if (r.rowCount !== 1) throw new ErreurSaisie('Compte de connexion introuvable.');
		await c.query('DELETE FROM session WHERE "userId" = $1', [cible.auth_id]);
	});
	return { pseudo: cible.pseudo, temporaire };
}

/** Erreur de saisie à montrer telle quelle à l'administrateur */
export class ErreurSaisie extends Error {}

// Sigle par défaut : initiales des mots, ou trois premières lettres (« Corbeaux de Lille » → CDL)
function sigleDe(nom) {
	const mots = nom.split(/\s+/).filter(Boolean);
	const s = mots.length > 1 ? mots.map((m) => m[0]).join('') : nom.slice(0, 3);
	return s.toUpperCase().slice(0, 4);
}

// 10 caractères faciles à dicter (sans 0/O ni 1/l/I)
function motDePasseTemporaire() {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	let s = '';
	for (let i = 0; i < 10; i++) s += alphabet[randomInt(alphabet.length)];
	return s.slice(0, 5) + '-' + s.slice(5);
}
