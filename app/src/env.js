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
	FUSEAU_HORAIRE: {
		public: true,
		description: "Fuseau dans lequel les heures des matchs sont affichées",
		schema: (valeur) => valeur || 'Europe/Paris'
	}
});
