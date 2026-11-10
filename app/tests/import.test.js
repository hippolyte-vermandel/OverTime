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
