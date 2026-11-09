<script>
	// Feuille de filtre par jeu. « Tous les jeux » est coché quand aucun filtre n'est actif.
	import PictoJeu from './PictoJeu.svelte';

	/** @type {{ jeux: { code: string, nom: string }[], choisis: string[], nbVisibles: number, onbasculer: (code: string) => void, ontous: () => void, onfermer: () => void }} */
	let { jeux, choisis, nbVisibles, onbasculer, ontous, onfermer } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onfermer()} />

{#snippet coche()}
	<svg class="coche" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
{/snippet}

<div class="voile">
	<button class="fond" aria-label="Fermer le filtre" onclick={onfermer}></button>
	<div class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-filtre">
		<h2 id="titre-filtre">Jeux affichés</h2>
		<div class="grille">
			<button class="puce tous" aria-pressed={choisis.length === 0} onclick={ontous}>
				<span class="nom">Tous les jeux</span>{#if choisis.length === 0}{@render coche()}{/if}
			</button>
			{#each jeux as j (j.code)}
				{@const actif = choisis.includes(j.code)}
				<button class="puce" aria-pressed={actif} onclick={() => onbasculer(j.code)}>
					<PictoJeu jeu={j.code} />
					<span class="nom">{j.nom}</span>
					{#if actif}{@render coche()}{/if}
				</button>
			{/each}
		</div>
		<button class="voir" onclick={onfermer}>Voir {nbVisibles} match{nbVisibles > 1 ? 's' : ''}</button>
	</div>
</div>

<style>
	.voile {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.fond {
		flex: 1;
		border: none;
		background: rgb(5 5 10 / 0.6);
	}
	.feuille {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		max-width: 640px;
		margin: 0 auto;
		padding: 18px 16px calc(env(safe-area-inset-bottom) + 24px);
		border-radius: var(--r-feuille) var(--r-feuille) 0 0;
		background: var(--surface-gradin);
		border-top: 1px solid var(--surface-active);
	}
	h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}
	.grille {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.puce {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		padding: 0 12px;
		border-radius: var(--r-controle);
		background: var(--surface-carte);
		border: 1px solid var(--surface-active);
	}
	.puce[aria-pressed='true'] {
		background: var(--surface-active);
		border-color: var(--magenta-arene);
	}
	.tous {
		grid-column: 1 / -1;
	}
	.nom {
		flex: 1;
		text-align: left;
		font-size: 14px;
		font-weight: 600;
	}
	.coche {
		width: 18px;
		height: 18px;
		flex: 0 0 auto;
		fill: none;
		stroke: var(--magenta-arene);
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.voir {
		min-height: 50px;
		border-radius: var(--r-controle);
		border: none;
		background: var(--texte-principal);
		color: var(--nuit-arene);
		font-size: 16px;
		font-weight: 700;
	}
</style>
