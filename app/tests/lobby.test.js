// Moteur des épreuves en lobby
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MoteurLobby, seuilsPour, departDepuisClassement } from '../src/lib/server/cotes/lobby.js';

test('Seuils selon le jeu et la taille du lobby', () => {
	assert.deepEqual(seuilsPour('fortnite', 50), [10, 3, 1]);
	assert.deepEqual(seuilsPour('warzone', 8), [3, 1]);
	assert.deepEqual(seuilsPour('tft', 8), [4, 1]);
	assert.deepEqual(seuilsPour('tft', 4), [1]);
});

test('Lobby neutre : chacun a les mêmes chances, et les probabilités sont cohérentes', () => {
	const m = new MoteurLobby();
	const groupes = Array.from({ length: 20 }, (_, i) => [`a${i}`, `b${i}`]);
	const p = m.probasTop(groupes, [10, 3, 1]);
	for (const g of p) {
		assert.ok(Math.abs(g[10] - 0.5) < 0.02, `top 10 ≈ 50 % (${g[10]})`);
		assert.ok(Math.abs(g[1] - 0.05) < 0.01, `top 1 ≈ 5 % (${g[1]})`);
		assert.ok(g[10] > g[3] && g[3] > g[1], 'top 10 > top 3 > top 1');
	}
	const somme1 = p.reduce((s, g) => s + g[1], 0);
	assert.ok(Math.abs(somme1 - 1) < 0.01, 'un seul vainqueur par épreuve');
	const somme10 = p.reduce((s, g) => s + g[10], 0);
	assert.ok(Math.abs(somme10 - 10) < 0.05, 'dix places dans le top 10');
});

test('Les résultats font évoluer les notes des joueurs, même dans un nouveau duo', () => {
	const m = new MoteurLobby();
	for (let e = 0; e < 5; e++) {
		m.jouer([
			{ joueurs: ['Peterbot', 'Pollo'], place: 1 },
			{ joueurs: ['X', 'Y'], place: 2 },
			{ joueurs: ['Z', 'W'], place: 3 },
			{ joueurs: ['Absent', 'Abs2'], place: null }
		]);
	}
	assert.ok(m.noteJoueur('peterbot') > 1550, 'Peterbot monte');
	assert.ok(m.noteJoueur('Z') < 1450, 'Z descend');
	assert.equal(m.noteJoueur('Absent'), 1500, 'sans place, pas de changement');
	// Peterbot change de partenaire : le nouveau duo reste favori
	const [nouveau, autre] = m.probasTop([['Peterbot', 'Inconnu'], ['Q', 'R'], ['S', 'T']], [1]);
	assert.ok(nouveau[1] > autre[1], 'le duo de Peterbot reste favori');
});

test('Même calcul, mêmes cotes (graine fixe)', () => {
	const g = [['a'], ['b'], ['c'], ['d']];
	assert.deepEqual(new MoteurLobby().probasTop(g, [1]), new MoteurLobby().probasTop(g, [1]));
});

test('Notes de départ depuis un classement pro', () => {
	const { depart, horsClassement } = departDepuisClassement(['Peterbot', 'Pollo', 'Queasy']);
	assert.equal(depart.get('peterbot'), 1800);
	assert.equal(depart.get('queasy'), 1500);
	assert.equal(horsClassement, 1450);
	const m = new MoteurLobby({ depart });
	const [fort, faible] = m.probasTop([['Peterbot', 'Pollo'], ['Queasy', 'Inconnu']], [1]);
	assert.ok(fort[1] > 0.6, `le duo du haut du classement est favori (${fort[1]})`);
	assert.ok(faible[1] < 0.4);
});

import { pseudosDepuisReponse } from '../src/lib/server/cotes/powerRankings.js';
test('Power Rankings : plusieurs formats de réponse', () => {
	assert.deepEqual(pseudosDepuisReponse([{ name: 'Pollo', rank: 2 }, { name: 'Peterbot', rank: 1 }]), ['Peterbot', 'Pollo']);
	assert.deepEqual(pseudosDepuisReponse({ data: [{ epicName: 'B', points: 10 }, { epicName: 'A', points: 50 }] }), ['A', 'B']);
	assert.deepEqual(pseudosDepuisReponse({ autre: 1 }), []);
});

import { lireParticipants, lireClassement } from '../src/lib/server/lobby-texte.js';

test('Participants collés : séparateurs, numéros, doublons', () => {
	const g = lireParticipants('1. Peterbot / Pollo\n\n#2 - Queasy + Merstach\nVeno, Th0masHD, Mero\nSolo');
	assert.deepEqual(g.map((x) => x.libelle), ['Peterbot / Pollo', 'Queasy / Merstach', 'Veno / Th0masHD / Mero', 'Solo']);
	assert.throws(() => lireParticipants('A / B\nB / C'), /deux groupes/);
	assert.throws(() => lireParticipants('A / B / C / D / E'), /4 au maximum/);
});

test('Classement collé : ordre, places explicites, joueur seul, lignes inconnues', () => {
	const p = [
		{ id: 1, libelle: 'Peterbot / Pollo', joueurs: ['Peterbot', 'Pollo'] },
		{ id: 2, libelle: 'Queasy / Merstach', joueurs: ['Queasy', 'Merstach'] },
		{ id: 3, libelle: 'Veno / Mero', joueurs: ['Veno', 'Mero'] }
	];
	const a = lireClassement('queasy / merstach\nPeterbot / Pollo', p);
	assert.deepEqual([...a.places], [[2, 1], [1, 2]]);
	assert.deepEqual(a.absents, ['Veno / Mero']);
	const b = lireClassement('3. Pollo\n1. Mero\nInconnu / Personne', p);
	assert.deepEqual([...b.places], [[1, 3], [3, 1]]);
	assert.deepEqual(b.inconnues, ['Inconnu / Personne']);
	assert.deepEqual(lireClassement('Peterbot\nPollo', p).inconnues, ['Pollo'], 'le même groupe deux fois');
});
