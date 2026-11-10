// Conversion des réponses de Leaguepedia et de Liquipedia en matchs normalisés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as lp from '../src/lib/server/import/leaguepedia.js';
import * as lpdb from '../src/lib/server/import/lpdb.js';
import { scoreValide, equipeConnue } from '../src/lib/server/import/outils.js';

test('Leaguepedia : match à venir', () => {
	const m = lp.versMatch({ MatchId: 'LEC/2026 Winter_Week 1_1', Team1: 'Karmine Corp', Team2: 'G2 Esports', Team1Score: '', Team2Score: '', Winner: '', BestOf: '3', Quand: '2026-11-20 17:00:00', Tab: 'Week 1', Annule: '0', Tournoi: 'LEC 2026 Winter', Region: 'EMEA' });
	assert.equal(m.id, 'LEC/2026 Winter_Week 1_1');
	assert.equal(m.jeu, 'lol');
	assert.equal(m.quand.toISOString(), '2026-11-20T17:00:00.000Z');
	assert.equal(m.bestOf, 3);
	assert.equal(m.termine, false);
	assert.equal(m.annule, false);
	assert.equal(m.competition, 'LEC 2026 Winter');
	assert.equal(m.phase, 'Week 1');
});

test('Leaguepedia : résultat, clés avec espaces et BO1 sans score', () => {
	const fini = lp.versMatch({ MatchId: 'x', Team1: 'A', Team2: 'B', Team1Score: '2', Team2Score: '1', Winner: '1', BestOf: '3', 'DateTime UTC': '', Quand: '2026-11-01 15:00:00' });
	assert.deepEqual([fini.termine, fini.scoreA, fini.scoreB], [true, 2, 1]);
	const bo1 = lp.versMatch({ MatchId: 'y', Team1: 'A', Team2: 'B', Winner: '2', BestOf: '1', Quand: '2026-11-01 15:00:00' });
	assert.deepEqual([bo1.termine, bo1.scoreA, bo1.scoreB], [true, 0, 1]);
	assert.equal(lp.versMatch({ MatchId: 'z', Team1: 'A', Team2: 'B', BestOf: '4', Quand: '2026-11-01 15:00:00' }), null, 'BO4 refusé');
	assert.equal(lp.versMatch({ Team1: 'A', Team2: 'B', Quand: '2026-11-01 15:00:00' }), null, 'sans identifiant');
});

test('Leaguepedia : requête filtrée par niveau et région', () => {
	const u = new URL(lp.adresseRequete(new Date('2026-11-01T00:00:00Z'), new Date('2026-11-15T00:00:00Z'), ['EMEA', "Côte d'Ivoire"]));
	assert.equal(u.hostname, 'lol.fandom.com');
	assert.equal(u.searchParams.get('format'), 'json');
	const ou = u.searchParams.get('where');
	assert.match(ou, /DateTime_UTC >= '2026-11-01 00:00:00'/);
	assert.match(ou, /TournamentLevel = 'Primary'/);
	assert.match(ou, /'Côte d''Ivoire'/, 'apostrophe doublée');
});

test('Liquipedia : match terminé, à venir, non joué', () => {
	const base = { match2id: 'abc_R01-M001', date: '2026-11-21 18:00:00', bestof: 3, tickername: 'VCT EMEA', section: 'Playoffs' };
	const avenir = lpdb.versMatch({ ...base, finished: 0, winner: '', match2opponents: [{ type: 'team', name: 'Karmine Corp', score: -1 }, { type: 'team', name: 'Team Heretics', score: -1 }] });
	assert.equal(avenir.termine, false);
	assert.equal(avenir.competition, 'VCT EMEA');
	assert.equal(avenir.jeu, 'valorant');
	const fini = lpdb.versMatch({ ...base, finished: 1, winner: '2', match2opponents: [{ type: 'team', name: 'A', score: 1 }, { type: 'team', name: 'B', score: 2 }] });
	assert.deepEqual([fini.termine, fini.scoreA, fini.scoreB], [true, 1, 2]);
	const np = lpdb.versMatch({ ...base, finished: 1, resulttype: 'np', winner: '', match2opponents: [{ name: 'A', score: -1 }, { name: 'B', score: -1 }] });
	assert.deepEqual([np.annule, np.termine], [true, false]);
	assert.equal(lpdb.versMatch({ ...base, match2opponents: [{ type: 'solo', name: 'x' }, { type: 'solo', name: 'y' }] }), null, 'pas un match d’équipes');
});

test('Liquipedia : sans clé, rien n’est demandé', async () => {
	let appels = 0;
	await assert.rejects(lpdb.lireMatchs({ depuis: new Date(), jusqua: new Date(), cle: '', niveaux: ['1'], chercher: async () => (appels++, null) }), /LPDB_API_KEY/);
	assert.equal(appels, 0);
});

test('Liquipedia : la clé part dans l’en-tête, pas dans l’adresse', async () => {
	let vu;
	await lpdb.lireMatchs({ depuis: new Date(), jusqua: new Date(), cle: 'SECRET', niveaux: ['1'], chercher: async (url, o) => ((vu = { url, o }), { ok: true, status: 200, json: async () => ({ result: [] }) }) });
	assert.equal(vu.o.headers.Authorization, 'Apikey SECRET');
	assert.ok(!vu.url.includes('SECRET'));
	assert.match(decodeURIComponent(vu.url), /\[\[liquipediatier::1\]\]/);
});

test('Outils : scores et équipes', () => {
	assert.ok(scoreValide(5, 3, 1));
	assert.ok(!scoreValide(5, 2, 1));
	assert.ok(!scoreValide(3, null, 2));
	assert.ok(!equipeConnue('TBD'));
	assert.ok(equipeConnue('Karmine Corp'));
});

import * as ps from '../src/lib/server/import/pandascore.js';

const equipe = (id, name) => ({ type: 'Team', opponent: { id, name, acronym: name.slice(0, 3), image_url: `https://cdn.pandascore.co/images/team/image/${id}/logo.png` } });
const matchPs = (o = {}) => ({
	id: 991, scheduled_at: '2026-11-22T19:00:00Z', status: 'not_started', match_type: 'best_of', number_of_games: 7,
	opponents: [equipe(1, 'Karmine Corp'), equipe(2, 'Team Vitality')], results: [{ team_id: 1, score: 0 }, { team_id: 2, score: 0 }],
	winner_id: null, forfeit: false, league: { name: 'RLCS' }, serie: { full_name: '2026 World Championship' }, tournament: { name: 'Playoffs' }, ...o
});

test('PandaScore : match à venir, terminé, annulé', () => {
	const jeu = ps.JEUX[0];
	const avenir = ps.versMatch(matchPs(), jeu);
	assert.equal(avenir.jeu, 'rocket');
	assert.equal(avenir.bestOf, 7);
	assert.equal(avenir.competition, 'RLCS 2026 World Championship');
	assert.equal(avenir.phase, 'Playoffs');
	assert.equal(avenir.termine, false);
	assert.equal(avenir.sigleA, 'Kar');
	assert.equal(avenir.logoB, 'https://cdn.pandascore.co/images/team/image/2/logo.png');
	const fini = ps.versMatch(matchPs({ status: 'finished', winner_id: 2, results: [{ team_id: 1, score: 2 }, { team_id: 2, score: 4 }] }), jeu);
	assert.deepEqual([fini.termine, fini.scoreA, fini.scoreB], [true, 2, 4]);
	assert.equal(ps.versMatch(matchPs({ status: 'finished', winner_id: 2, forfeit: true }), jeu).termine, false, 'forfait : à la main');
	assert.equal(ps.versMatch(matchPs({ status: 'canceled' }), jeu).annule, true);
	assert.equal(ps.versMatch(matchPs({ match_type: 'first_to', number_of_games: 4 }), jeu).bestOf, 7, 'premier à 4 = BO7');
	assert.equal(ps.versMatch(matchPs({ match_type: 'all_games_played' }), jeu), null);
});

test('PandaScore : les deux jeux, clé dans l’en-tête', async () => {
	const vus = [];
	await ps.lireMatchs({ depuis: new Date('2026-11-01T00:00:00Z'), jusqua: new Date('2026-11-15T00:00:00Z'), cle: 'SECRET', chercher: async (url, o) => (vus.push({ url, o }), { ok: true, status: 200, json: async () => [] }) });
	assert.deepEqual(vus.map((v) => new URL(v.url).pathname), ['/rl/matches', '/codmw/matches']);
	assert.ok(vus.every((v) => v.o.headers.Authorization === 'Bearer SECRET' && !v.url.includes('SECRET')));
	await assert.rejects(ps.lireMatchs({ depuis: new Date(), jusqua: new Date(), cle: '' }), /PANDASCORE_TOKEN/);
});

test('Leaguepedia : sigles et logos des équipes', async () => {
	const adresses = [];
	const chercher = async (url) => {
		adresses.push(url);
		const u = new URL(url);
		if (u.searchParams.get('tables') === 'Teams')
			return { ok: true, status: 200, json: async () => [{ Nom: 'Gen.G', Page: 'Gen.G', Sigle: 'GEN', Image: 'Gen.Glogo square.png' }, { Nom: 'Bilibili Gaming', Page: 'Bilibili Gaming', Sigle: 'BLG', Image: '' }] };
		return { ok: true, status: 200, json: async () => [{ MatchId: 'w1', Team1: 'Bilibili Gaming', Team2: 'Gen.G', BestOf: '5', Quand: '2026-11-12 09:00:00', Winner: '', Tournoi: 'Worlds 2026 Main Event', Region: 'International' }] };
	};
	const [m] = await lp.lireMatchs({ depuis: new Date(), jusqua: new Date(), regions: ['International'], chercher });
	assert.equal(adresses.length, 2, 'une requête de matchs, une d’équipes');
	assert.equal(m.sigleA, 'BLG');
	assert.equal(m.logoA, null, 'pas d’image : blason neutre');
	assert.equal(m.sigleB, 'GEN');
	assert.equal(m.logoB, 'https://lol.fandom.com/wiki/Special:FilePath/Gen.Glogo%20square.png?width=96');
	assert.match(new URL(adresses[1]).searchParams.get('where'), /'Gen\.G'/);
});

test('Leaguepedia : une panne des équipes n’empêche pas l’import', async () => {
	const chercher = async (url) =>
		new URL(url).searchParams.get('tables') === 'Teams' ? { ok: false, status: 503 } : { ok: true, status: 200, json: async () => [{ MatchId: 'w2', Team1: 'A', Team2: 'B', BestOf: '1', Quand: '2026-11-12 09:00:00' }] };
	const orig = console.error;
	console.error = () => {};
	const matchs = await lp.lireMatchs({ depuis: new Date(), jusqua: new Date(), regions: [], chercher });
	console.error = orig;
	assert.equal(matchs.length, 1);
	assert.equal(matchs[0].logoA ?? null, null);
});
