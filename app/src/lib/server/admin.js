// Outils de l'administrateur : saisie des matchs, validation des résultats, membres.
import { randomInt } from 'node:crypto';
import { FUSEAU_HORAIRE } from '$app/env/public';
import { requete, transaction } from './db.js';
import { auth } from './auth.js';
import { calculerCotes } from './cotes/index.js';

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

/** Date et heure locales « AAAA-MM-JJTHH:MM » de la ligue → instant réel */
export async function instant(quand) {
	const [r] = await requete('SELECT ($1::timestamp AT TIME ZONE $2) AS t', [quand, FUSEAU_HORAIRE]);
	return new Date(r.t);
}

/** Nombre de manches à gagner pour remporter une série */
const aGagner = (bestOf) => Math.floor(bestOf / 2) + 1;

/**
 * Vérifie un score de série (ex. 3-1 en BO5) et renvoie le côté gagnant, ou lance une ErreurSaisie.
 */
export function verifierScore(bestOf, scoreA, scoreB) {
	const g = aGagner(bestOf);
	const ok = Number.isInteger(scoreA) && Number.isInteger(scoreB) && Math.max(scoreA, scoreB) === g && Math.min(scoreA, scoreB) >= 0 && Math.min(scoreA, scoreB) < g;
	if (!ok) throw new ErreurSaisie(`Score impossible en BO${bestOf} : la gagnante doit avoir ${g} manche${g > 1 ? 's' : ''}.`);
	return scoreA > scoreB ? 'A' : 'B';
}

// Crée (ou retrouve) la compétition et les deux équipes, puis la série et ses deux participations
async function creerSerie(c, m, statut) {
	const un = async (sql, params) => (await c.query(sql, params)).rows[0];
	const jeu = await un('SELECT id FROM jeu WHERE code = $1', [m.jeu]);
	if (!jeu) throw new ErreurSaisie('Jeu inconnu.');
	const comp =
		(await un('SELECT id FROM competition WHERE jeu_id = $1 AND lower(nom) = lower($2)', [jeu.id, m.competition])) ??
		(await un('INSERT INTO competition (jeu_id, nom, region) VALUES ($1, $2, $3) RETURNING id', [jeu.id, m.competition, m.region || 'International']));
	const equipe = async (nom) =>
		(await un('SELECT id, nom FROM equipe WHERE lower(nom) = lower($1)', [nom])) ??
		(await un('INSERT INTO equipe (nom, sigle) VALUES ($1, $2) RETURNING id, nom', [nom, sigleDe(nom)]));
	const a = await equipe(m.equipeA);
	const b = await equipe(m.equipeB);
	if (a.id === b.id) throw new ErreurSaisie('Les deux équipes doivent être différentes.');
	const serie = await un(
		`INSERT INTO serie (competition_id, phase, date_prevue, best_of, statut, resultat_valide)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, date_prevue`,
		[comp.id, m.phase || null, m.quand, m.bestOf, statut, statut === 'terminee']
	);
	await c.query(`INSERT INTO participation (serie_id, equipe_id, cote_terrain) VALUES ($1, $2, 'A'), ($1, $3, 'B')`, [serie.id, a.id, b.id]);
	return { serie, a, b, un };
}

/**
 * Crée un match à venir et ses paris, avec des cotes calculées par le moteur
 * (Elo des équipes et confrontations directes, à partir de l'historique de la base).
 * Les paris : vainqueur, score exact et « dernière manche jouée » (à partir du BO3).
 * @param {{ jeu: string, competition: string, region: string, phase: string, quand: Date,
 *           bestOf: number, equipeA: string, equipeB: string }} m
 */
export async function creerMatch(m) {
	if (m.quand <= new Date()) throw new ErreurSaisie('La date du match est déjà passée. Pour un match déjà joué, coche « Match déjà joué ».');
	const cotes = await calculerCotes(m);
	return transaction(async (c) => {
		const { serie, a, b, un } = await creerSerie(c, m, 'programmee');
		const marche = async (type, libelle) =>
			(await un(`INSERT INTO marche (serie_id, type, libelle, ferme_le) VALUES ($1, $2, $3, $4) RETURNING id`, [serie.id, type, libelle, serie.date_prevue])).id;
		const issue = (marcheId, libelle, p, cote) =>
			c.query(`INSERT INTO issue (marche_id, libelle, probabilite, cote) VALUES ($1, $2, $3, $4)`, [marcheId, libelle, p.toFixed(4), cote]);

		const v = await marche('vainqueur', 'Vainqueur');
		await issue(v, a.nom, cotes.pA, cotes.coteA);
		await issue(v, b.nom, cotes.pB, cotes.coteB);
		if (m.bestOf > 1) {
			const s = await marche('score_exact', `Score exact (${a.nom} en premier)`);
			for (const sc of cotes.scores) await issue(s, sc.libelle, sc.p, sc.cote);
			const d = await marche('map_jouee', `La manche ${m.bestOf} sera-t-elle jouée ?`);
			await issue(d, 'oui', cotes.derniere.oui.p, cotes.derniere.oui.cote);
			await issue(d, 'non', cotes.derniere.non.p, cotes.derniere.non.cote);
		}
		return { serieId: serie.id, cotes };
	});
}

/**
 * Enregistre un match déjà joué (sans paris), pour nourrir l'historique du moteur de cotes.
 * @param {{ jeu: string, competition: string, region: string, phase: string, quand: Date,
 *           bestOf: number, equipeA: string, equipeB: string, scoreA: number, scoreB: number }} m
 */
export async function enregistrerMatchPasse(m) {
	if (m.quand > new Date()) throw new ErreurSaisie('Ce match n’a pas encore eu lieu : décoche « Match déjà joué » pour ouvrir les paris.');
	const cote = verifierScore(m.bestOf, m.scoreA, m.scoreB);
	return transaction(async (c) => {
		const { serie } = await creerSerie(c, m, 'terminee');
		await c.query(
			`UPDATE participation SET score = CASE cote_terrain WHEN 'A' THEN $2::int ELSE $3::int END,
			        classement = CASE WHEN cote_terrain = $4 THEN 1 ELSE 2 END
			  WHERE serie_id = $1`,
			[serie.id, m.scoreA, m.scoreB, cote]
		);
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
 * Valide le résultat d'un match à partir du score en manches : règle le vainqueur,
 * le score exact et « dernière manche jouée » (les paris sont payés), annule les marchés
 * qu'on ne sait pas encore régler, et clôt le match. Le score nourrit le moteur de cotes.
 */
export async function validerResultat(serieId, scoreA, scoreB) {
	return transaction(async (c) => {
		const { rows: [s] } = await c.query('SELECT id, best_of FROM serie WHERE id = $1 FOR UPDATE', [serieId]);
		if (!s) throw new ErreurSaisie('Match introuvable.');
		const gagnantCote = verifierScore(s.best_of ?? 1, scoreA, scoreB);
		const { rows: equipes } = await c.query(`SELECT p.cote_terrain, e.nom FROM participation p JOIN equipe e ON e.id = p.equipe_id WHERE p.serie_id = $1`, [serieId]);
		const gagnant = equipes.find((e) => e.cote_terrain === gagnantCote)?.nom;

		const { rows: marches } = await c.query(`SELECT id, type, partie_numero FROM marche WHERE serie_id = $1 AND statut NOT IN ('regle', 'annule') FOR UPDATE`, [serieId]);
		if (!marches.some((m) => m.type === 'vainqueur' && m.partie_numero === null)) throw new ErreurSaisie('Ce match est déjà réglé.');

		let nb = 0;
		for (const m of marches) {
			let gagnante = null;
			if (m.partie_numero === null && m.type === 'vainqueur') gagnante = gagnant;
			else if (m.partie_numero === null && m.type === 'score_exact') gagnante = `${scoreA}-${scoreB}`;
			else if (m.partie_numero === null && m.type === 'map_jouee') gagnante = scoreA + scoreB === s.best_of ? 'oui' : 'non';
			const existe = gagnante !== null && (await c.query('SELECT 1 FROM issue WHERE marche_id = $1 AND libelle = $2', [m.id, gagnante])).rowCount > 0;
			const { rows } = existe ? await c.query('SELECT regler_marche($1, $2) AS nb', [m.id, gagnante]) : await c.query('SELECT annuler_marche($1) AS nb', [m.id]);
			nb += rows[0].nb;
		}
		await c.query(
			`UPDATE participation SET score = CASE cote_terrain WHEN 'A' THEN $2::int ELSE $3::int END,
			        classement = CASE WHEN cote_terrain = $4 THEN 1 ELSE 2 END
			  WHERE serie_id = $1`,
			[serieId, scoreA, scoreB, gagnantCote]
		);
		await c.query(`UPDATE serie SET statut = 'terminee', resultat_valide = true WHERE id = $1`, [serieId]);
		return { nb, gagnant };
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
