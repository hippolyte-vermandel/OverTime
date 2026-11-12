<script>
	import { cleJour, formatCote, formatHeure, formatNombre, nomJour } from '#lib/format.js';

	let { data } = $props();
	let onglet = $state(/** @type {'cours' | 'finis'} */ ('cours'));

	const enCours = $derived(data.paris.filter((p) => p.statut === 'en_attente'));
	const finis = $derived(data.paris.filter((p) => p.statut !== 'en_attente'));
	const liste = $derived(onglet === 'cours' ? enCours : finis);
	const b = $derived(data.bilan);

	const STATUT = { en_attente: ['En attente', 'attente'], gagne: ['Gagné', 'gagne'], perdu: ['Perdu', 'perdu'], rembourse: ['Remboursé', 'annule'] };
	// État d'une sélection : gagnée, perdue, annulée ou en attente
	const etat = (s) => (s.statut_marche === 'annule' ? 'annule' : s.gagnante === true ? 'gagne' : s.gagnante === false ? 'perdu' : 'attente');
	const choix = (s) =>
		s.type === 'score_exact' ? `Score ${s.libelle}`
		: s.type === 'map_jouee' ? `${s.marche.replace(' ?', '')} : ${s.libelle}`
		: s.type === 'top' ? (s.libelle === 'non' ? `${s.marche} : non` : s.marche)
		: s.libelle;
	const quand = (iso) => `${nomJour(cleJour(iso))}, ${formatHeure(iso)}`;
	const titre = (p) => (p.selections.length > 1 ? `Combiné de ${p.selections.length}` : `Simple, ${p.selections[0].competition}`);
	const icones = {
		gagne: 'M5 12.5l4.5 4.5L19 7.5',
		perdu: 'M6 6l12 12M18 6L6 18',
		annule: 'M5 12h14',
		attente: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'
	};
	const libelleEtat = { gagne: 'gagnée', perdu: 'perdue', annule: 'annulée', attente: 'en attente' };
	const bilanNet = $derived(b ? b.recupere - b.mise_reglee : 0);
	const signe = (n) => (n > 0 ? `+${formatNombre(n)}` : n < 0 ? `−${formatNombre(-n)}` : '0');
</script>

<svelte:head><title>Mes paris · OverTime</title></svelte:head>

<div class="page">
	<h1>Mes paris</h1>

	{#if b}
		<section class="carte" aria-labelledby="t-semaine">
			<div class="ligne-titre">
				<h2 id="t-semaine">Cette semaine</h2>
				<span class="meta">{b.regles} pari{b.regles > 1 ? 's' : ''} réglé{b.regles > 1 ? 's' : ''}, {b.gagnes} gagné{b.gagnes > 1 ? 's' : ''}</span>
			</div>
			<div class="tuiles">
				<div class="tuile"><span class="meta">Misé</span><span class="valeur">{formatNombre(b.mise)}</span></div>
				<div class="tuile"><span class="meta">Récupéré</span><span class="valeur">{formatNombre(b.recupere)}</span></div>
				<div class="tuile"><span class="meta">Bilan</span><span class="valeur">{signe(bilanNet)}</span></div>
			</div>
			{#if b.prochaine_recharge && b.recharge > 0}
				<span class="recharge">
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5" /></svg>
					Prochaine recharge de {b.recharge} noxus : {nomJour(cleJour(new Date(b.prochaine_recharge).toISOString()))}
				</span>
			{/if}
		</section>
	{/if}

	<div class="barre">
		<div class="segment" role="group" aria-label="Paris affichés">
			<button aria-pressed={onglet === 'cours'} onclick={() => (onglet = 'cours')}>En cours ({enCours.length})</button>
			<button aria-pressed={onglet === 'finis'} onclick={() => (onglet = 'finis')}>Terminés ({finis.length})</button>
		</div>
	</div>

	{#if liste.length === 0}
		<p class="vide">
			{#if onglet === 'cours'}Aucun pari en cours. Choisis une cote dans <a href="/">Matchs</a>.{:else}Aucun pari terminé cette saison.{/if}
		</p>
	{/if}

	{#each liste as p (p.id)}
		{@const [lib, cls] = STATUT[p.statut]}
		<article class="carte">
			<div class="ligne-titre">
				<h3>{titre(p)}</h3>
				<span class="statut {cls}">{lib}</span>
			</div>
			<ul class="selections">
				{#each p.selections as s, i (i)}
					{@const e = etat(s)}
					<li>
						<svg class="icone {e}" viewBox="0 0 24 24" role="img" aria-label="Sélection {libelleEtat[e]}"><path d={icones[e]} /></svg>
						<div class="texte">
							<span class="choix" class:barre-annule={e === 'annule'}>{choix(s)}</span>
							<span class="meta">{s.equipes?.join(' contre ') ?? s.competition}, {quand(s.date)}</span>
						</div>
						<span class="cote" class:barre-annule={e === 'annule'}>{formatCote(s.cote)}</span>
					</li>
				{/each}
			</ul>
			{#if p.gain_reduit}
				<p class="note">Un match a été annulé : le combiné a continué sans lui, et le gain a été divisé par deux.</p>
			{/if}
			<div class="pied">
				<span class="meta">Mise</span><span class="droite">{formatNombre(p.mise)} noxus</span>
				{#if p.selections.length > 1}<span class="meta">Cote</span><span class="droite">{formatCote(p.cote_totale)}</span>{/if}
				{#if p.statut === 'en_attente'}
					<span>Gain possible</span><span class="droite fort">{formatNombre(Math.floor(p.mise * p.cote_totale))} noxus</span>
				{:else if p.statut === 'gagne'}
					<span>Gagné</span><span class="droite fort">+{formatNombre(p.gain)} noxus</span>
				{:else if p.statut === 'perdu'}
					<span>Perdu</span><span class="droite fort">−{formatNombre(p.mise)} noxus</span>
				{:else}
					<span>Remboursé</span><span class="droite fort">{formatNombre(p.gain ?? p.mise)} noxus</span>
				{/if}
			</div>
		</article>
	{/each}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 8px 12px 24px;
	}
	h1 {
		margin: 4px 6px 0;
		font-size: 26px;
		font-weight: 700;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px;
		border-radius: 20px;
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	.ligne-titre {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}
	h2,
	h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}
	h3 {
		font-size: 15px;
	}
	.meta {
		font-size: 12px;
		color: var(--texte-discret);
	}
	.tuiles {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.tuile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px;
		border-radius: 12px;
		background: var(--surface-carte);
	}
	.valeur {
		font-size: 19px;
		font-weight: 700;
	}
	.recharge {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--texte-doux);
	}
	svg {
		width: 16px;
		height: 16px;
		flex: 0 0 auto;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.barre {
		position: sticky;
		top: 0;
		z-index: 5;
		padding: 6px 0;
		background: rgb(12 12 18 / 0.92);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}
	.segment {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
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
	.vide {
		margin: 0;
		padding: 24px 16px;
		border-radius: 20px;
		border: 1px dashed var(--surface-active);
		text-align: center;
		font-size: 14px;
		color: var(--texte-discret);
	}
	.statut {
		flex: 0 0 auto;
		padding: 3px 9px;
		border-radius: var(--r-pastille);
		font-size: 12px;
		font-weight: 600;
	}
	.statut.attente {
		border: 1px solid var(--bordure-forte);
		color: var(--texte-doux);
	}
	.statut.gagne {
		background: #c6ff4d24;
		color: var(--vert-cote);
	}
	.statut.perdu {
		background: #ff6b6b1f;
		color: var(--rouge-perte);
	}
	.statut.annule {
		background: var(--surface-active);
		color: var(--texte-discret);
	}
	.selections {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.selections li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.icone {
		width: 18px;
		height: 18px;
		stroke-width: 2.2;
	}
	.icone.gagne {
		color: var(--vert-cote);
	}
	.icone.perdu {
		color: var(--rouge-perte);
	}
	.icone.annule,
	.icone.attente {
		color: var(--texte-discret);
	}
	.texte {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.choix {
		font-size: 15px;
		font-weight: 600;
	}
	.cote {
		font-size: 16px;
		font-weight: 600;
	}
	.barre-annule {
		text-decoration: line-through;
		color: var(--texte-discret);
	}
	.note {
		margin: 0;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--surface-carte);
		font-size: 13px;
		line-height: 1.4;
		color: var(--texte-doux);
	}
	.pied {
		display: grid;
		grid-template-columns: 1fr auto;
		row-gap: 4px;
		padding-top: 10px;
		border-top: 1px solid var(--surface-active);
		font-size: 14px;
		color: var(--texte-doux);
	}
	.droite {
		text-align: right;
	}
	.fort {
		font-size: 17px;
		font-weight: 700;
		color: var(--texte-principal);
	}
</style>
