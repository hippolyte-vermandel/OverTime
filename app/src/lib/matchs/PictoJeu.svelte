<script>
	import { picto } from '#lib/jeux.js';

	/** @type {{ jeu: string, taille?: number }} */
	let { jeu, taille = 30 } = $props();
</script>

<span class="picto" style="--t: {taille}px; --c: var(--jeu-{jeu}, var(--texte-discret))" aria-hidden="true">
	<svg viewBox="0 0 24 24" width={Math.round(taille * 0.6)} height={Math.round(taille * 0.6)}><path d={picto(jeu)} /></svg>
</span>

<style>
	.picto {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: var(--t);
		height: var(--t);
		border-radius: calc(var(--t) * 0.3);
		background: color-mix(in srgb, var(--c) 15%, transparent);
	}
	svg {
		fill: none;
		stroke: var(--c);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
