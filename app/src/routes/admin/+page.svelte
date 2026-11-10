<script>
	import { enhance } from '$app/forms';
	import Blason from '#lib/matchs/Blason.svelte';
	import PictoJeu from '#lib/matchs/PictoJeu.svelte';
	import { cleJour, formatHeure, formatNombre, nomJour } from '#lib/format.js';

	let { data, form } = $props();

	let onglet = $state(/** @type {'match' | 'resultats' | 'membres'} */ ('match'));
	const onglets = $derived([
		{ cle: 'match', nom: 'Ajouter' },
		{ cle: 'resultats', nom: `Résultats${data.resultats.length ? ` (${data.resultats.length})` : ''}` },
		{ cle: 'membres', nom: 'Membres' }
	]);

	// Saisie d'un match
	const v = $derived(form?.action === 'creer' && form?.valeurs ? form.valeurs : {});
	let jeu = $state('');
	$effect(() => {
		if (!jeu) jeu = v.jeu ?? (data.jeux.find((j) => j.code === 'lol') ?? data.jeux[0])?.code ?? '';
	});
	const competitionsDuJeu = $derived(data.competitions.filter((c) => c.jeu === jeu));
	const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

	// Confirmation en deux temps des actions sans retour (régler, annuler, réinitialiser)
	let aConfirmer = $state(/** @type {string | null} */ (null));
	let envoi = $state(false);
	const soumettre = () => {
		envoi = true;
		return async ({ update }) => {
			await update({ reset: false });
			envoi = false;
			aConfirmer = null;
		};
	};
	const lien = $derived(data.code ? `${typeof location !== 'undefined' ? location.origin : ''}/inscription?code=${data.code}` : '');
	let copie = $state(false);
	async function copier() {
		try {
			await navigator.clipboard.writeText(lien);
			copie = true;
			setTimeout(() => (copie = false), 2000);
		} catch {
			copie = false;
		}
	}
</script>

<svelte:head><title>Administration · OverTime</title></svelte:head>

<div class="admin">
	<div class="tete">
		<h1>Administration</h1>
		<p>Ligue {data.joueur.ligue.nom}</p>
	</div>

	<div class="segment" role="group" aria-label="Rubriques d’administration">
		{#each onglets as o (o.cle)}
			<button aria-pressed={onglet === o.cle} onclick={() => (onglet = o.cle)}>{o.nom}</button>
		{/each}
	</div>

	{#if form?.erreur}<p class="erreur" role="alert">{form.erreur}</p>{/if}
	{#if form?.succes}<p class="succes" role="status">{form.succes}</p>{/if}

	{#if onglet === 'match'}
		<section class="carte" aria-labelledby="t-match">
			<h2 id="t-match">Ajouter un match</h2>
			<p class="aide">Les paris ouvrent tout de suite et ferment à l’heure du match. Une équipe ou une compétition inconnue est créée automatiquement.</p>
			<form method="POST" action="?/creer" use:enhance={soumettre}>
				<label class="champ">Jeu
					<select name="jeu" bind:value={jeu}>
						{#each data.jeux as j (j.code)}<option value={j.code}>{j.nom}</option>{/each}
					</select>
				</label>
				<div class="deux">
					<label class="champ">Compétition
						<input type="text" name="competition" list="liste-competitions" value={v.competition ?? ''} required placeholder="Worlds 2026" />
					</label>
					<label class="champ">Région
						<input type="text" name="region" value={v.region ?? ''} placeholder="International" />
					</label>
				</div>
				<datalist id="liste-competitions">{#each competitionsDuJeu as c (c.id)}<option value={c.nom}></option>{/each}</datalist>
				<label class="champ">Phase <span class="facultatif">facultatif</span>
					<input type="text" name="phase" value={v.phase ?? ''} placeholder="Quart de finale" />
				</label>
				<label class="champ">Date<input type="date" name="date" value={v.date ?? demain} required /></label>
				<div class="trois">
					<label class="champ">Heure<input type="time" name="heure" value={v.heure ?? '20:00'} required /></label>
					<label class="champ">Format
						<select name="best_of">
							{#each [1, 3, 5, 7] as bo (bo)}<option value={bo} selected={String(bo) === String(v.best_of ?? 3)}>BO{bo}</option>{/each}
						</select>
					</label>
				</div>
				<datalist id="liste-equipes">{#each data.equipes as e (e.nom)}<option value={e.nom}></option>{/each}</datalist>
				<div class="duel">
					<label class="champ">Équipe A<input type="text" name="equipe_a" list="liste-equipes" value={v.equipe_a ?? ''} required /></label>
					<label class="champ">Cote A<input type="text" name="cote_a" inputmode="decimal" value={v.cote_a ?? '1,90'} required /></label>
					<label class="champ">Équipe B<input type="text" name="equipe_b" list="liste-equipes" value={v.equipe_b ?? ''} required /></label>
					<label class="champ">Cote B<input type="text" name="cote_b" inputmode="decimal" value={v.cote_b ?? '1,90'} required /></label>
				</div>
				<p class="aide">À cotes égales (1,90 et 1,90), les deux équipes ont autant de chances. Plus la cote est basse, plus l’équipe est favorite.</p>
				<button type="submit" class="principal" disabled={envoi}>{envoi ? 'Ajout…' : 'Ajouter le match'}</button>
			</form>
		</section>
	{:else if onglet === 'resultats'}
		<section aria-labelledby="t-resultats" class="liste">
			<h2 id="t-resultats" class="visuellement-cache">Résultats à valider</h2>
			{#if data.resultats.length === 0}
				<p class="vide">Aucun résultat à valider. Les matchs apparaissent ici dès leur coup d’envoi.</p>
			{/if}
			{#each data.resultats as r (r.id)}
				<article class="carte resultat">
					<div class="ligne-tete">
						<PictoJeu jeu={r.jeu} taille={28} />
						<div class="compet">
							<span class="nom-compet">{r.competition}{r.phase ? `, ${r.phase}` : ''}</span>
							<span class="meta">{nomJour(cleJour(r.date_prevue))}, {formatHeure(r.date_prevue)}{r.best_of ? `, BO${r.best_of}` : ''} · {r.nb_paris} pari{r.nb_paris > 1 ? 's' : ''}</span>
						</div>
					</div>
					{#if aConfirmer?.startsWith(`${r.id}:`)}
						{@const [, quoi] = aConfirmer.split(':')}
						<form method="POST" action={quoi === 'annuler' ? '?/annuler' : '?/vainqueur'} use:enhance={soumettre} class="confirmation">
							<input type="hidden" name="serie" value={r.id} />
							{#if quoi !== 'annuler'}<input type="hidden" name="gagnant" value={r.equipes[Number(quoi)].nom} />{/if}
							<p>{quoi === 'annuler' ? 'Annuler ce match et rembourser les paris ?' : `Valider la victoire de ${r.equipes[Number(quoi)].nom} ? Les paris seront payés, sans retour possible.`}</p>
							<div class="boutons">
								<button type="button" class="discret" onclick={() => (aConfirmer = null)}>Retour</button>
								<button type="submit" class={quoi === 'annuler' ? 'danger' : 'principal'} disabled={envoi}>Confirmer</button>
							</div>
						</form>
					{:else}
						<p class="question">Qui a gagné ?</p>
						<div class="equipes">
							{#each r.equipes as e, i (e.nom)}
								<button class="equipe" onclick={() => (aConfirmer = `${r.id}:${i}`)}><Blason equipe={e} taille={28} /><span>{e.nom}</span></button>
							{/each}
						</div>
						<button class="lien-danger" onclick={() => (aConfirmer = `${r.id}:annuler`)}>Match annulé ou reporté de plus de 48 h</button>
					{/if}
				</article>
			{/each}
		</section>
	{:else}
		<section class="carte" aria-labelledby="t-invit">
			<h2 id="t-invit">Inviter des amis</h2>
			<div class="code"><span>{data.code}</span><button class="discret" onclick={copier}>{copie ? 'Lien copié' : 'Copier le lien'}</button></div>
			<p class="aide">Le lien ouvre l’inscription avec le code déjà rempli. Réservé aux personnes majeures.</p>
		</section>

		{#if form?.reinitialise}
			<section class="carte temporaire" role="status">
				<h2>Nouveau mot de passe de {form.reinitialise.pseudo}</h2>
				<p class="mdp">{form.reinitialise.temporaire}</p>
				<p class="aide">Donne-le-lui en main propre ou par message privé : il ne sera plus affiché. Ses anciennes sessions sont fermées.</p>
			</section>
		{/if}

		<section class="carte" aria-labelledby="t-membres">
			<h2 id="t-membres">Membres ({data.membres.length})</h2>
			<ul class="membres">
				{#each data.membres as m (m.id)}
					<li>
						<span class="avatar" aria-hidden="true">{m.pseudo.charAt(0).toUpperCase()}</span>
						<div class="qui">
							<span class="pseudo">{m.pseudo}{m.role === 'admin' ? ', administrateur' : ''}</span>
							<span class="meta">{formatNombre(m.solde)} noxus</span>
						</div>
						{#if m.a_un_compte}
							{#if aConfirmer === `mdp:${m.id}`}
								<form method="POST" action="?/motDePasse" use:enhance={soumettre} class="mdp-confirmer">
									<input type="hidden" name="utilisateur" value={m.id} />
									<button type="button" class="discret" onclick={() => (aConfirmer = null)}>Retour</button>
									<button type="submit" class="principal petit" disabled={envoi}>Confirmer</button>
								</form>
							{:else}
								<button class="discret" onclick={() => (aConfirmer = `mdp:${m.id}`)} aria-label="Réinitialiser le mot de passe de {m.pseudo}">Mot de passe</button>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.admin {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 8px 12px 24px;
	}
	.tete {
		margin: 4px 6px 0;
	}
	h1 {
		margin: 0;
		font-size: 26px;
		font-weight: 700;
	}
	.tete p {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--texte-discret);
	}
	.segment {
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
	.carte {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px;
		border-radius: 20px;
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
	}
	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}
	.aide,
	.meta {
		margin: 0;
		font-size: 12px;
		line-height: 1.4;
		color: var(--texte-discret);
	}
	.erreur,
	.succes {
		margin: 0;
		padding: 10px 12px;
		border-radius: var(--r-bouton);
		font-size: 14px;
	}
	.erreur {
		background: #ff94941a;
		color: var(--rouge-perte);
	}
	.succes {
		background: #8fe3c01a;
		color: var(--menthe-victoire);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.champ {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		font-size: 13px;
		font-weight: 500;
		color: var(--texte-doux);
	}
	.facultatif {
		font-weight: 400;
		color: var(--texte-discret);
	}
	input,
	select {
		width: 100%;
		min-height: 46px;
		padding: 0 12px;
		border-radius: var(--r-bouton);
		border: 1px solid var(--bordure-forte);
		background: var(--surface-carte);
		color: var(--texte-principal);
		font: inherit;
		font-size: 16px;
	}
	.deux {
		display: grid;
		grid-template-columns: 3fr 2fr;
		gap: 10px;
	}
	.trois {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.duel {
		display: grid;
		grid-template-columns: 1fr 88px;
		gap: 10px;
	}
	.principal,
	.danger,
	.discret {
		min-height: 48px;
		padding: 0 16px;
		border-radius: var(--r-controle);
		font-size: 15px;
		font-weight: 700;
	}
	.principal {
		border: none;
		background: var(--texte-principal);
		color: var(--nuit-arene);
	}
	.principal.petit {
		min-height: 44px;
	}
	.danger {
		border: none;
		background: var(--rouge-perte);
		color: var(--nuit-arene);
	}
	.discret {
		border: 1px solid var(--bordure-forte);
		background: transparent;
		color: var(--texte-principal);
		font-weight: 600;
	}
	.liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
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
	.ligne-tete {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.compet {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.nom-compet {
		font-size: 15px;
		font-weight: 600;
	}
	.question {
		margin: 0;
		font-size: 14px;
		color: var(--texte-doux);
	}
	.equipes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.equipe {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 56px;
		padding: 0 12px;
		border-radius: var(--r-controle);
		border: 1px solid var(--bordure-forte);
		background: var(--surface-carte);
		text-align: left;
		font-size: 14px;
		font-weight: 600;
	}
	.lien-danger {
		align-self: flex-start;
		min-height: 44px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--rouge-perte);
		font-size: 14px;
		font-weight: 600;
	}
	.confirmation p {
		margin: 0;
		font-size: 14px;
		line-height: 1.45;
		color: var(--texte-doux);
	}
	.boutons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.code {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.code span {
		flex: 1;
		padding: 12px 14px;
		border-radius: var(--r-bouton);
		background: var(--surface-carte);
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.temporaire {
		border-color: var(--ambre-fermeture);
	}
	.mdp {
		margin: 0;
		font-size: 26px;
		font-weight: 700;
		letter-spacing: 0.06em;
		user-select: all;
	}
	.membres {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.membres li {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
	}
	.avatar {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--surface-active);
		font-weight: 700;
	}
	.qui {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.pseudo {
		font-size: 15px;
		font-weight: 600;
	}
	.mdp-confirmer {
		flex-direction: row;
		gap: 6px;
	}
	.mdp-confirmer .discret {
		min-height: 44px;
		padding: 0 10px;
	}
</style>
