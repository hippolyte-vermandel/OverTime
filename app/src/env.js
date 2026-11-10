import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Variables d'environnement de l'application.
 * Leurs valeurs se mettent dans le fichier `.env` (voir `.env.example`),
 * jamais directement dans le code : ce sont des secrets.
 */
export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			"Adresse de connexion à PostgreSQL, ex. postgres://overtime:motdepasse@localhost:5432/overtime"
	},
	BETTER_AUTH_SECRET: {
		description:
			"Clé secrète des sessions (32 caractères au hasard ou plus). Générer : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
	},
	BETTER_AUTH_URL: {
		description: "Adresse publique de l'application, ex. http://192.168.1.20:3000 (sans / final)"
	},
	FUSEAU_HORAIRE: {
		public: true,
		description: "Fuseau dans lequel les heures des matchs sont affichées",
		schema: (valeur) => valeur || 'Europe/Paris'
	}
});
