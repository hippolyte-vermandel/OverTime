<script>
	// Blason d'une équipe : son logo s'il est fourni par la source de données,
	// sinon son sigle dans un carré neutre. Aucun logo officiel n'est dessiné ici.
	/** @type {{ equipe: { nom: string, sigle?: string, logo_url?: string }, taille?: number }} */
	let { equipe, taille = 20 } = $props();

	const sigle = $derived(equipe.sigle ?? equipe.nom.slice(0, 3).toUpperCase());
	// Image introuvable ou refusée par l'hébergeur : on revient au sigle
	let casse = $state(false);
	$effect(() => {
		equipe.logo_url;
		casse = false;
	});
</script>

<span class="blason" style="--t: {taille}px" aria-hidden="true">
	{#if equipe.logo_url && !casse}
		<img src={equipe.logo_url} alt="" width={taille} height={taille} loading="lazy" referrerpolicy="no-referrer" onerror={() => (casse = true)} />
	{:else}
		<span class="sigle" style="font-size: {Math.max(7, Math.round(taille * (sigle.length > 3 ? 0.28 : 0.36)))}px">{sigle}</span>
	{/if}
</span>

<style>
	.blason {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: var(--t);
		height: var(--t);
		border-radius: calc(var(--t) * 0.3);
		background: var(--surface-active);
		border: 1px solid var(--bordure-forte);
		overflow: hidden;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.sigle {
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--texte-doux);
		line-height: 1;
	}
</style>
