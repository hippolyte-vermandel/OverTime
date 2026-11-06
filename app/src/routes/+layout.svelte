<script>
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();

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
	<meta name="theme-color" content="#0b0e14" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="OverTime" />
</svelte:head>

<header class="entete">
	<span class="logo" aria-label="OverTime">Over<span>Time</span></span>
	<span class="solde" title="Ton solde de la saison">
		<span class="visuellement-cache">Solde :</span>— <span class="unite">NX</span>
	</span>
</header>

<main>
	{@render children()}
</main>

<nav class="onglets" aria-label="Navigation principale">
	{#each onglets as o (o.href)}
		<a href={o.href} aria-current={actif(o.href) ? 'page' : undefined}>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d={o.icone} /></svg>
			<span>{o.titre}</span>
		</a>
	{/each}
</nav>

<style>
	.entete {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: calc(env(safe-area-inset-top) + 12px) 18px 12px;
		background: rgb(11 14 20 / 0.85);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-bottom: 1px solid var(--bord);
	}
	.logo {
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}
	.logo span {
		color: var(--accent);
	}
	.solde {
		font-family: var(--chiffres);
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--bord);
	}
	.unite {
		color: var(--texte-2);
		font-size: 0.8em;
	}

	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 8px 14px calc(env(safe-area-inset-bottom) + 90px);
	}

	.onglets {
		position: fixed;
		inset: auto 0 0 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding: 6px 4px calc(env(safe-area-inset-bottom) + 6px);
		background: var(--surface);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-top: 1px solid var(--bord);
	}
	.onglets a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		min-height: 48px;
		padding-top: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--texte-2);
		text-decoration: none;
	}
	.onglets svg {
		width: 24px;
		height: 24px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.onglets a[aria-current='page'] {
		color: var(--accent-fort);
	}
</style>
