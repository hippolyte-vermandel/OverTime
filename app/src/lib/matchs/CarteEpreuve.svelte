<script>
	// Carte d'une épreuve en lobby : les participants, du plus au moins favori, avec la cote
	// du « oui » pour chaque seuil (top 10, top 3, vainqueur). Un seul pari par participant :
	// une fois parié, sa cote prise reste en magenta et ses autres cotes ne gardent que le chiffre.
	import { formatHeure, fermeture, formatCote } from '#lib/format.js';

	/** @type {{ epreuve: any, choix: number | null, pariees?: number[] | null, maintenant: Date, onchoisir: (epreuve: any, issue: any, participant: any, x: number) => void }} */
	let { epreuve, choix, pariees = null, maintenant, onchoisir } = $props();

	const VISIBLES = 8;
	let tout = $state(false);
	const liste = $derived(tout ? epreuve.participants : epreuve.participants.slice(0, VISIBLES));
	const ferme = $derived(fermeture(epreuve.date_prevue, maintenant));
	const nomSeuil = (x) => (x === 1 ? 'Vainqueur' : `Top ${x}`);

	// Participant déjà parié : une de ses issues (oui ou non, tout seuil) figure dans mes paris
	const parie = (p) => !!pariees && p.top.some((t) => t.issues?.some((id) => pariees.includes(id)));
	const pris = (t) => !!pariees && t.issues?.some((id) => pariees.includes(id));
</script>

<article class="carte" aria-label="{epreuve.competition}, {epreuve.participants.length} participants">
	<div class="ligne">
		<time datetime={epreuve.date_prevue}>{formatHeure(epreuve.date_prevue)}</time>
		<span class="meta">{epreuve.participants.length} participants</span>
		{#if ferme}<span class="ferme" class:bientot={ferme.bientot}>{ferme.texte}</span>{/if}
	</div>

	<table>
		<thead>
			<tr>
				<th scope="col" class="qui">Participant</th>
				{#each epreuve.seuils as x (x)}<th scope="col">{nomSeuil(x)}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each liste as p (p.id)}
				{@const verrou = parie(p)}
				<tr>
					<th scope="row" class="qui">{p.libelle}</th>
					{#each p.top as t (t.x)}
						<td>
							{#if t.issue}
								<button
									class="puce"
									class:choisie={choix === t.issue.id}
									class:pariee={pris(t)}
									class:effacee={verrou && !pris(t)}
									disabled={!t.ouvert || verrou}
									aria-pressed={verrou ? undefined : choix === t.issue.id}
									aria-label={pris(t) ? `Ton pari : ${p.libelle}, ${nomSeuil(t.x).toLowerCase()}, cote ${formatCote(t.issue.cote)}` : `${p.libelle} ${nomSeuil(t.x).toLowerCase()}, cote ${formatCote(t.issue.cote)}`}
									onclick={() => onchoisir(epreuve, t.issue, p, t.x)}
								>{formatCote(t.issue.cote)}</button>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	{#if epreuve.participants.length > VISIBLES}
		<button class="voir" onclick={() => (tout = !tout)} aria-expanded={tout}>
			{tout ? 'Réduire' : `Voir les ${epreuve.participants.length} participants`}
		</button>
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
	.meta {
		font-size: 12px;
		color: var(--texte-discret);
	}
	.ferme {
		margin-left: auto;
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
	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0 6px;
		table-layout: fixed;
	}
	thead th {
		font-size: 12px;
		font-weight: 500;
		color: var(--texte-discret);
		text-align: center;
	}
	th.qui {
		width: 42%;
		text-align: left;
		font-size: 14px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding-right: 6px;
	}
	thead th.qui {
		font-size: 12px;
		font-weight: 500;
	}
	td {
		padding: 0 3px;
	}
	/* Même langage que les cotes des matchs : vert quand libre, magenta quand choisie */
	.puce {
		width: 100%;
		min-height: 44px;
		border-radius: var(--r-cote);
		border: 1px solid #c6ff4d59;
		background: linear-gradient(180deg, #c6ff4d33, #c6ff4d0d);
		color: var(--texte-principal);
		font: inherit;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		transition: background 0.15s, box-shadow 0.15s;
	}
	.puce:hover:not(:disabled):not(.choisie) {
		border-color: #c6ff4d99;
	}
	.puce.choisie {
		border-color: #ff4fd8a6;
		background: linear-gradient(180deg, #ff4fd8b3, #ff4fd840);
		color: #ffffff;
		box-shadow: var(--lueur-choix);
	}
	.puce.pariee {
		border-color: #ff4fd8a6;
		background: linear-gradient(180deg, #ff4fd8d9, #ff4fd859);
		color: #ffffff;
		font-weight: 800;
		box-shadow: 0 0 22px #ff4fd88c;
	}
	.puce.effacee {
		border-color: transparent;
		background: none;
		color: var(--texte-discret);
	}
	.puce:disabled {
		cursor: default;
	}
	.puce:disabled:not(.pariee):not(.effacee) {
		opacity: 0.45;
	}
	.voir {
		min-height: 44px;
		border: 0;
		background: none;
		color: var(--texte-doux);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
</style>
