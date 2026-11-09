<script>
	// Vue Semaine (bandeau de 7 jours) ou Mois (grille). Le jour choisi est en magenta, rien d'autre.
	import { decalerJour, indiceSemaine, lundiDe, jourCourt, nomJour, nomMois } from '#lib/format.js';

	/** @type {{ vue: 'semaine' | 'mois', jour: string, aujourdhui: string, jeuxDuJour: (cle: string) => string[], nbDuJour: (cle: string) => number, onchoisir: (cle: string) => void }} */
	let { vue, jour, aujourdhui, jeuxDuJour, nbDuJour, onchoisir } = $props();

	// Semaine affichée (lundi) et mois affiché (1er du mois), réglables avec les flèches
	let lundi = $state(lundiDe(jour));
	let premier = $state(jour.slice(0, 8) + '01');

	const semaine = $derived([0, 1, 2, 3, 4, 5, 6].map((i) => decalerJour(lundi, i)));
	const libelleSemaine = $derived.by(() => {
		const fin = semaine[6];
		const d1 = Number(lundi.slice(8));
		const d2 = Number(fin.slice(8));
		const mois = (c) => new Date(c + 'T12:00:00Z').toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
		return lundi.slice(5, 7) === fin.slice(5, 7) ? `${d1} – ${d2} ${mois(fin)}` : `${d1} ${mois(lundi)} – ${d2} ${mois(fin)}`;
	});

	const cases = $derived.by(() => {
		const decalage = indiceSemaine(premier);
		const out = Array.from({ length: decalage }, () => null);
		let c = premier;
		while (c.slice(0, 7) === premier.slice(0, 7)) {
			out.push(c);
			c = decalerJour(c, 1);
		}
		return out;
	});
	const nbMois = $derived(cases.filter(Boolean).reduce((n, c) => n + nbDuJour(c), 0));

	function moisSuivant(sens) {
		const d = new Date(premier + 'T12:00:00Z');
		d.setUTCMonth(d.getUTCMonth() + sens);
		premier = d.toISOString().slice(0, 10);
	}
	const aria = (c) => `${nomJour(c)}${c === aujourdhui ? ", aujourd'hui" : ''}, ${nbDuJour(c)} match${nbDuJour(c) > 1 ? 's' : ''}`;
</script>

{#snippet points(c)}
	<span class="points" aria-hidden="true">
		{#each jeuxDuJour(c).slice(0, 3) as j (j)}<span class="point" style="background: var(--jeu-{j}, var(--texte-discret))"></span>{/each}
	</span>
{/snippet}

{#if vue === 'semaine'}
	<div class="semaine">
		<div class="nav">
			<button class="fleche" aria-label="Semaine précédente" onclick={() => (lundi = decalerJour(lundi, -7))}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
			</button>
			<span class="titre">{libelleSemaine}</span>
			<button class="fleche" aria-label="Semaine suivante" onclick={() => (lundi = decalerJour(lundi, 7))}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
			</button>
		</div>
		<div class="bandeau">
			{#each semaine as c (c)}
				<button class="jour" class:choisi={c === jour} class:auj={c === aujourdhui} class:vide={nbDuJour(c) === 0} aria-pressed={c === jour} aria-label={aria(c)} onclick={() => onchoisir(c)}>
					<span class="court">{jourCourt(c)}</span>
					<span class="num">{Number(c.slice(8))}</span>
					{@render points(c)}
				</button>
			{/each}
		</div>
	</div>
{:else}
	<div class="mois">
		<div class="nav">
			<button class="fleche" aria-label="Mois précédent" onclick={() => moisSuivant(-1)}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
			</button>
			<span class="titre">{nomMois(premier)} <span class="nb">{nbMois} match{nbMois > 1 ? 's' : ''}</span></span>
			<button class="fleche" aria-label="Mois suivant" onclick={() => moisSuivant(1)}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
			</button>
		</div>
		<div class="entetes" aria-hidden="true">
			{#each ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'] as j (j)}<span>{j}</span>{/each}
		</div>
		<div class="grille">
			{#each cases as c, i (c ?? 'vide-' + i)}
				{#if c}
					<button class="jour case" class:choisi={c === jour} class:auj={c === aujourdhui} class:vide={nbDuJour(c) === 0} aria-pressed={c === jour} aria-label={aria(c)} onclick={() => onchoisir(c)}>
						<span class="num">{Number(c.slice(8))}</span>
						{@render points(c)}
					</button>
				{:else}
					<span></span>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<style>
	.semaine,
	.mois {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 2px 16px 0;
	}
	.mois {
		padding: 12px;
		border-radius: var(--r-section);
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.titre {
		font-size: 18px;
		font-weight: 700;
	}
	.nb {
		margin-left: 6px;
		font-size: 13px;
		font-weight: 400;
		color: var(--texte-discret);
	}
	.fleche {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--r-bouton);
		border: 1px solid var(--surface-active);
		background: var(--surface-gradin);
	}
	.fleche svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.bandeau,
	.grille,
	.entetes {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 6px;
	}
	.grille {
		gap: 4px;
	}
	.entetes {
		font-size: 12px;
		font-weight: 500;
		color: var(--texte-discret);
		text-align: center;
	}
	.jour {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-height: 70px;
		padding: 8px 0;
		border-radius: var(--r-controle);
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
		color: var(--texte-principal);
	}
	.case {
		min-height: 48px;
		padding: 0;
		background: transparent;
		border-color: transparent;
	}
	.jour.vide {
		color: var(--texte-eteint);
	}
	.jour.auj {
		border-color: var(--texte-principal);
	}
	/* Jour choisi : même dégradé magenta, liseré et lueur que la cote choisie */
	.jour.choisi {
		background: linear-gradient(180deg, #ff4fd8b3, #ff4fd840);
		border: 2px solid var(--magenta-arene);
		box-shadow: var(--lueur-choix);
		color: #ffffff;
	}
	.court {
		font-size: 11px;
		font-weight: 500;
		opacity: 0.85;
	}
	.num {
		font-size: 22px;
		font-weight: 700;
		line-height: 1;
	}
	.case .num {
		font-size: 17px;
	}
	.points {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 6px;
	}
	.point {
		display: block;
		flex: 0 0 auto;
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.case .point {
		width: 5px;
		height: 5px;
	}
</style>
