<script>
	import { enhance } from '$app/forms';
	import CadreCompte from '#lib/compte/CadreCompte.svelte';

	let { data, form } = $props();
	let envoi = $state(false);
	const r = $derived(data.regles);
	const invalide = (champ) => (form?.champ === champ ? 'true' : undefined);
</script>

<svelte:head><title>Créer un compte · OverTime</title></svelte:head>

<CadreCompte titre="Créer un compte" sousTitre="Il te faut le code d’invitation de ta ligue. Aucune adresse e-mail n’est demandée.">
	<form method="POST" use:enhance={() => { envoi = true; return async ({ update }) => { await update({ reset: false }); envoi = false; }; }}>
		{#if form?.erreur}<p class="erreur" role="alert">{form.erreur}</p>{/if}
		<label class="champ">Code d’invitation
			<input type="text" name="code" value={form?.code ?? data.code} autocapitalize="characters" spellcheck="false" placeholder="OVT-7KQ2" required aria-invalid={invalide('code')} />
		</label>
		<label class="champ">Pseudo
			<input type="text" name="pseudo" value={form?.pseudo ?? ''} autocomplete="username" autocapitalize="none" spellcheck="false" minlength={r.PSEUDO_MIN} maxlength={r.PSEUDO_MAX} required aria-invalid={invalide('pseudo')} />
			<span class="aide">De {r.PSEUDO_MIN} à {r.PSEUDO_MAX} caractères. C’est le nom que verront tes amis.</span>
		</label>
		<label class="champ">Mot de passe
			<input type="password" name="mot_de_passe" autocomplete="new-password" minlength={r.MOT_DE_PASSE_MIN} required aria-invalid={invalide('mot_de_passe')} />
			<span class="aide">Au moins {r.MOT_DE_PASSE_MIN} caractères.</span>
		</label>
		<label class="champ">Confirme le mot de passe
			<input type="password" name="confirmation" autocomplete="new-password" required aria-invalid={invalide('confirmation')} />
		</label>
		<label class="case">
			<input type="checkbox" name="majeur" required aria-invalid={invalide('majeur')} />
			<span>J’ai 18 ans ou plus. Les noxus sont virtuels : aucun argent réel n’est en jeu.</span>
		</label>
		<button type="submit" disabled={envoi}>{envoi ? 'Création…' : 'Créer mon compte'}</button>
	</form>
	<p class="bascule">Déjà un compte ? <a href="/connexion">Se connecter</a></p>
</CadreCompte>

<style>
	.case {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		min-height: 44px;
		font-size: 14px;
		line-height: 1.4;
		color: var(--texte-doux);
	}
	.case input {
		flex: 0 0 auto;
		width: 22px;
		height: 22px;
		margin: 0;
		accent-color: var(--magenta-arene);
	}
</style>
