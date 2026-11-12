<script>
	import { enhance } from '$app/forms';
	import Blason from '#lib/matchs/Blason.svelte';
	import PictoJeu from '#lib/matchs/PictoJeu.svelte';
	import { cleJour, formatCote, formatHeure, formatNombre, nomJour } from '#lib/format.js';

	let { data, form } = $props();

	let onglet = $state(/** @type {'match' | 'resultats' | 'membres'} */ ('match'));
	const onglets = $derived([
		{ cle: 'match', nom: 'Ajouter' },
		{ cle: 'resultats', nom: `Résultats${data.resultats.length + data.epreuves.length ? ` (${data.resultats.length + data.epreuves.length})` : ''}` },
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

	// Champs suivis pour l'aperçu des cotes
	let equipeA = $state('');
	let equipeB = $state('');
	let date = $state(demain);
	let heure = $state('20:00');
	let bestOf = $state('3');
	let dejaJoue = $state(false);
	let competition = $state('');
	let region = $state('');
	let phase = $state('');
	$effect(() => {
		if (form?.action === 'creer' && form?.valeurs) {
			equipeA = form.valeurs.equipe_a ?? '';
			equipeB = form.valeurs.equipe_b ?? '';
			date = form.valeurs.date ?? demain;
			heure = form.valeurs.heure ?? '20:00';
			bestOf = form.valeurs.best_of ?? '3';
			dejaJoue = form.valeurs.deja_joue === 'on';
			competition = form.valeurs.competition ?? '';
			region = form.valeurs.region ?? '';
			phase = form.valeurs.phase ?? '';
		}
	});

	// Aperçu des cotes calculées par le moteur, mis à jour pendant la saisie
	let apercu = $state(/** @type {any} */ (null));
	let calcul = $state(false);
	$effect(() => {
		const params = new URLSearchParams({ jeu, a: equipeA, b: equipeB, bo: bestOf, date, heure });
		if (dejaJoue || !equipeA.trim() || !equipeB.trim()) {
			apercu = null;
			return;
		}
		calcul = true;
		const ctrl = new AbortController();
		const t = setTimeout(async () => {
			try {
				const r = await fetch(`/admin/cotes?${params}`, { signal: ctrl.signal });
				const j = await r.json();
				apercu = j.incomplet ? null : j;
			} catch {
				/* saisie en cours ou réseau coupé : on garde l'aperçu précédent */
			} finally {
				calcul = false;
			}
		}, 350);
		return () => {
			clearTimeout(t);
			ctrl.abort();
		};
	});
	const pct = (p) => `${Math.round(p * 100)} %`;
	const scoresPossibles = (bo) => {
		const g = Math.floor((bo ?? 1) / 2) + 1;
		return { a: Array.from({ length: g }, (_, i) => `${g}-${i}`), b: Array.from({ length: g }, (_, i) => `${i}-${g}`) };
	};

	// Confirmation en deux temps des actions sans retour (régler, annuler, réinitialiser)
	let aConfirmer = $state(/** @type {string | null} */ (null));
	let envoi = $state(false);

	// Saisie d'une épreuve en lobby
	const ve = $derived(form?.action === 'epreuve' && form?.valeurs ? form.valeurs : {});
	const libelleTop = (x) => (x === 1 ? 'Vainqueur' : `Top ${x}`);
	const soumettre = () => {
		envoi = true;
		return async ({ update }) => {
			await update({ reset: false });
			envoi = false;
			aConfirmer = null;
		};
	};
	const ROLES = { proprietaire: ', propriétaire', admin: ', administrateur', membre: '' };
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

	{#if form?.erreur && form?.action !== 'classer'}<p class="erreur" role="alert">{form.erreur}</p>{/if}
	{#if form?.succes}<p class="succes" role="status">{form.succes}</p>{/if}

	{#if onglet === 'match'}
		<section class="carte" aria-labelledby="t-match">
			<h2 id="t-match">Ajouter un match</h2>
			<p class="aide">Les cotes sont calculées par l’application à partir des matchs déjà joués. Les paris ouvrent tout de suite et ferment à l’heure du match. Une équipe ou une compétition inconnue est créée automatiquement.</p>
			<form method="POST" action="?/creer" use:enhance={soumettre}>
				<label class="champ">Jeu
					<select name="jeu" bind:value={jeu}>
						{#each data.jeux as j (j.code)}<option value={j.code}>{j.nom}</option>{/each}
					</select>
				</label>
				<div class="deux">
					<label class="champ">Compétition
						<input type="text" name="competition" list="liste-competitions" bind:value={competition} required placeholder="Worlds 2026" />
					</label>
					<label class="champ">Région
						<input type="text" name="region" bind:value={region} placeholder="International" />
					</label>
				</div>
				<datalist id="liste-competitions">{#each competitionsDuJeu as c (c.id)}<option value={c.nom}></option>{/each}</datalist>
				<label class="champ">Phase <span class="facultatif">facultatif</span>
					<input type="text" name="phase" bind:value={phase} placeholder="Quart de finale" />
				</label>
				<label class="case">
					<input type="checkbox" name="deja_joue" bind:checked={dejaJoue} />
					<span>Match déjà joué : je l’ajoute à l’historique pour améliorer les cotes (sans paris)</span>
				</label>
				<label class="champ">Date<input type="date" name="date" bind:value={date} required /></label>
				<div class="trois">
					<label class="champ">Heure<input type="time" name="heure" bind:value={heure} required /></label>
					<label class="champ">Format
						<select name="best_of" bind:value={bestOf}>
							{#each [1, 3, 5, 7] as bo (bo)}<option value={String(bo)}>BO{bo}</option>{/each}
						</select>
					</label>
				</div>
				<datalist id="liste-equipes">{#each data.equipes as e (e.nom)}<option value={e.nom}></option>{/each}</datalist>
				<div class={dejaJoue ? 'duel' : ''}>
					<label class="champ">Équipe A<input type="text" name="equipe_a" list="liste-equipes" bind:value={equipeA} required /></label>
					{#if dejaJoue}<label class="champ">Manches<input type="number" name="score_a" min="0" max="4" value={v.score_a ?? ''} required /></label>{/if}
				</div>
				<div class={dejaJoue ? 'duel' : ''}>
					<label class="champ">Équipe B<input type="text" name="equipe_b" list="liste-equipes" bind:value={equipeB} required /></label>
					{#if dejaJoue}<label class="champ">Manches<input type="number" name="score_b" min="0" max="4" value={v.score_b ?? ''} required /></label>{/if}
				</div>

				{#if !dejaJoue}
					<div class="apercu" aria-live="polite">
						{#if apercu}
							<div class="cotes-apercu">
								<span class="nom-eq">{equipeA}</span>
								<span class="c">{formatCote(apercu.coteA)}</span>
								<span class="vs">VS</span>
								<span class="c">{formatCote(apercu.coteB)}</span>
								<span class="nom-eq droite">{equipeB}</span>
							</div>
							<p class="aide">
								Chances de gagner le match : {pct(apercu.pA)} contre {pct(apercu.pB)} ; une manche : {pct(apercu.detail.pMap)}.
								Notes Elo {formatNombre(Math.round(apercu.detail.noteA))} et {formatNombre(Math.round(apercu.detail.noteB))},
								sur {apercu.detail.matchsA} et {apercu.detail.matchsB} match{apercu.detail.matchsA + apercu.detail.matchsB > 1 ? 's' : ''} connus.
								{#if apercu.detail.h2hMaps > 0}Confrontations directes : {apercu.detail.h2hMaps} manche{apercu.detail.h2hMaps > 1 ? 's' : ''}, correctif de {(apercu.detail.correctifH2h * 100).toFixed(1).replace('.', ',')} point{Math.abs(apercu.detail.correctifH2h * 100) >= 2 ? 's' : ''}.{:else if !apercu.detail.effectifsConnus}Confrontations directes non prises en compte : effectifs non renseignés.{/if}
							</p>
							{#if apercu.detail.matchsA === 0 || apercu.detail.matchsB === 0}
								<p class="alerte">
									{apercu.detail.matchsA === 0 && apercu.detail.matchsB === 0 ? 'Aucune des deux équipes n’a' : `${apercu.detail.matchsA === 0 ? equipeA : equipeB} n’a`} encore de match dans l’historique : note de départ ({formatNombre(apercu.detail.noteInitiale)}). Ajoute quelques résultats passés pour des cotes plus justes.
								</p>
							{/if}
							{#if apercu.scores.length}
								<p class="aide">Scores exacts : {apercu.scores.map((s) => `${s.libelle} à ${formatCote(s.cote)}`).join(', ')}. Manche {bestOf} jouée : {formatCote(apercu.derniere.oui.cote)}.</p>
							{/if}
						{:else}
							<p class="aide">{calcul ? 'Calcul des cotes…' : 'Les cotes s’afficheront ici dès que les deux équipes seront saisies.'}</p>
						{/if}
					</div>
				{/if}
				<button type="submit" class="principal" disabled={envoi}>{envoi ? 'Ajout…' : dejaJoue ? 'Ajouter à l’historique' : 'Ajouter le match'}</button>
			</form>
		</section>

		{#if data.jeuxLobby.length}
			<section class="carte" aria-labelledby="t-epreuve">
				<h2 id="t-epreuve">Ajouter une épreuve en lobby</h2>
				<p class="aide">Fortnite, Warzone, TFT : pour chaque participant, un pari « top X » (oui ou non). Une ligne par groupe, joueurs séparés par « / » : <code>Peterbot / Pollo</code>. Pour TFT, un joueur par ligne.</p>
				<form method="POST" action="?/epreuve" use:enhance={soumettre}>
					<label class="champ">Jeu
						<select name="jeu" value={ve.jeu ?? data.jeuxLobby[0].code}>
							{#each data.jeuxLobby as j (j.code)}<option value={j.code}>{j.nom}</option>{/each}
						</select>
					</label>
					<div class="deux">
						<label class="champ">Compétition<input type="text" name="competition" placeholder="FNCS Grand Finals" value={ve.competition ?? ''} required /></label>
						<label class="champ">Région<input type="text" name="region" placeholder="Europe" value={ve.region ?? ''} /></label>
					</div>
					<label class="champ">Phase <span class="facultatif">facultatif</span><input type="text" name="phase" placeholder="Jour 1" value={ve.phase ?? ''} /></label>
					<div class="trois">
						<label class="champ">Date<input type="date" name="date" value={ve.date ?? demain} required /></label>
						<label class="champ">Heure<input type="time" name="heure" value={ve.heure ?? '19:00'} required /></label>
					</div>
					<label class="champ">Participants
						<textarea name="participants" rows="8" placeholder={'Peterbot / Pollo\nQueasy / Merstach\nVeno / Th0masHD / Mero'} required>{ve.participants ?? ''}</textarea>
					</label>
					{#if form?.action === 'epreuve' && form?.apercu}
						<div class="apercu-lobby">
							<p class="meta">Cotes calculées pour {form.apercu.groupes.length} participants ({form.apercu.depart}), du plus au moins favori :</p>
							<table>
								<thead><tr><th scope="col">Participant</th>{#each form.apercu.seuils as x (x)}<th scope="col">{libelleTop(x)}</th>{/each}</tr></thead>
								<tbody>
									{#each form.apercu.groupes.slice(0, 12) as g (g.libelle)}
										<tr><th scope="row">{g.libelle}</th>{#each form.apercu.seuils as x (x)}<td>{formatCote(g.top[x].cote)}</td>{/each}</tr>
									{/each}
								</tbody>
							</table>
							{#if form.apercu.groupes.length > 12}<p class="meta">… et {form.apercu.groupes.length - 12} autres.</p>{/if}
						</div>
					{/if}
					<div class="boutons-source">
						<button type="submit" name="apercu" value="oui" class="discret" disabled={envoi}>Aperçu des cotes</button>
						<button type="submit" name="apercu" value="non" class="principal" disabled={envoi}>{envoi ? 'Ajout…' : 'Ajouter l’épreuve'}</button>
					</div>
				</form>
			</section>
		{/if}

		<section class="carte" aria-labelledby="t-import">
			<h2 id="t-import">Matchs importés automatiquement</h2>
			<p class="aide">Toutes les heures (tous les quarts d’heure pour PandaScore), le serveur ajoute les prochains matchs, met à jour les horaires et valide les résultats. « Aperçu » montre ce qui serait importé sans rien enregistrer.</p>
			{#each data.sources as s (s.cle)}
				<div class="source">
					<div class="infos">
						<span class="jeu-source">{s.jeu}</span>
						<span class="meta">Données <a href={s.lien} target="_blank" rel="noopener">{s.nom}</a>{s.active ? '' : ', en attente de la clé'}</span>
						{#if s.dernier}<span class="meta" class:echec={s.dernier.erreur}>{s.dernier.texte}</span>{/if}
					</div>
					{#if s.active}
						<form method="POST" action="?/importer" use:enhance={soumettre} class="boutons-source">
							<input type="hidden" name="source" value={s.cle} />
							<button type="submit" name="apercu" value="oui" class="discret" disabled={envoi}>Aperçu</button>
							<button type="submit" name="apercu" value="non" class="principal" disabled={envoi}>{envoi ? 'Import…' : 'Importer'}</button>
						</form>
					{:else}
						<p class="aide">Ajoute <code>{s.variable}</code> dans le fichier <code>.env</code> puis relance le serveur.</p>
					{/if}
				</div>
			{/each}
			{#if form?.action === 'importer' && form?.exemples?.length}
				<ul class="exemples">
					{#each form.exemples as e (e)}<li>{e}</li>{/each}
				</ul>
			{/if}
		</section>
	{:else if onglet === 'resultats'}
		<section aria-labelledby="t-resultats" class="liste">
			<h2 id="t-resultats" class="visuellement-cache">Résultats à valider</h2>
			{#if data.resultats.length === 0 && data.epreuves.length === 0}
				<p class="vide">Aucun résultat à valider. Les matchs et les épreuves apparaissent ici dès leur coup d’envoi.</p>
			{/if}
			{#each data.epreuves as ep (ep.id)}
				<article class="carte resultat">
					<div class="ligne-tete">
						<PictoJeu jeu={ep.jeu} taille={28} />
						<div class="compet">
							<span class="nom-compet">{ep.competition}{ep.phase ? `, ${ep.phase}` : ''}</span>
							<span class="meta">{nomJour(cleJour(ep.date_prevue))}, {formatHeure(ep.date_prevue)} · {ep.participants.length} participants · {ep.nb_paris} pari{ep.nb_paris > 1 ? 's' : ''}</span>
						</div>
					</div>
					{#if aConfirmer === `${ep.id}:annuler`}
						<form method="POST" action="?/annuler" use:enhance={soumettre} class="confirmation">
							<input type="hidden" name="serie" value={ep.id} />
							<p>Annuler cette épreuve et rembourser tous ses paris ?</p>
							<div class="boutons">
								<button type="button" class="discret" onclick={() => (aConfirmer = null)}>Retour</button>
								<button type="submit" class="danger" disabled={envoi}>Confirmer</button>
							</div>
						</form>
					{:else}
						<form method="POST" action="?/classer" use:enhance={soumettre} class="classement">
							<input type="hidden" name="serie" value={ep.id} />
							<label class="champ">Classement final, du 1er au dernier
								<textarea name="classement" rows="8" placeholder={ep.participants.slice(0, 3).join('\n')} required></textarea>
							</label>
							<p class="aide">Une ligne par participant, dans l’ordre. Tu peux commencer une ligne par sa place (« 3. ») et nommer un groupe par un seul de ses joueurs. Un participant absent du classement est remboursé.</p>
							{#if form?.action === 'classer' && form?.serie === ep.id && form?.erreur}<p class="erreur" role="alert">{form.erreur}</p>{/if}
							<button type="submit" class="principal" disabled={envoi}>{envoi ? 'Règlement…' : 'Valider le classement'}</button>
						</form>
						<button class="lien-danger" onclick={() => (aConfirmer = `${ep.id}:annuler`)}>Épreuve annulée ou reportée de plus de 48 h</button>
					{/if}
				</article>
			{/each}
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
						{@const [sa, sb] = quoi === 'annuler' ? [0, 0] : quoi.split('-').map(Number)}
						<form method="POST" action={quoi === 'annuler' ? '?/annuler' : '?/resultat'} use:enhance={soumettre} class="confirmation">
							<input type="hidden" name="serie" value={r.id} />
							{#if quoi !== 'annuler'}<input type="hidden" name="score" value={quoi} />{/if}
							<p>{quoi === 'annuler' ? 'Annuler ce match et rembourser les paris ?' : `Valider la victoire de ${r.equipes[sa > sb ? 0 : 1].nom}, ${sa}-${sb} ? Tous les paris du match seront réglés, sans retour possible.`}</p>
							<div class="boutons">
								<button type="button" class="discret" onclick={() => (aConfirmer = null)}>Retour</button>
								<button type="submit" class={quoi === 'annuler' ? 'danger' : 'principal'} disabled={envoi}>Confirmer</button>
							</div>
						</form>
					{:else}
						<p class="question">Score final ?</p>
						{@const sp = scoresPossibles(r.best_of)}
						{#each r.equipes as e, i (e.nom)}
							<div class="score-ligne">
								<span class="equipe-resultat"><Blason equipe={e} taille={24} /><span>{e.nom} gagne</span></span>
								<div class="scores">
									{#each i === 0 ? sp.a : sp.b as sc (sc)}
										<button class="score" onclick={() => (aConfirmer = `${r.id}:${sc}`)}>{sc}</button>
									{/each}
								</div>
							</div>
						{/each}
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
			<p class="aide">{data.joueur.estProprietaire ? 'Tu es propriétaire : toi seul peux nommer ou retirer des administrateurs.' : 'Seul le propriétaire de la ligue peut nommer ou retirer des administrateurs.'}</p>
			<ul class="membres">
				{#each data.membres as m (m.id)}
					<li>
						<span class="avatar" aria-hidden="true">{m.pseudo.charAt(0).toUpperCase()}</span>
						<div class="qui">
							<span class="pseudo">{m.pseudo}{ROLES[m.role]}</span>
							<span class="meta">{formatNombre(m.solde)} noxus</span>
						</div>
						{#if aConfirmer === `mdp:${m.id}` || aConfirmer === `role:${m.id}`}
							{@const role = aConfirmer.startsWith('role')}
							<form method="POST" action={role ? '?/role' : '?/motDePasse'} use:enhance={soumettre} class="actions-membre">
								<input type="hidden" name="utilisateur" value={m.id} />
								{#if role}<input type="hidden" name="admin" value={m.role === 'admin' ? 'non' : 'oui'} />{/if}
								<span class="question-membre">{role ? (m.role === 'admin' ? `Retirer le rôle d’administrateur à ${m.pseudo} ?` : `Nommer ${m.pseudo} administrateur ?`) : `Nouveau mot de passe pour ${m.pseudo} ?`}</span>
								<button type="button" class="discret" onclick={() => (aConfirmer = null)}>Retour</button>
								<button type="submit" class="principal petit" disabled={envoi}>Confirmer</button>
							</form>
						{:else}
							<div class="actions-membre">
								{#if data.joueur.estProprietaire && m.role !== 'proprietaire'}
									<button class="discret" onclick={() => (aConfirmer = `role:${m.id}`)} aria-label={m.role === 'admin' ? `Retirer le rôle d’administrateur à ${m.pseudo}` : `Nommer ${m.pseudo} administrateur`}>{m.role === 'admin' ? 'Retirer admin' : 'Nommer admin'}</button>
								{/if}
								{#if m.a_un_compte && (data.joueur.estProprietaire || m.role === 'membre' || m.id === data.joueur.id)}
									<button class="discret" onclick={() => (aConfirmer = `mdp:${m.id}`)} aria-label="Réinitialiser le mot de passe de {m.pseudo}">Mot de passe</button>
								{/if}
							</div>
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
	.source {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 12px;
		border-top: 1px solid var(--surface-active);
	}
	.infos {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.jeu-source {
		font-size: 15px;
		font-weight: 600;
	}
	.infos a {
		color: var(--texte-doux);
	}
	.meta.echec {
		color: var(--rouge-perte);
	}
	.boutons-source {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.exemples {
		margin: 0;
		padding-left: 18px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--texte-doux);
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
	textarea {
		width: 100%;
		padding: 10px 12px;
		border-radius: var(--r-bouton);
		border: 1px solid var(--bordure-forte);
		background: var(--surface-carte);
		color: var(--texte-principal);
		font: inherit;
		font-size: 15px;
		line-height: 1.45;
		resize: vertical;
	}
	.apercu-lobby {
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow-x: auto;
	}
	.apercu-lobby table {
		border-collapse: collapse;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
	.apercu-lobby th,
	.apercu-lobby td {
		padding: 6px 8px;
		text-align: right;
		border-bottom: 1px solid var(--surface-active);
		white-space: nowrap;
	}
	.apercu-lobby th[scope='row'],
	.apercu-lobby thead th:first-child {
		text-align: left;
		font-weight: 500;
	}
	.apercu-lobby thead th {
		color: var(--texte-discret);
		font-weight: 500;
	}
	form.classement {
		display: flex;
		flex-direction: column;
		gap: 10px;
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
		grid-template-columns: 1fr 96px;
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
	.score-ligne {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.equipe-resultat {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
	}
	.scores {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.score {
		min-width: 64px;
		min-height: 44px;
		padding: 0 12px;
		border-radius: var(--r-bouton);
		border: 1px solid var(--bordure-forte);
		background: var(--surface-carte);
		font-size: 16px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.case {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-height: 44px;
		font-size: 14px;
		line-height: 1.4;
		color: var(--texte-doux);
	}
	.case input {
		flex: 0 0 auto;
		width: 22px;
		min-height: 22px;
		height: 22px;
		margin: 0;
		accent-color: var(--magenta-arene);
	}
	.apercu {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border-radius: var(--r-controle);
		background: var(--surface-carte);
	}
	.cotes-apercu {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto minmax(0, 1fr);
		align-items: center;
		gap: 8px;
	}
	.nom-eq {
		font-size: 13px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.nom-eq.droite {
		text-align: right;
	}
	.cotes-apercu .c {
		padding: 6px 10px;
		border-radius: var(--r-cote);
		background: #c6ff4d26;
		border: 1px solid #c6ff4d59;
		font-size: 17px;
		font-weight: 700;
	}
	.cotes-apercu .vs {
		font-size: 13px;
		font-weight: 700;
		font-style: italic;
		color: #8d8a9b;
	}
	.alerte {
		margin: 0;
		font-size: 13px;
		line-height: 1.4;
		color: var(--ambre-fermeture);
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
		display: grid;
		grid-template-columns: 36px 1fr;
		align-items: center;
		column-gap: 12px;
		row-gap: 8px;
		padding: 8px 0;
		border-bottom: 1px solid var(--surface-active);
	}
	.membres li:last-child {
		border-bottom: none;
	}
	.actions-membre {
		grid-column: 2;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.actions-membre .discret,
	.actions-membre .principal {
		min-height: 44px;
		padding: 0 12px;
		font-size: 14px;
	}
	.question-membre {
		flex-basis: 100%;
		font-size: 14px;
		color: var(--texte-doux);
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
</style>
