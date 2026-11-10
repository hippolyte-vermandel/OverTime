<script>
	import { SvelteMap } from 'svelte/reactivity';
	import CarteVedette from '#lib/matchs/CarteVedette.svelte';
	import CarteCompacte from '#lib/matchs/CarteCompacte.svelte';
	import PictoJeu from '#lib/matchs/PictoJeu.svelte';
	import Calendrier from '#lib/matchs/Calendrier.svelte';
	import Coupon from '#lib/matchs/Coupon.svelte';
	import FiltreJeux from '#lib/matchs/FiltreJeux.svelte';
	import { cleJour, titreJour } from '#lib/format.js';

	let { data } = $props();

	// L'heure courante, rafraîchie chaque minute (comptes à rebours de fermeture)
	let maintenant = $state(new Date());
	$effect(() => {
		const t = setInterval(() => (maintenant = new Date()), 30_000);
		return () => clearInterval(t);
	});
	const aujourdhui = $derived(cleJour(maintenant.toISOString()));

	let vue = $state(/** @type {'liste' | 'semaine' | 'mois'} */ ('liste'));
	let jour = $state(cleJour(new Date().toISOString()));
	let jeuxChoisis = $state(/** @type {string[]} */ ([]));
	let filtreOuvert = $state(false);

	// Une seule sélection par match : matchId -> { match, issue }
	const selection = new SvelteMap();

	const jeux = $derived.by(() => {
		const vus = new Map();
		for (const m of data.matchs) if (!vus.has(m.jeu)) vus.set(m.jeu, m.jeu_nom);
		return [...vus].map(([code, nom]) => ({ code, nom }));
	});
	const visibles = $derived(data.matchs.filter((m) => jeuxChoisis.length === 0 || jeuxChoisis.includes(m.jeu)));
	const parJour = $derived.by(() => {
		const g = new Map();
		for (const m of visibles) {
			const c = cleJour(m.date_prevue);
			if (!g.has(c)) g.set(c, []);
			g.get(c).push(m);
		}
		return g;
	});

	// Une journée : la carte vedette (prochain duel pas encore commencé) puis les groupes par compétition
	function journee(cle) {
		const liste = parJour.get(cle) ?? [];
		const vedette = liste.find((m) => new Date(m.date_prevue) > maintenant && m.equipes.length === 2) ?? null;
		const groupes = [];
		for (const m of liste) {
			if (m === vedette) continue;
			let g = groupes.find((x) => x.competition === m.competition && x.phase === m.phase);
			if (!g) groupes.push((g = { competition: m.competition, phase: m.phase, jeu: m.jeu, matchs: [] }));
			g.matchs.push(m);
		}
		return { cle, titre: titreJour(cle, maintenant), vedette, groupes, vide: liste.length === 0 };
	}
	const journees = $derived(vue === 'liste' ? [...parJour.keys()].sort().map(journee) : [journee(jour)]);

	function choisir(match, issue) {
		if (data.paries?.[match.id]) return; // déjà parié : un seul pari par match
		if (selection.get(match.id)?.issue.id === issue.id) selection.delete(match.id);
		else selection.set(match.id, { match, issue });
	}
	const lignes = $derived(
		[...selection.values()].map(({ match, issue }) => {
			const autre = match.equipes.find((e) => e.issue?.id !== issue.id);
			return { match, issue, choix: issue.libelle, contexte: `contre ${autre?.nom ?? ''}, ${match.competition}` };
		})
	);

	const vues = [
		{ cle: 'liste', nom: 'Liste' },
		{ cle: 'semaine', nom: 'Semaine' },
		{ cle: 'mois', nom: 'Mois' }
	];
	const basculerJeu = (code) => (jeuxChoisis = jeuxChoisis.includes(code) ? jeuxChoisis.filter((c) => c !== code) : [...jeuxChoisis, code]);
</script>

<svelte:head>
	<title>Matchs · OverTime</title>
</svelte:head>

<h1 class="visuellement-cache">Matchs</h1>

<div class="barre-vues">
	<div class="segment" role="group" aria-label="Affichage des matchs">
		{#each vues as v (v.cle)}
			<button aria-pressed={vue === v.cle} onclick={() => (vue = v.cle)}>{v.nom}</button>
		{/each}
	</div>
	<button
		class="filtre"
		class:actif={jeuxChoisis.length > 0}
		aria-label={jeuxChoisis.length ? `Filtrer par jeu, ${jeuxChoisis.length} jeu${jeuxChoisis.length > 1 ? 'x' : ''} choisi${jeuxChoisis.length > 1 ? 's' : ''}` : 'Filtrer par jeu'}
		onclick={() => (filtreOuvert = true)}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
		{#if jeuxChoisis.length}<span class="badge" aria-hidden="true">{jeuxChoisis.length}</span>{/if}
	</button>
</div>

{#if vue !== 'liste'}
	<Calendrier
		{vue}
		{jour}
		{aujourdhui}
		jeuxDuJour={(c) => [...new Set((parJour.get(c) ?? []).map((m) => m.jeu))]}
		nbDuJour={(c) => (parJour.get(c) ?? []).length}
		onchoisir={(c) => (jour = c)}
	/>
{/if}

<div class="contenu" class:avec-coupon={lignes.length > 0}>
	{#if data.erreur}
		<p class="message erreur" role="alert">{data.erreur}</p>
	{:else if vue === 'liste' && journees.length === 0}
		<p class="message">{jeuxChoisis.length ? 'Aucun match pour les jeux choisis.' : "Aucun match programmé pour l'instant. L'administrateur de la ligue peut en ajouter."}</p>
	{/if}

	{#each journees as j (j.cle)}
		<section aria-labelledby="jour-{j.cle}">
			<h2 id="jour-{j.cle}">{j.titre}</h2>
			{#if j.vide}
				<p class="message">Pas de match ce jour-là. Choisis un jour marqué d’un point.</p>
			{/if}
			{#if j.vedette}
				<CarteVedette match={j.vedette} choix={selection.get(j.vedette.id)?.issue.id ?? null} pariees={data.paries?.[j.vedette.id] ?? null} {maintenant} onchoisir={choisir} />
			{/if}
			<div class="groupes">
				{#each j.groupes as g (g.competition + g.phase)}
					<section class="groupe">
						<div class="tete-groupe">
							<PictoJeu jeu={g.jeu} taille={28} />
							<h3>{g.competition}{#if g.phase}<span>, {g.phase}</span>{/if}</h3>
						</div>
						{#each g.matchs as m (m.id)}
							<CarteCompacte match={m} choix={selection.get(m.id)?.issue.id ?? null} pariees={data.paries?.[m.id] ?? null} {maintenant} onchoisir={choisir} />
						{/each}
					</section>
				{/each}
			</div>
		</section>
	{/each}
</div>

{#if data.joueur?.ligue}
	<Coupon
		{lignes}
		{maintenant}
		solde={data.joueur.solde}
		miseMin={data.joueur.ligue.mise_min}
		miseMax={data.joueur.ligue.mise_max}
		onretirer={(id) => selection.delete(id)}
		onvider={() => selection.clear()}
	/>
{/if}

{#if filtreOuvert}
	<FiltreJeux
		{jeux}
		choisis={jeuxChoisis}
		nbVisibles={visibles.length}
		onbasculer={basculerJeu}
		ontous={() => (jeuxChoisis = [])}
		onfermer={() => (filtreOuvert = false)}
	/>
{/if}

<style>
	/* La barre des vues reste en haut pendant le défilement */
	.barre-vues {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px 10px;
		background: rgb(12 12 18 / 0.92);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}
	.segment {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		padding: 3px;
		border-radius: var(--r-controle);
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	.segment button {
		min-height: 40px;
		border: none;
		border-radius: 11px;
		background: transparent;
		color: var(--texte-discret);
		font-size: 14px;
		font-weight: 600;
	}
	.segment button[aria-pressed='true'] {
		background: var(--surface-active);
		color: var(--texte-principal);
	}
	.filtre {
		position: relative;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: var(--r-controle);
		border: 1px solid var(--surface-active);
		background: var(--surface-gradin);
	}
	.filtre.actif {
		border-color: var(--texte-principal);
	}
	.filtre svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.badge {
		position: absolute;
		top: -6px;
		right: -6px;
		display: grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 10px;
		background: var(--texte-principal);
		color: var(--nuit-arene);
		font-size: 13px;
		font-weight: 800;
	}

	.contenu {
		padding: 0 10px 24px;
	}
	/* Le dernier match ne passe jamais sous le coupon */
	.contenu.avec-coupon {
		padding-bottom: 104px;
	}
	h2 {
		margin: 16px 6px 10px;
		font-size: 18px;
		font-weight: 600;
	}
	.groupes {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.groupe {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px;
		border-radius: var(--r-section);
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	.tete-groupe {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px 4px;
	}
	h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.2;
	}
	h3 span {
		font-weight: 400;
		color: var(--texte-discret);
	}
	.message {
		margin: 0 0 12px;
		padding: 24px 16px;
		border-radius: 20px;
		border: 1px dashed var(--surface-active);
		text-align: center;
		font-size: 14px;
		color: var(--texte-discret);
	}
	.erreur {
		color: var(--rouge-perte);
		border-color: color-mix(in srgb, var(--rouge-perte) 40%, transparent);
	}
</style>
