<script>
	import { formatCote, formatHeure } from '#lib/format.js';

	/** @type {{ match: any }} */
	let { match } = $props();

	const autres = $derived(Math.max(0, match.nb_marches - 1));
</script>

<article class="carte" style="--couleur-jeu: var(--jeu-{match.jeu})">
	<header>
		<span class="jeu">{match.jeu_nom}</span>
		<span class="competition">
			{match.competition}{#if match.categorie === 'feminine'}<span class="badge">GC</span>{/if}
		</span>
		<time datetime={match.date_prevue}>{formatHeure(match.date_prevue)}</time>
	</header>

	<div class="equipes">
		{#each match.equipes as e (e.nom)}
			<div class="equipe">
				<span class="sigle" aria-hidden="true">{e.sigle ?? e.nom.slice(0, 3)}</span>
				<span class="nom">{e.nom}</span>
				{#if e.issue}
					<button
						class="cote"
						disabled={!match.marche_ouvert}
						aria-label="Parier sur la victoire de {e.nom}, cote {formatCote(e.issue.cote)}"
					>
						{formatCote(e.issue.cote)}
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<footer>
		<span>{match.best_of ? `BO${match.best_of}` : ''}{match.phase ? ` · ${match.phase}` : ''}</span>
		{#if autres > 0}
			<span class="plus">+{autres} pari{autres > 1 ? 's' : ''}</span>
		{/if}
	</footer>
</article>

<style>
	.carte {
		position: relative;
		background: var(--surface);
		border: 1px solid var(--bord);
		border-radius: var(--rayon);
		padding: 12px 14px;
		overflow: hidden;
	}
	/* Liseré à la couleur du jeu */
	.carte::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 3px;
		background: var(--couleur-jeu, var(--accent));
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 0.75rem;
		color: var(--texte-2);
		margin-bottom: 10px;
	}
	.jeu {
		color: var(--couleur-jeu, var(--accent));
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.competition {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.badge {
		margin-left: 6px;
		padding: 1px 5px;
		border-radius: 4px;
		background: var(--surface-2);
		font-size: 0.65rem;
		font-weight: 700;
	}
	time {
		font-family: var(--chiffres);
		font-weight: 600;
		color: var(--texte);
	}

	.equipes {
		display: grid;
		gap: 8px;
	}
	.equipe {
		display: grid;
		grid-template-columns: 44px 1fr auto;
		align-items: center;
		gap: 10px;
	}
	.sigle {
		display: grid;
		place-items: center;
		height: 32px;
		border-radius: 8px;
		background: var(--surface-2);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}
	.nom {
		font-weight: 600;
	}
	.cote {
		min-width: 68px;
		min-height: 44px; /* taille de cible tactile recommandée */
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--cote) 35%, transparent);
		background: color-mix(in srgb, var(--cote) 12%, transparent);
		color: var(--cote);
		font-family: var(--chiffres);
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}
	.cote:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cote) 22%, transparent);
	}
	.cote:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	footer {
		display: flex;
		justify-content: space-between;
		margin-top: 10px;
		font-size: 0.75rem;
		color: var(--texte-2);
	}
	.plus {
		color: var(--accent-fort);
		font-weight: 600;
	}
</style>
