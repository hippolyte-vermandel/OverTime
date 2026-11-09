<script>
	// Cadre des pages de connexion et d'inscription : le logo, puis le formulaire.
	/** @type {{ titre: string, sousTitre?: string, children: import('svelte').Snippet }} */
	let { titre, sousTitre = '', children } = $props();
</script>

<div class="cadre">
	<span class="logo" aria-label="OverTime">Over<span>Time</span></span>
	<p class="slogan">Pronostics e-sport entre potes</p>
	<section class="carte" aria-labelledby="titre-compte">
		<h1 id="titre-compte">{titre}</h1>
		{#if sousTitre}<p class="sous-titre">{sousTitre}</p>{/if}
		{@render children()}
	</section>
</div>

<style>
	.cadre {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 32px 16px 40px;
	}
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 40px;
		font-weight: 800;
		font-style: italic;
		letter-spacing: -0.01em;
		text-transform: uppercase;
		line-height: 1;
	}
	.logo span {
		display: inline-block;
		padding: 4px 12px 6px;
		border-radius: 10px;
		background: var(--magenta-arene);
		color: var(--nuit-arene);
		transform: skewX(-10deg);
		box-shadow: var(--lueur-choix);
	}
	.slogan {
		margin: 0 0 18px;
		font-size: 14px;
		color: var(--texte-discret);
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 100%;
		max-width: 420px;
		padding: 20px 16px;
		border-radius: var(--r-section);
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	h1 {
		margin: 0;
		font-size: 24px;
		font-weight: 700;
	}
	.sous-titre {
		margin: -6px 0 0;
		font-size: 14px;
		line-height: 1.45;
		color: var(--texte-discret);
	}
	/* Styles partagés des formulaires de compte */
	.carte :global(form) {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.carte :global(label.champ) {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		font-weight: 500;
		color: var(--texte-doux);
	}
	.carte :global(input[type='text']),
	.carte :global(input[type='password']) {
		min-height: 48px;
		padding: 0 14px;
		border-radius: var(--r-controle);
		border: 1px solid var(--bordure-forte);
		background: var(--surface-carte);
		color: var(--texte-principal);
		font: inherit;
		font-size: 16px; /* 16 px : iOS ne zoome pas sur le champ */
	}
	.carte :global(input:focus-visible) {
		outline: 2px solid var(--texte-principal);
		outline-offset: 1px;
	}
	.carte :global(input[aria-invalid='true']) {
		border-color: var(--rouge-perte);
	}
	.carte :global(.aide) {
		font-size: 12px;
		font-weight: 400;
		color: var(--texte-discret);
	}
	.carte :global(.erreur) {
		margin: 0;
		padding: 10px 12px;
		border-radius: var(--r-bouton);
		background: #ff94941a;
		color: var(--rouge-perte);
		font-size: 14px;
	}
	.carte :global(button[type='submit']) {
		min-height: 52px;
		border: none;
		border-radius: var(--r-controle);
		background: var(--texte-principal);
		color: var(--nuit-arene);
		font-size: 16px;
		font-weight: 700;
	}
	.carte :global(.bascule) {
		margin: 0;
		text-align: center;
		font-size: 14px;
		color: var(--texte-discret);
	}
	.carte :global(.bascule a) {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-weight: 600;
		color: var(--texte-principal);
	}
</style>
