import { fail, redirect } from '@sveltejs/kit';
import { auth, emailInterne, PSEUDO_MIN, PSEUDO_MAX, MOT_DE_PASSE_MIN } from '#lib/server/auth.js';
import { requete, transaction } from '#lib/server/db.js';

export function load({ locals, url }) {
	if (locals.joueur) redirect(303, '/');
	// Un lien d'invitation peut contenir le code : /inscription?code=OVT-7KQ2
	return { code: url.searchParams.get('code') ?? '', regles: { PSEUDO_MIN, PSEUDO_MAX, MOT_DE_PASSE_MIN } };
}

const PSEUDO_VALIDE = new RegExp(`^[A-Za-z0-9_.-]{${PSEUDO_MIN},${PSEUDO_MAX}}$`);

export const actions = {
	default: async ({ request }) => {
		const f = await request.formData();
		const pseudo = String(f.get('pseudo') ?? '').trim();
		const motDePasse = String(f.get('mot_de_passe') ?? '');
		const confirmation = String(f.get('confirmation') ?? '');
		const code = String(f.get('code') ?? '').trim().toUpperCase();
		const majeur = f.get('majeur') === 'on';
		const garde = { pseudo, code };

		if (!PSEUDO_VALIDE.test(pseudo))
			return fail(400, { ...garde, champ: 'pseudo', erreur: `Ton pseudo doit faire de ${PSEUDO_MIN} à ${PSEUDO_MAX} caractères : lettres, chiffres, point, tiret ou tiret bas.` });
		if (motDePasse.length < MOT_DE_PASSE_MIN)
			return fail(400, { ...garde, champ: 'mot_de_passe', erreur: `Ton mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.` });
		if (motDePasse !== confirmation)
			return fail(400, { ...garde, champ: 'confirmation', erreur: 'Les deux mots de passe ne sont pas identiques.' });
		if (!majeur)
			return fail(400, { ...garde, champ: 'majeur', erreur: 'OverTime est réservé aux personnes majeures.' });

		const [ligue] = await requete('SELECT id FROM ligue WHERE code_invitation = $1', [code]);
		if (!ligue) return fail(400, { ...garde, champ: 'code', erreur: 'Ce code d’invitation n’existe pas. Demande-le à l’administrateur de ta ligue.' });

		const [pris] = await requete('SELECT 1 FROM utilisateur WHERE lower(pseudo) = lower($1)', [pseudo]);
		if (pris) return fail(400, { ...garde, champ: 'pseudo', erreur: 'Ce pseudo est déjà pris.' });

		// 1. Le compte de connexion (Better Auth hache le mot de passe et ouvre la session)
		let authId;
		try {
			const r = await auth.api.signUpEmail({
				body: { email: emailInterne(pseudo), password: motDePasse, name: pseudo, username: pseudo, displayUsername: pseudo }
			});
			authId = r.user.id;
		} catch (e) {
			console.error('Inscription impossible :', e);
			return fail(400, { ...garde, champ: 'pseudo', erreur: 'Inscription impossible avec ce pseudo. Essaie un autre pseudo.' });
		}

		// 2. Le joueur et son entrée dans la ligue, ensemble ou pas du tout
		try {
			await transaction(async (c) => {
				const { rows } = await c.query('INSERT INTO utilisateur (pseudo, auth_id) VALUES ($1, $2) RETURNING id', [pseudo, authId]);
				await c.query('SELECT rejoindre_ligue($1, $2)', [rows[0].id, code]);
			});
		} catch (e) {
			console.error('Création du joueur impossible :', e);
			await requete('DELETE FROM "user" WHERE id = $1', [authId]); // on ne laisse pas de compte orphelin
			return fail(500, { ...garde, erreur: 'Une erreur est survenue pendant l’inscription. Réessaie dans un instant.' });
		}
		redirect(303, '/');
	}
};
