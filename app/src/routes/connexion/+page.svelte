<script>
	import { enhance } from '$app/forms';
	import CadreCompte from '#lib/compte/CadreCompte.svelte';

	let { form } = $props();
	let envoi = $state(false);
</script>

<svelte:head><title>Connexion · OverTime</title></svelte:head>

<CadreCompte titre="Connexion">
	<form method="POST" use:enhance={() => { envoi = true; return async ({ update }) => { await update(); envoi = false; }; }}>
		{#if form?.erreur}<p class="erreur" role="alert">{form.erreur}</p>{/if}
		<label class="champ">Pseudo
			<input type="text" name="pseudo" value={form?.pseudo ?? ''} autocomplete="username" autocapitalize="none" spellcheck="false" required />
		</label>
		<label class="champ">Mot de passe
			<input type="password" name="mot_de_passe" autocomplete="current-password" required />
		</label>
		<button type="submit" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</button>
	</form>
	<p class="bascule">Pas encore de compte ? <a href="/inscription">Créer un compte</a></p>
	<p class="bascule">Mot de passe oublié ? Demande à l’administrateur de ta ligue de le réinitialiser.</p>
</CadreCompte>
