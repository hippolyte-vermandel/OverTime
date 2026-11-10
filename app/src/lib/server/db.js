// Connexion à PostgreSQL.
// Ce fichier est dans un dossier "server" : SvelteKit garantit qu'il ne sera
// JAMAIS envoyé au navigateur (le mot de passe de la base reste sur le serveur).
import pg from 'pg';
import { DATABASE_URL } from '$app/env/private';

// Un "pool" garde quelques connexions ouvertes et les réutilise :
// bien plus rapide que de se reconnecter à chaque page.
export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

// PostgreSQL renvoie les nombres décimaux (les cotes) sous forme de texte
// pour ne perdre aucune précision ; ici on les veut en nombres JavaScript.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));

/**
 * Exécute une requête SQL avec des paramètres ($1, $2...).
 * Ne JAMAIS coller une valeur directement dans le texte SQL :
 * les paramètres protègent contre les injections SQL.
 * @param {string} sql
 * @param {unknown[]} [params]
 */
export async function requete(sql, params = []) {
	const resultat = await pool.query(sql, params);
	return resultat.rows;
}

/**
 * Exécute plusieurs requêtes dans une même transaction : tout réussit, ou rien.
 * @template T
 * @param {(client: pg.PoolClient) => Promise<T>} travail
 * @returns {Promise<T>}
 */
export async function transaction(travail) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const resultat = await travail(client);
		await client.query('COMMIT');
		return resultat;
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}
