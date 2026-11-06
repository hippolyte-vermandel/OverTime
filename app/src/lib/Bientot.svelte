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
		margin-top: 40px;
		padding: 28px 20px;
		text-align: center;
		background: var(--surface);
		border: 1px solid var(--bord);
		border-radius: var(--rayon);
	}
	h1 {
		margin: 0 0 8px;
		font-size: 1.3rem;
	}
	p {
		margin: 0 0 16px;
		color: var(--texte-2);
	}
	.etiquette {
		display: inline-block;
		padding: 4px 12px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent-fort);
		font-size: 0.8rem;
		font-weight: 700;
	}
</style>
