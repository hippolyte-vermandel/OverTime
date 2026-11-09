import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.js';

export function load() {
	redirect(303, '/profil');
}

export const actions = {
	default: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		redirect(303, '/connexion');
	}
};
