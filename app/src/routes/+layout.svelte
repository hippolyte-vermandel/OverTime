<script>
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';

	import { formatNombre } from '#lib/format.js';

	let { data, children } = $props();

	// Barre d'onglets en bas d'écran, comme une application iPhone
	const onglets = [
		{ href: '/', titre: 'Matchs', icone: 'M4 5h16v14H4zM4 10h16M12 5v14' },
		{ href: '/paris', titre: 'Mes paris', icone: 'M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2zM9 9h6M9 13h4' },
		{ href: '/classement', titre: 'Classement', icone: 'M5 20V11h4v9M10 20V5h4v15M15 20v-7h4v7' },
		{ href: '/profil', titre: 'Profil', icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6' }
	];

	const actif = (href) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icones/apple-touch-icon.png" />
	<meta name="theme-color" content="#0c0c12" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="OverTime" />
</svelte:head>

<div class="app">
	{#if data.joueur}
		<header class="entete">
			<span class="logo" aria-label="OverTime">Over<span>Time</span></span>
			{#if data.joueur.ligue}
				<span class="solde" aria-label="Solde : {formatNombre(data.joueur.solde)} noxus">{formatNombre(data.joueur.solde)}<span class="unite">noxus</span></span>
			{/if}
		</header>
	{/if}

	<main class:sans-nav={!data.joueur}>
		{@render children()}
	</main>
</div>

{#if data.joueur}
<nav class="onglets" aria-label="Navigation principale">
	{#each onglets as o (o.href)}
		<a href={o.href} aria-current={actif(o.href) ? 'page' : undefined}>
			<span class="pastille"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={o.icone} /></svg></span>
			<span>{o.titre}</span>
		</a>
	{/each}
</nav>
{/if}

<style>
	.app {
		max-width: 640px;
		margin: 0 auto;
	}
	.entete {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: calc(env(safe-area-inset-top) + 14px) 20px 6px;
	}
	/* Logo : OVER en blanc, TIME dans son cadre magenta incliné */
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 21px;
		font-weight: 800;
		font-style: italic;
		letter-spacing: -0.01em;
		text-transform: uppercase;
		line-height: 1;
	}
	.logo span {
		display: inline-block;
		padding: 3px 8px 4px;
		border-radius: 6px;
		background: var(--magenta-arene);
		color: var(--nuit-arene);
		transform: skewX(-10deg);
	}
	.solde {
		display: flex;
		align-items: baseline;
		gap: 5px;
		padding: 6px 12px;
		border-radius: 10px;
		background: var(--surface-gradin);
		border: 1px solid var(--surface-active);
		font-weight: 700;
		font-size: 18px;
	}
	.unite {
		font-size: 12px;
		font-weight: 500;
		color: var(--texte-discret);
	}

	main {
		padding-bottom: calc(env(safe-area-inset-bottom) + 96px);
	}
	main.sans-nav {
		padding-bottom: env(safe-area-inset-bottom);
	}

	.onglets {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 20;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding: 6px 4px calc(env(safe-area-inset-bottom) + 8px);
		background: var(--surface-gradin);
		border-top: 1px solid var(--surface-active);
	}
	.onglets a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		min-height: 48px;
		padding-top: 4px;
		font-size: 11px;
		font-weight: 600;
		color: var(--texte-discret);
		text-decoration: none;
	}
	.pastille {
		display: grid;
		place-items: center;
		width: 54px;
		height: 28px;
		border-radius: 14px;
	}
	.onglets svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* Onglet actif : blanc sur pastille, jamais magenta */
	.onglets a[aria-current='page'] {
		color: var(--texte-principal);
	}
	.onglets a[aria-current='page'] .pastille {
		background: var(--surface-active);
	}
</style>
