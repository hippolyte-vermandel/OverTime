<script>
	// Le coupon : une barre flottante (« Miser ») puis une feuille pour régler la mise,
	// voir le gain possible, l'heure de fermeture et parier.
	import { formatCote, formatNombre, formatHeure, nomJour, cleJour, fermeture } from '#lib/format.js';

	/**
	 * @type {{
	 *   lignes: { match: any, issue: any, choix: string, contexte: string }[],
	 *   maintenant: Date,
	 *   solde: number | null,
	 *   onretirer: (matchId: number) => void,
	 *   onvider: () => void
	 * }}
	 */
	let { lignes, maintenant, solde, onretirer, onvider } = $props();

	const MISE_MIN = 10;
	const MISE_MAX = 500;
	let ouvert = $state(false);
	let mise = $state(50);
	let message = $state('');

	const cote = $derived(lignes.reduce((c, l) => c * Number(l.issue.cote), 1));
	const gain = $derived(Math.floor(mise * cote));
	const insuffisant = $derived(solde !== null && mise > solde);
	const combine = $derived(lignes.length > 1);

	// Le coupon ferme au coup d'envoi du premier match
	const premier = $derived([...lignes].sort((a, b) => a.match.date_prevue.localeCompare(b.match.date_prevue))[0]?.match);
	const texteFermeture = $derived.by(() => {
		if (!premier) return '';
		const f = fermeture(premier.date_prevue, maintenant);
		const sujet = combine ? 'Le combiné ferme' : 'Les paris ferment';
		if (f) return `${sujet} à ${formatHeure(premier.date_prevue)}, ${f.court}`;
		return `${sujet} le ${nomJour(cleJour(premier.date_prevue))} à ${formatHeure(premier.date_prevue)}`;
	});
	const bientot = $derived(premier ? (fermeture(premier.date_prevue, maintenant)?.bientot ?? false) : false);

	const regler = (v) => (mise = Math.min(MISE_MAX, Math.max(MISE_MIN, v)));

	function parier() {
		if (insuffisant) return;
		// Les comptes ne sont pas encore en place : aucun pari n'est enregistré pour l'instant.
		message = 'Les comptes arrivent bientôt : ce pari n’a pas encore été enregistré.';
	}

	$effect(() => {
		if (lignes.length === 0) {
			ouvert = false;
			message = '';
		}
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (ouvert = false)} />

{#if lignes.length > 0 && !ouvert}
	<div class="barre">
		<div class="resume">
			<span class="nb">{lignes.length === 1 ? '1 sélection' : `${lignes.length} sélections, combiné`}</span>
			<span class="cote-totale">cote {formatCote(cote)}</span>
		</div>
		<button class="miser" onclick={() => (ouvert = true)}>Miser</button>
	</div>
{/if}

{#if ouvert && lignes.length > 0}
	<div class="voile">
		<button class="fond" aria-label="Fermer le coupon" onclick={() => (ouvert = false)}></button>
		<div class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-coupon">
			<div class="tete">
				<h2 id="titre-coupon">Ton coupon</h2>
				<button class="discret" onclick={onvider}>Tout retirer</button>
			</div>

			<ul class="lignes">
				{#each lignes as l (l.match.id)}
					<li>
						<div class="texte"><span class="choix">{l.choix}</span><span class="contexte">{l.contexte}</span></div>
						<span class="c">{formatCote(l.issue.cote)}</span>
						<button class="retirer" aria-label="Retirer {l.choix}" onclick={() => onretirer(l.match.id)}>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
						</button>
					</li>
				{/each}
			</ul>

			{#if combine}
				<p class="aide">Combiné, cote {formatCote(cote)}. Si un match est annulé, le combiné continue sans lui : tu touches la moitié du gain, et jamais moins que ta mise.</p>
			{/if}

			<div class="mise">
				<span class="libelle">Mise</span>
				<button class="pas" aria-label="Retirer 10 noxus" onclick={() => regler(mise - 10)}>−</button>
				<span class="valeur" aria-live="polite">{formatNombre(mise)}<span class="unite">&nbsp;noxus</span></span>
				<button class="pas" aria-label="Ajouter 10 noxus" onclick={() => regler(mise + 10)}>+</button>
			</div>
			<div class="rapides" role="group" aria-label="Mises rapides">
				{#each [10, 50, 100, 250] as v (v)}
					<button aria-pressed={mise === v} onclick={() => regler(v)}>{v}</button>
				{/each}
			</div>

			<div class="bilan">
				<span>Gain possible</span><span class="gain">{formatNombre(gain)} noxus</span>
				{#if solde !== null}<span class="sec">Solde après le pari</span><span class="sec droite">{formatNombre(Math.max(0, solde - mise))} noxus</span>{/if}
			</div>

			<span class="fermeture" class:bientot>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /></svg>{texteFermeture}
			</span>

			{#if insuffisant}
				<p class="alerte" role="alert">Solde insuffisant : il te reste {formatNombre(solde)} noxus. Baisse la mise pour parier.</p>
			{/if}
			{#if message}
				<p class="info" role="status">{message}</p>
			{/if}

			<button class="parier" aria-disabled={insuffisant} onclick={parier}>Parier {formatNombre(mise)} noxus</button>
		</div>
	</div>
{/if}

<style>
	.barre {
		position: fixed;
		left: 12px;
		right: 12px;
		bottom: calc(env(safe-area-inset-bottom) + 76px);
		z-index: 15;
		max-width: 616px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 10px 10px 16px;
		border-radius: 18px;
		background: #1e1c26;
		border: 1px solid var(--bordure-forte);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.55);
	}
	.resume {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.nb {
		font-size: 13px;
		color: var(--texte-discret);
	}
	.cote-totale {
		font-size: 20px;
		font-weight: 700;
	}
	.miser,
	.parier {
		border: none;
		background: var(--magenta-arene);
		color: var(--nuit-arene);
		font-weight: 700;
	}
	.miser {
		min-height: 48px;
		padding: 0 22px;
		border-radius: var(--r-bouton);
		font-size: 16px;
	}

	.voile {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.fond {
		flex: 1;
		border: none;
		background: rgb(5 5 10 / 0.6);
	}
	.feuille {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 100%;
		max-width: 640px;
		margin: 0 auto;
		max-height: 88vh;
		overflow-y: auto;
		padding: 16px 16px calc(env(safe-area-inset-bottom) + 24px);
		border-radius: var(--r-feuille) var(--r-feuille) 0 0;
		background: var(--surface-gradin);
		border-top: 1px solid var(--surface-active);
	}
	.tete {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}
	.discret {
		min-height: 44px;
		padding: 0 6px;
		border: none;
		background: transparent;
		color: var(--texte-doux);
		font-size: 14px;
		font-weight: 600;
	}
	.lignes {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.lignes li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 4px 8px 12px;
		border-radius: var(--r-controle);
		background: var(--surface-carte);
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
	.contexte {
		font-size: 12px;
		color: var(--texte-discret);
	}
	.c {
		font-size: 17px;
		font-weight: 600;
	}
	.retirer {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		background: transparent;
		color: var(--texte-discret);
	}
	svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.aide {
		margin: 0;
		font-size: 13px;
		line-height: 1.4;
		color: var(--texte-discret);
	}
	.mise {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.libelle {
		flex: 1;
		font-size: 15px;
		color: var(--texte-doux);
	}
	.pas {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--r-bouton);
		border: 1px solid var(--bordure-forte);
		background: var(--surface-carte);
		font-size: 20px;
		font-weight: 600;
	}
	.valeur {
		min-width: 96px;
		text-align: center;
		font-size: 22px;
		font-weight: 700;
	}
	.unite {
		font-size: 12px;
		font-weight: 500;
		color: var(--texte-discret);
	}
	.rapides {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.rapides button {
		min-height: 44px;
		border-radius: var(--r-bouton);
		border: 1px solid var(--bordure-forte);
		background: var(--surface-carte);
		font-size: 15px;
		font-weight: 600;
	}
	.rapides button[aria-pressed='true'] {
		background: var(--surface-active);
		border-color: var(--texte-principal);
	}
	.bilan {
		display: grid;
		grid-template-columns: 1fr auto;
		row-gap: 6px;
		padding: 12px 14px;
		border-radius: var(--r-controle);
		background: var(--surface-carte);
		font-size: 14px;
		color: var(--texte-doux);
	}
	.gain {
		text-align: right;
		font-size: 17px;
		font-weight: 700;
		color: var(--texte-principal);
	}
	.sec {
		color: var(--texte-discret);
	}
	.droite {
		text-align: right;
		color: var(--texte-doux);
	}
	.fermeture {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 500;
		color: var(--texte-discret);
	}
	.fermeture svg {
		width: 16px;
		height: 16px;
		flex: 0 0 auto;
	}
	.fermeture.bientot {
		color: var(--ambre-fermeture);
	}
	.alerte,
	.info {
		margin: 0;
		font-size: 14px;
	}
	.alerte {
		color: var(--rouge-perte);
	}
	.info {
		color: var(--texte-doux);
	}
	.parier {
		min-height: 54px;
		border-radius: var(--r-controle);
		font-size: 17px;
	}
	.parier[aria-disabled='true'] {
		background: var(--surface-active);
		color: var(--texte-eteint);
		cursor: not-allowed;
	}
</style>
