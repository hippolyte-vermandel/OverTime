import { fail, redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.js';

export function load({ locals }) {
	if (locals.joueur) redirect(303, '/');
}

export const actions = {
	default: async ({ request }) => {
		const f = await request.formData();
		const pseudo = String(f.get('pseudo') ?? '').trim();
		const motDePasse = String(f.get('mot_de_passe') ?? '');
		if (!pseudo || !motDePasse) return fail(400, { pseudo, erreur: 'Indique ton pseudo et ton mot de passe.' });

		try {
			// Le module sveltekitCookies pose le cookie de session dans la réponse
			await auth.api.signInUsername({ body: { username: pseudo, password: motDePasse } });
		} catch {
			return fail(400, { pseudo, erreur: 'Pseudo ou mot de passe incorrect.' });
		}
		redirect(303, '/');
	}
};
