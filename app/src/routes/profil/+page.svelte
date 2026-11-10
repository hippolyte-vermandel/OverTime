<script>
	import { formatNombre } from '#lib/format.js';

	let { data } = $props();
	const j = $derived(data.joueur);
</script>

<svelte:head><title>Profil · OverTime</title></svelte:head>

<div class="profil">
	<section class="identite">
		<span class="avatar" aria-hidden="true">{j.pseudo.charAt(0).toUpperCase()}</span>
		<div>
			<h1>{j.pseudo}</h1>
			{#if j.ligue}
				<span class="ligue">{j.ligue.nom}{j.role === 'admin' ? ', administrateur' : ''}</span>
			{/if}
		</div>
	</section>

	{#if j.ligue}
		<section class="carte">
			<h2>Saison en cours</h2>
			<div class="ligne"><span>Solde</span><span class="fort">{formatNombre(j.solde)} noxus</span></div>
			<div class="ligne"><span>Mise par pari</span><span>de {j.ligue.mise_min} à {j.ligue.mise_max} noxus</span></div>
		</section>
	{/if}

	{#if j.role === 'admin'}
		<a class="lien-admin" href="/admin">
			<span><span class="titre-lien">Administration</span><span class="sous">Ajouter des matchs, valider les résultats, gérer les membres</span></span>
			<span aria-hidden="true">›</span>
		</a>
	{/if}

	<p class="bientot">Statistiques, saisons passées, règles du jeu et invitations arrivent bientôt.</p>

	<form method="POST" action="/deconnexion">
		<button type="submit" class="deconnexion">Se déconnecter</button>
	</form>
</div>

<style>
	.profil {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 8px 12px 24px;
	}
	.identite {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 6px 6px 0;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--texte-principal);
		color: var(--nuit-arene);
		font-size: 26px;
		font-weight: 700;
	}
	h1 {
		margin: 0;
		font-size: 26px;
		font-weight: 700;
	}
	.ligue {
		font-size: 13px;
		color: var(--texte-discret);
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px;
		border-radius: 20px;
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}
	.ligne {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
		color: var(--texte-doux);
	}
	.fort {
		font-size: 17px;
		font-weight: 700;
		color: var(--texte-principal);
	}
	.bientot {
		margin: 0;
		padding: 14px 16px;
		border-radius: 20px;
		border: 1px dashed var(--surface-active);
		font-size: 14px;
		color: var(--texte-discret);
	}
	.lien-admin {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 56px;
		padding: 8px 14px;
		border-radius: 20px;
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
		text-decoration: none;
		font-size: 18px;
		color: var(--texte-discret);
	}
	.lien-admin > span:first-child {
		display: flex;
		flex-direction: column;
	}
	.titre-lien {
		font-size: 15px;
		font-weight: 600;
		color: var(--texte-principal);
	}
	.sous {
		font-size: 12px;
		color: var(--texte-discret);
	}
	.deconnexion {
		width: 100%;
		min-height: 48px;
		border: none;
		background: transparent;
		color: var(--rouge-perte);
		font-size: 15px;
		font-weight: 600;
	}
</style>
