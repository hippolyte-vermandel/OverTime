<script>
	// La grande carte du jour : le prochain duel à commencer, avec le face-à-face en miroir.
	import Cote from './Cote.svelte';
	import Blason from './Blason.svelte';
	import PictoJeu from './PictoJeu.svelte';
	import { formatHeure, fermeture } from '#lib/format.js';

	/** @type {{ match: any, choix: number | null, pariees?: number[] | null, maintenant: Date, onchoisir: (match: any, issue: any) => void }} */
	let { match, choix, pariees = null, maintenant, onchoisir } = $props();
	// Déjà parié sur ce match : ses cotes sont figées (un seul pari par match)
	const pariee = (issue) => !!pariees?.includes(issue.id);
	const effacee = (issue) => !!pariees && !pariees.includes(issue.id);

	const [a, b] = $derived(match.equipes);
	const ferme = $derived(fermeture(match.date_prevue, maintenant));
	const autres = $derived(Math.max(0, match.nb_marches - 1));
</script>

<article class="vedette" aria-label="Prochain match : {a.nom} contre {b.nom}">
	<div class="tete">
		<PictoJeu jeu={match.jeu} />
		<div class="compet">
			<span class="nom-compet">{match.competition}</span>
			<span class="phase">{[match.phase, match.best_of ? `BO${match.best_of}` : null].filter(Boolean).join(', ')}</span>
		</div>
		<div class="heure">
			<time datetime={match.date_prevue}>{formatHeure(match.date_prevue)}</time>
			{#if ferme}<span class="ferme" class:bientot={ferme.bientot}>{ferme.texte}</span>{/if}
		</div>
	</div>

	<div class="equipes">
		{#each [a, b] as e (e.nom)}
			<div class="equipe"><Blason equipe={e} taille={46} /><span>{e.nom}</span></div>
		{/each}
	</div>

	{#if a.issue && b.issue}
		<div class="duel">
			<Cote grand equipe={a} cote={a.issue.cote} cote_a choisie={choix === a.issue.id} pariee={pariee(a.issue)} effacee={effacee(a.issue)} desactivee={!match.marche_ouvert} onclick={() => onchoisir(match, a.issue)} />
			<span class="vs" aria-hidden="true">VS</span>
			<Cote grand equipe={b} cote={b.issue.cote} cote_a={false} choisie={choix === b.issue.id} pariee={pariee(b.issue)} effacee={effacee(b.issue)} desactivee={!match.marche_ouvert} onclick={() => onchoisir(match, b.issue)} />
		</div>
	{/if}

	<div class="pied">
		<!-- Les paris des amis s'afficheront ici quand les comptes seront en place -->
		<span class="amis">Aucun ami n’a encore parié sur ce match.</span>
		{#if autres > 0}
			<a class="plus" href="/match/{match.id}">+{autres} pari{autres > 1 ? 's' : ''} ›</a>
		{/if}
	</div>
</article>

<style>
	.vedette {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 14px;
		padding: 14px;
		border-radius: var(--r-section);
		background: linear-gradient(180deg, #211f2a, var(--surface-carte));
		border: 1px solid #2e2b38;
	}
	.tete {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.compet {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.nom-compet {
		font-size: 15px;
		font-weight: 600;
		line-height: 1.2;
	}
	.phase {
		font-size: 12px;
		color: var(--texte-discret);
	}
	.heure {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}
	time {
		font-size: 17px;
		font-weight: 600;
		line-height: 1.1;
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
	.equipes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.equipe {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		text-align: center;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.2;
	}
	.duel {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 58px minmax(0, 1fr);
		align-items: center;
	}
	.vs {
		text-align: center;
		font-size: 26px;
		font-weight: 700;
		font-style: italic;
		letter-spacing: -0.03em;
		color: var(--texte-doux);
		line-height: 1;
	}
	.pied {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--surface-active);
	}
	.amis {
		flex: 1;
		font-size: 13px;
		line-height: 1.3;
		color: var(--texte-doux);
	}
	.plus {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 4px 0 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--texte-principal);
		text-decoration: none;
		white-space: nowrap;
	}
</style>
