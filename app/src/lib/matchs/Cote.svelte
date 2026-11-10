<script>
	// Une cote de duel : inclinée vers le VS, en miroir de celle d'en face.
	// Vert quand elle est libre, magenta (dégradé dense, liseré, lueur) quand elle est choisie.
	import { formatCote } from '#lib/format.js';
	import Blason from './Blason.svelte';

	/** @type {{ equipe: any, cote: number, cote_a: boolean, choisie: boolean, grand?: boolean, desactivee?: boolean, onclick: () => void }} */
	let { equipe, cote, cote_a, choisie, grand = false, desactivee = false, onclick } = $props();
</script>

<button
	class="cote"
	class:cote-a={cote_a}
	class:cote-b={!cote_a}
	class:grand
	class:choisie
	aria-pressed={choisie}
	aria-label="Parier sur {equipe.nom}, cote {formatCote(cote)}"
	disabled={desactivee}
	{onclick}
>
	<span class="contenu">
		{#if grand}
			<span class="chiffre">{formatCote(cote)}</span>
		{:else if cote_a}
			<span class="equipe"><Blason {equipe} taille={20} /><span class="nom">{equipe.nom}</span></span>
			<span class="chiffre">{formatCote(cote)}</span>
		{:else}
			<span class="chiffre">{formatCote(cote)}</span>
			<span class="equipe droite"><span class="nom">{equipe.nom}</span><Blason {equipe} taille={20} /></span>
		{/if}
	</span>
</button>

<style>
	.cote {
		--incl: 10deg;
		width: 100%;
		min-height: 52px;
		padding: 0 10px;
		border-radius: var(--r-cote);
		border: 1px solid #c6ff4d59;
		color: var(--texte-principal);
		transition: background 0.15s, box-shadow 0.15s;
	}
	.grand {
		--incl: 12deg;
		min-height: 50px;
	}
	.cote-a {
		transform: skewX(var(--incl));
		border-left: 3px solid var(--vert-cote);
		background: linear-gradient(90deg, #c6ff4d4d, #c6ff4d12);
	}
	.cote-b {
		transform: skewX(calc(var(--incl) * -1));
		border-right: 3px solid var(--vert-cote);
		background: linear-gradient(270deg, #c6ff4d4d, #c6ff4d12);
	}
	.cote:hover:not(:disabled):not(.choisie) {
		border-color: #c6ff4d99;
	}
	/* Choisie : même forme, en magenta dense, liseré épais et lueur */
	.cote.choisie {
		border: 1px solid #ff4fd8a6;
		color: #ffffff;
		box-shadow: var(--lueur-choix);
	}
	.cote-a.choisie {
		border-left: 4px solid var(--magenta-arene);
		background: linear-gradient(90deg, #ff4fd8b3, #ff4fd840);
	}
	.cote-b.choisie {
		border-right: 4px solid var(--magenta-arene);
		background: linear-gradient(270deg, #ff4fd8b3, #ff4fd840);
	}
	.cote:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* Le contenu est contre-incliné pour rester droit */
	.contenu {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.cote-a .contenu {
		transform: skewX(calc(var(--incl) * -1));
	}
	.cote-b .contenu {
		transform: skewX(var(--incl));
	}
	.grand .contenu {
		justify-content: center;
	}
	.chiffre {
		font-size: 17px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.grand .chiffre {
		font-size: 19px;
	}
	.equipe {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.nom {
		font-size: 12.5px;
		font-weight: 500;
		line-height: 1.15;
		text-align: left;
	}
	.droite .nom {
		text-align: right;
	}
</style>
