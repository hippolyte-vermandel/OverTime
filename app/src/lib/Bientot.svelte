<script>
	/** @type {{ titre: string, texte: string }} */
	let { titre, texte } = $props();
</script>

<svelte:head>
	<title>{titre} · OverTime</title>
</svelte:head>

<section>
	<h1>{titre}</h1>
	<p>{texte}</p>
	<span class="etiquette">Bientôt</span>
</section>

<style>
	section {
		margin: 40px 12px 0;
		padding: 28px 20px;
		text-align: center;
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
		border-radius: var(--r-section);
	}
	h1 {
		margin: 0 0 8px;
		font-size: 22px;
		font-weight: 700;
	}
	p {
		margin: 0 0 16px;
		color: var(--texte-discret);
	}
	.etiquette {
		display: inline-block;
		padding: 4px 12px;
		border-radius: var(--r-pastille);
		background: var(--surface-active);
		color: var(--texte-doux);
		font-size: 13px;
		font-weight: 700;
	}
</style>
