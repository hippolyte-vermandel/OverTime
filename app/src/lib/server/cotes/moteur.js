// Moteur de cotes d'OverTime : traduction fidèle de outils/moteur_cotes/moteur.py.
// Le test tests/moteur.test.js vérifie qu'il donne les mêmes chiffres que la version Python.
//
// Principe :
// 1. Chaque équipe a une note Elo, mise à jour après chaque map jouée.
// 2. Changement d'effectif ou longue pause : la note est rapprochée de la moyenne.
// 3. Les confrontations directes récentes donnent un LÉGER correctif,
//    seulement si les deux effectifs sont comparables.
// 4. De la probabilité de gagner une map, on déduit la série (BO3, BO5...), le score
//    exact et la présence de la dernière map, par combinatoire.
// 5. Cote = 1 / probabilité (moins une marge éventuelle).

export const PARAMETRES = Object.freeze({
	noteInitiale: 1500,
	k: 24, // vitesse d'apprentissage de l'Elo
	retourParJoueur: 0.15, // part de la note « oubliée » par joueur changé
	pauseJours: 45, // au-delà : nouvelle saison
	retourPause: 0.25, // part de la note « oubliée » après une pause
	h2hFenetreJours: 365, // confrontations de l'année écoulée seulement
	h2hJoueursCommuns: 3, // effectif comparable si au moins 3 joueurs en commun
	h2hPrudence: 20, // plus c'est grand, plus le correctif est léger
	h2hPlafond: 0.05 // correctif maximum : ± 5 points de pourcentage
});

const JOUR_MS = 86_400_000;
/** Nombre de jours entre deux dates « AAAA-MM-JJ » (comme date - date en Python) */
const ecartJours = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / JOUR_MS);

/** Probabilité que A gagne une map, selon l'écart des notes Elo */
export function probaElo(noteA, noteB) {
	return 1 / (1 + 10 ** ((noteB - noteA) / 400));
}

export function joueursCommuns(r1, r2) {
	const s = new Set(r2);
	return new Set(r1.filter((j) => s.has(j))).size;
}

export class MoteurCotes {
	constructor(params = PARAMETRES) {
		this.p = { ...PARAMETRES, ...params };
		this.notes = new Map();
		this.dernierRoster = new Map();
		this.dernierMatch = new Map();
		/** @type {{ jour: string, gagnant: string, perdant: string, probaPrevueGagnant: number, rosterGagnant: string[], rosterPerdant: string[] }[]} */
		this.historique = [];
	}

	// Prépare une équipe avant un match : pause et changements d'effectif
	_preparer(equipe, roster, jour) {
		const p = this.p;
		const moyenne = p.noteInitiale;
		if (!this.notes.has(equipe)) {
			this.notes.set(equipe, moyenne);
		} else {
			let note = this.notes.get(equipe);
			const pause = ecartJours(jour, this.dernierMatch.get(equipe));
			if (pause > p.pauseJours) note = moyenne + (note - moyenne) * (1 - p.retourPause);
			const changes = roster.length - joueursCommuns(roster, this.dernierRoster.get(equipe));
			if (changes > 0) {
				const oubli = Math.min(1, p.retourParJoueur * changes);
				note = moyenne + (note - moyenne) * (1 - oubli);
			}
			this.notes.set(equipe, note);
		}
		this.dernierRoster.set(equipe, [...roster]);
		this.dernierMatch.set(equipe, jour);
	}

	/**
	 * Compare ce qui s'est passé entre A et B à ce que l'Elo prévoyait alors.
	 * Correctif limité aux maps récentes avec effectifs comparables, amorti par n / (n + prudence), plafonné.
	 */
	correctifH2h(a, b, rosterA, rosterB, jour) {
		const p = this.p;
		const ecarts = [];
		for (const h of this.historique) {
			if (ecartJours(jour, h.jour) > p.h2hFenetreJours) continue;
			const paire = new Set([h.gagnant, h.perdant]);
			if (paire.size !== 2 || !paire.has(a) || !paire.has(b)) continue;
			const [ra, rb] = h.gagnant === a ? [h.rosterGagnant, h.rosterPerdant] : [h.rosterPerdant, h.rosterGagnant];
			if (joueursCommuns(ra, rosterA) < p.h2hJoueursCommuns || joueursCommuns(rb, rosterB) < p.h2hJoueursCommuns) continue;
			const prevuA = h.gagnant === a ? h.probaPrevueGagnant : 1 - h.probaPrevueGagnant;
			const reelA = h.gagnant === a ? 1 : 0;
			ecarts.push(reelA - prevuA);
		}
		const n = ecarts.length;
		if (n === 0) return { correctif: 0, n: 0 };
		const poids = n / (n + p.h2hPrudence);
		let correctif = poids * (ecarts.reduce((s, e) => s + e, 0) / n);
		correctif = Math.max(-p.h2hPlafond, Math.min(p.h2hPlafond, correctif));
		return { correctif, n };
	}

	/** Probabilité que A gagne une map contre B, avec le détail du calcul (sans modifier l'état) */
	probaMap(a, b, rosterA, rosterB, jour, avecH2h = true) {
		const notes = {};
		for (const [eq, ro] of [
			[a, rosterA],
			[b, rosterB]
		]) {
			const sauvegarde = this.notes.has(eq) ? [this.notes.get(eq), this.dernierRoster.get(eq), this.dernierMatch.get(eq)] : null;
			this._preparer(eq, ro, jour);
			notes[eq] = this.notes.get(eq);
			if (sauvegarde === null) {
				this.notes.delete(eq);
				this.dernierRoster.delete(eq);
				this.dernierMatch.delete(eq);
			} else {
				this.notes.set(eq, sauvegarde[0]);
				this.dernierRoster.set(eq, sauvegarde[1]);
				this.dernierMatch.set(eq, sauvegarde[2]);
			}
		}
		const pElo = probaElo(notes[a], notes[b]);
		const { correctif, n } = avecH2h ? this.correctifH2h(a, b, rosterA, rosterB, jour) : { correctif: 0, n: 0 };
		const pMap = Math.min(0.97, Math.max(0.03, pElo + correctif));
		return { p_map: pMap, p_elo: pElo, correctif_h2h: correctif, maps_h2h: n, note_a: notes[a], note_b: notes[b] };
	}

	/**
	 * Met à jour les notes après une série terminée, map par map.
	 * @param {{ jour: string, equipe_a: string, equipe_b: string, maps_a: number, maps_b: number, roster_a: string[], roster_b: string[] }} m
	 */
	enregistrer(m) {
		this._preparer(m.equipe_a, m.roster_a, m.jour);
		this._preparer(m.equipe_b, m.roster_b, m.jour);
		const k = this.p.k;
		// L'ordre exact des maps n'est pas toujours connu : on alterne
		const resultats = [];
		let wa = m.maps_a;
		let wb = m.maps_b;
		while (wa || wb) {
			if (wa) {
				resultats.push(m.equipe_a);
				wa--;
			}
			if (wb) {
				resultats.push(m.equipe_b);
				wb--;
			}
		}
		for (const gagnant of resultats) {
			const perdant = gagnant === m.equipe_a ? m.equipe_b : m.equipe_a;
			const p = probaElo(this.notes.get(gagnant), this.notes.get(perdant));
			this.historique.push({
				jour: m.jour,
				gagnant,
				perdant,
				probaPrevueGagnant: p,
				rosterGagnant: gagnant === m.equipe_a ? m.roster_a : m.roster_b,
				rosterPerdant: gagnant === m.equipe_a ? m.roster_b : m.roster_a
			});
			this.notes.set(gagnant, this.notes.get(gagnant) + k * (1 - p));
			this.notes.set(perdant, this.notes.get(perdant) - k * (1 - p));
		}
	}
}

const combinaisons = (n, k) => {
	let r = 1;
	for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
	return Math.round(r);
};

/**
 * Probabilité de chaque score final d'une série, A gagnant chaque map avec la probabilité p.
 * @returns {Map<string, number>} clés « 3-1 » du point de vue de A
 */
export function scoresSerie(p, bestOf) {
	const gagne = Math.floor(bestOf / 2) + 1;
	const q = 1 - p;
	const res = new Map();
	for (let perdues = 0; perdues < gagne; perdues++) {
		const nb = combinaisons(gagne - 1 + perdues, perdues);
		res.set(`${gagne}-${perdues}`, nb * p ** gagne * q ** perdues);
		res.set(`${perdues}-${gagne}`, nb * q ** gagne * p ** perdues);
	}
	return res;
}

/** Probabilités des paris classiques sur une série (mêmes clés que la version Python) */
export function marchesSerie(p, bestOf) {
	const sc = scoresSerie(p, bestOf);
	const gagne = Math.floor(bestOf / 2) + 1;
	const marches = { victoire_A: 0, victoire_B: 0 };
	for (const [score, v] of sc) {
		const [a, b] = score.split('-').map(Number);
		if (a === gagne) marches.victoire_A += v;
		if (b === gagne) marches.victoire_B += v;
	}
	for (const [score, v] of sc) marches[`score_${score}`] = v;
	if (bestOf > 1) {
		let derniere = 0;
		for (const [score, v] of sc) {
			const [a, b] = score.split('-').map(Number);
			if (a + b === bestOf) derniere += v;
		}
		marches[`map_${bestOf}_jouee`] = derniere;
	}
	return marches;
}

/** Arrondi à 2 décimales comme round() de Python (au pair le plus proche sur les vraies égalités) */
function arrondi2(x) {
	const v = x * 100;
	const r = Math.round(v);
	if (Math.abs(v - Math.trunc(v)) === 0.5) return (r % 2 === 0 ? r : r - 1) / 100;
	return r / 100;
}

/** Cote décimale. Sans marge, cote = 1/p (pari juste). */
export function cote(p, marge = 0, plafond = 25) {
	if (p <= 0) return plafond;
	return arrondi2(Math.max(1.01, Math.min(plafond, 1 / (p * (1 + marge)))));
}
