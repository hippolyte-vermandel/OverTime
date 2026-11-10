<script>
	// Carte compacte d'un duel (environ 105 px) : heure, BO, fermeture, puis les deux cotes autour du VS.
	import Cote from './Cote.svelte';
	import { formatHeure, fermeture } from '#lib/format.js';

	/** @type {{ match: any, choix: number | null, maintenant: Date, onchoisir: (match: any, issue: any) => void }} */
	let { match, choix, maintenant, onchoisir } = $props();

	const [a, b] = $derived(match.equipes);
	const ferme = $derived(fermeture(match.date_prevue, maintenant));
	const autres = $derived(Math.max(0, match.nb_marches - 1));
</script>

<article class="carte" aria-label="{a.nom} contre {b.nom}">
	<div class="ligne">
		<time datetime={match.date_prevue}>{formatHeure(match.date_prevue)}</time>
		{#if match.best_of}<span class="bo">BO{match.best_of}</span>{/if}
		{#if ferme}<span class="ferme" class:bientot={ferme.bientot}>{ferme.texte}</span>{/if}
		<span class="espace"></span>
		{#if autres > 0}
			<a class="plus" href="/match/{match.id}" aria-label="Voir {autres} autre{autres > 1 ? 's' : ''} pari{autres > 1 ? 's' : ''} sur {a.nom} contre {b.nom}">
				+{autres} pari{autres > 1 ? 's' : ''} ›
			</a>
		{/if}
	</div>
	{#if a.issue && b.issue}
		<div class="duel">
			<Cote equipe={a} cote={a.issue.cote} cote_a choisie={choix === a.issue.id} desactivee={!match.marche_ouvert} onclick={() => onchoisir(match, a.issue)} />
			<span class="vs" aria-hidden="true">VS</span>
			<Cote equipe={b} cote={b.issue.cote} cote_a={false} choisie={choix === b.issue.id} desactivee={!match.marche_ouvert} onclick={() => onchoisir(match, b.issue)} />
		</div>
	{:else}
		<p class="sans-cote">Cotes bientôt disponibles.</p>
	{/if}
</article>

<style>
	.carte {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 10px 10px;
		border-radius: var(--r-carte);
		background: var(--surface-carte);
	}
	.ligne {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 28px;
	}
	time {
		font-size: 15px;
		font-weight: 600;
	}
	.bo {
		font-size: 12px;
		color: var(--texte-discret);
	}
	.ferme {
		font-size: 12px;
		color: var(--texte-discret);
		white-space: nowrap;
	}
	.ferme.bientot {
		padding: 2px 8px;
		border-radius: var(--r-pastille);
		background: #ffb5471f;
		color: var(--ambre-fermeture);
		font-weight: 600;
	}
	.espace {
		flex: 1;
	}
	.plus {
		display: flex;
		align-items: center;
		min-height: 44px;
		margin: -8px -4px -8px 0;
		padding: 0 4px 0 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--texte-doux);
		text-decoration: none;
		white-space: nowrap;
	}
	.duel {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr);
		align-items: center;
	}
	.vs {
		text-align: center;
		font-size: 13px;
		font-weight: 700;
		font-style: italic;
		color: #8d8a9b;
	}
	.sans-cote {
		margin: 0;
		font-size: 13px;
		color: var(--texte-discret);
	}
</style>
