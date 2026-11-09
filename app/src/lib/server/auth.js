// Comptes et sessions, gérés par Better Auth.
// On se connecte avec un pseudo et un mot de passe : pas d'adresse e-mail demandée.
// Better Auth exige malgré tout un e-mail en interne ; on en fabrique un
// qui ne peut appartenir à personne (domaine réservé « .invalid »).
import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins/username';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { pool } from './db.js';

export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 20;
export const MOT_DE_PASSE_MIN = 8;

export const auth = betterAuth({
	database: pool,
	secret: BETTER_AUTH_SECRET,
	baseURL: BETTER_AUTH_URL,
	emailAndPassword: {
		enabled: true,
		minPasswordLength: MOT_DE_PASSE_MIN,
		autoSignIn: true
	},
	session: {
		// On reste connecté deux mois : c'est une appli installée sur le téléphone
		expiresIn: 60 * 60 * 24 * 60,
		updateAge: 60 * 60 * 24
	},
	plugins: [
		username({ minUsernameLength: PSEUDO_MIN, maxUsernameLength: PSEUDO_MAX }),
		sveltekitCookies(getRequestEvent) // toujours en dernier
	]
});

/** Adresse interne fabriquée à partir du pseudo (jamais utilisée pour écrire à qui que ce soit) */
export const emailInterne = (pseudo) => `${pseudo.toLowerCase()}@joueurs.overtime.invalid`;
