// Vérifie que le moteur JavaScript reproduit exactement le moteur Python
// (fichier généré par outils/moteur_cotes/exporter_parite.py).
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MoteurCotes, marchesSerie, cote, scoresSerie } from '../src/lib/server/cotes/moteur.js';

const cas = JSON.parse(readFileSync(new URL('./fixtures/parite-moteur.json', import.meta.url)));
const proche = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg} : ${a} au lieu de ${b}`);

test('mêmes prévisions que le moteur Python sur une ligue simulée de deux ans', () => {
	const moteur = new MoteurCotes();
	let avecH2h = 0;
	for (const [i, c] of cas.entries()) {
		const m = c.match;
		const prev = moteur.probaMap(m.equipe_a, m.equipe_b, m.roster_a, m.roster_b, m.jour);
		for (const cle of ['p_map', 'p_elo', 'correctif_h2h', 'note_a', 'note_b']) proche(prev[cle], c.prevision[cle], `match ${i}, ${cle}`);
		assert.equal(prev.maps_h2h, c.prevision.maps_h2h, `match ${i}, maps_h2h`);
		if (prev.maps_h2h > 0) avecH2h++;

		const marches = marchesSerie(prev.p_map, m.best_of);
		for (const [cle, v] of Object.entries(c.marches)) proche(marches[cle], v, `match ${i}, ${cle}`);
		assert.equal(cote(marches.victoire_A), c.cote_a, `match ${i}, cote`);
		assert.equal(cote(marches.victoire_A, 0.05), c.cote_a_marge, `match ${i}, cote avec marge`);
		moteur.enregistrer(m);
	}
	assert.ok(avecH2h > 50, 'le correctif des confrontations directes doit être exercé');
});

test('les scores possibles d’une série font 100 %', () => {
	for (const bo of [1, 3, 5, 7]) {
		const total = [...scoresSerie(0.62, bo).values()].reduce((s, v) => s + v, 0);
		proche(total, 1, `BO${bo}`);
	}
});
