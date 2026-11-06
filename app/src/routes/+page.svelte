<script>
	import CarteMatch from '#lib/CarteMatch.svelte';
	import { cleJour, titreJour } from '#lib/format.js';

	let { data } = $props();

	// Regroupe les matchs par jour : [{ cle, titre, matchs: [...] }, ...]
	const jours = $derived.by(() => {
		const groupes = new Map();
		for (const m of data.matchs) {
			const cle = cleJour(m.date_prevue);
			if (!groupes.has(cle)) groupes.set(cle, []);
			groupes.get(cle).push(m);
		}
		return [...groupes].map(([cle, matchs]) => ({ cle, titre: titreJour(cle), matchs }));
	});
</script>

<svelte:head>
	<title>Matchs · OverTime</title>
</svelte:head>

<h1 class="visuellement-cache">Prochains matchs</h1>

{#if data.erreur}
	<p class="message erreur" role="alert">{data.erreur}</p>
{:else if jours.length === 0}
	<p class="message">Aucun match programmé pour l'instant. L'administrateur de la ligue peut en ajouter.</p>
{/if}

{#each jours as jour (jour.cle)}
	<section aria-labelledby="jour-{jour.cle}">
		<h2 id="jour-{jour.cle}">{jour.titre}</h2>
		<div class="liste">
			{#each jour.matchs as match (match.id)}
				<CarteMatch {match} />
			{/each}
		</div>
	</section>
{/each}

<style>
	h2 {
		margin: 22px 4px 10px;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--texte-2);
	}
	h2::first-letter {
		text-transform: uppercase;
	}
	.liste {
		display: grid;
		gap: 10px;
	}
	.message {
		margin-top: 32px;
		padding: 16px;
		border-radius: var(--rayon);
		background: var(--surface);
		color: var(--texte-2);
		text-align: center;
	}
	.erreur {
		color: var(--perte);
		border: 1px solid color-mix(in srgb, var(--perte) 40%, transparent);
	}
</style>
