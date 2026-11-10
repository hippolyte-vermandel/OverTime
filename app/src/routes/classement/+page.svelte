<script>
	import { formatNombre } from '#lib/format.js';

	let { data } = $props();
	// Bilan signé : +244, −60, 0
	const signe = (n) => (n > 0 ? `+${formatNombre(n)}` : n < 0 ? `−${formatNombre(-n)}` : '0');
	const places = (n) => `${n} place${n > 1 ? 's' : ''}`;
	const semaine = $derived(data.periode === 'semaine');
</script>

<svelte:head><title>Classement · OverTime</title></svelte:head>

<div class="page">
	{#if data.vide}
		<h1>Classement</h1>
		<p class="vide">Rejoins une ligue pour voir son classement.</p>
	{:else}
		<div class="tete">
			<h1>Classement</h1>
			<span class="meta">
				{data.joueur.ligue.nom}, {data.saison.membres} membre{data.saison.membres > 1 ? 's' : ''}. Saison {data.saison.nom}, fin dans {data.saison.jours_restants} jour{data.saison.jours_restants > 1 ? 's' : ''}.
			</span>
		</div>

		<nav class="segment" aria-label="Période du classement">
			<a href="/classement" aria-current={!semaine ? 'page' : undefined} data-sveltekit-noscroll>Saison</a>
			<a href="/classement?periode=semaine" aria-current={semaine ? 'page' : undefined} data-sveltekit-noscroll>Cette semaine</a>
		</nav>

		<p class="explication">
			Bilan : noxus récupérés moins noxus misés, sur les paris réglés. Au-dessus de zéro, tu as gagné plus que tu n’as misé.
			{semaine ? 'Paris réglés depuis lundi.' : `Il faut ${data.seuil} paris réglés dans la saison pour être classé.`}
		</p>

		{#if data.rival}
			<section class="rival" aria-label="Ton rival">
				<span class="avatar grand" aria-hidden="true">{data.rival.pseudo.charAt(0).toUpperCase()}</span>
				<div class="texte">
					<span class="fort">{data.rival.pseudo} est juste devant toi</span>
					<span class="doux">
						{formatNombre(data.rival.ecart)} noxus d’écart{semaine ? ' cette semaine' : ''}.
						{#if data.rival.dernier}Son dernier pari : {data.rival.dernier.libelle} ({data.rival.dernier.competition}).{/if}
					</span>
				</div>
			</section>
		{/if}

		{#if data.classes.length === 0}
			<p class="vide">{semaine ? 'Aucun pari réglé depuis lundi.' : `Personne n’est encore classé : il faut ${data.seuil} paris réglés.`}</p>
		{:else}
			<ol class="liste">
				{#each data.classes as l, i (l.id)}
					<li class:moi={l.id === data.moi} aria-current={l.id === data.moi ? 'true' : undefined}>
						<span class="rang" class:podium={i < 3}>{i + 1}</span>
						<span class="avatar" aria-hidden="true">{l.pseudo.charAt(0).toUpperCase()}</span>
						<div class="texte">
							<span class="fort">{l.pseudo}{l.id === data.moi ? ', toi' : ''}</span>
							<span class="meta">{formatNombre(l.recupere)} récupérés pour {formatNombre(l.mise)} misés, {l.regles} pari{l.regles > 1 ? 's' : ''}</span>
						</div>
						<div class="droite">
							<span class="bilan" class:negatif={l.bilan < 0}>{signe(l.bilan)}</span>
							{#if l.evolution > 0}<span class="evo monte" aria-label="gagne {places(l.evolution)} depuis hier">▲ {l.evolution}</span>
							{:else if l.evolution < 0}<span class="evo descend" aria-label="perd {places(-l.evolution)} depuis hier">▼ {-l.evolution}</span>{/if}
						</div>
					</li>
				{/each}
			</ol>
		{/if}

		{#if data.nonClasses.length}
			<section class="carte" aria-labelledby="t-nc">
				<h2 id="t-nc">Pas encore classés</h2>
				<ul class="nc">
					{#each data.nonClasses as l (l.id)}
						<li class:moi-texte={l.id === data.moi}>
							<span>{l.pseudo}{l.id === data.moi ? ', toi' : ''}</span>
							<span class="meta">{l.regles} / {data.seuil} pari{data.seuil > 1 ? 's' : ''} réglé{data.seuil > 1 ? 's' : ''}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 8px 12px 24px;
	}
	.tete {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 4px 6px 0;
	}
	h1 {
		margin: 0;
		font-size: 26px;
		font-weight: 700;
	}
	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}
	.meta {
		font-size: 12px;
		color: var(--texte-discret);
	}
	.tete .meta {
		font-size: 13px;
	}
	.segment {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding: 3px;
		border-radius: var(--r-controle);
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	.segment a {
		display: grid;
		place-items: center;
		min-height: 40px;
		border-radius: 11px;
		color: var(--texte-discret);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}
	.segment a[aria-current='page'] {
		background: var(--surface-active);
		color: var(--texte-principal);
	}
	.explication {
		margin: 0 6px;
		font-size: 13px;
		line-height: 1.4;
		color: var(--texte-discret);
	}
	.rival {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 18px;
		background: linear-gradient(90deg, #ffb5471f, var(--surface-gradin) 70%);
		border: 1px solid var(--surface-active);
	}
	.liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.liste li {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 6px 14px 6px 10px;
		border-radius: var(--r-carte);
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	.liste li.moi {
		background: var(--surface-active);
		border-color: var(--texte-principal);
	}
	.rang {
		width: 30px;
		text-align: center;
		font-size: 17px;
		font-weight: 800;
		font-style: italic;
		color: var(--texte-discret);
	}
	.rang.podium {
		font-size: 22px;
		color: var(--texte-principal);
	}
	.avatar {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--surface-active);
		font-size: 13px;
		font-weight: 700;
	}
	.moi .avatar {
		background: var(--texte-principal);
		color: var(--nuit-arene);
	}
	.avatar.grand {
		width: 40px;
		height: 40px;
		font-size: 16px;
		background: var(--ambre-fermeture);
		color: var(--nuit-arene);
	}
	.texte {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.fort {
		font-size: 15px;
		font-weight: 600;
	}
	.doux {
		font-size: 13px;
		color: var(--texte-doux);
	}
	.droite {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
	.evo {
		font-size: 12px;
		font-weight: 600;
	}
	.evo.monte {
		color: var(--vert-cote);
	}
	.evo.descend {
		color: var(--rouge-perte);
	}
	.bilan.negatif {
		color: var(--texte-doux);
	}
	.bilan {
		font-size: 17px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px;
		border-radius: 20px;
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	.nc {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.nc li {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
	}
	.moi-texte {
		font-weight: 600;
	}
	.vide {
		margin: 0;
		padding: 24px 16px;
		border-radius: 20px;
		border: 1px dashed var(--surface-active);
		text-align: center;
		font-size: 14px;
		color: var(--texte-discret);
	}
</style>
