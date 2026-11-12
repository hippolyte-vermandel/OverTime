// Moteur de cotes des épreuves en lobby (Fortnite, Warzone, TFT) : des dizaines de
// groupes (solo, duo, trio, quatuor) et un classement final, au lieu d'un duel.
//
// Principe :
// 1. Chaque JOUEUR a une note, sur la même échelle que l'Elo des matchs (1 500 au départ).
//    La note d'un groupe est la moyenne de celles de ses joueurs : un joueur qui change
//    de duo garde son niveau.
// 2. Après une épreuve, chaque groupe est comparé à tous les autres, comme une série de
//    duels : finir devant un groupe mieux noté rapporte beaucoup, devant un moins bien
//    noté rapporte peu. Le gain (ou la perte) du groupe est versé à chacun de ses joueurs.
// 3. Pour une épreuve à venir, on simule le classement un grand nombre de fois
//    (modèle de Plackett-Luce, cohérent avec l'Elo) et on compte combien de fois chaque
//    groupe finit dans le top X. Cote juste = 1 / probabilité.
// 4. Départ : 1 500 pour tous, ou une note tirée d'un classement pro (Power Rankings
//    de Fortnite Tracker) quand on l'a.

export const PARAMETRES_LOBBY = Object.freeze({
	noteInitiale: 1500,
	k: 32, // vitesse d'apprentissage, répartie sur tous les duels de l'épreuve
	tirages: 50000, // simulations d'une épreuve : environ ±0,3 point de pourcentage
	plafond: 100 // cote maximale affichée (un top 1 parmi 50 groupes peut dépasser 25)
});

/** Seuils de « top X » proposés selon le jeu, en ne gardant que ceux plus petits que le lobby */
export function seuilsPour(jeu, nbParticipants) {
	const seuils = jeu === 'tft' ? [4, 1] : [10, 3, 1];
	return seuils.filter((x) => x < nbParticipants);
}

const cle = (pseudo) => String(pseudo).trim().toLowerCase();
const probaElo = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));

// Générateur pseudo-aléatoire à graine (mulberry32) : mêmes cotes à chaque calcul
function aleatoire(graine) {
	let a = graine >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export class MoteurLobby {
	/**
	 * @param {{ depart?: Map<string, number>, params?: Partial<typeof PARAMETRES_LOBBY> }} [o]
	 * depart : note de départ de certains joueurs (classement pro), par pseudo en minuscules ;
	 * inconnu : note de départ des autres joueurs
	 */
	constructor({ depart = new Map(), inconnu, params = {} } = {}) {
		this.p = { ...PARAMETRES_LOBBY, ...params };
		this.depart = depart;
		this.inconnu = inconnu ?? this.p.noteInitiale;
		this.notes = new Map();
	}

	noteJoueur(pseudo) {
		const k = cle(pseudo);
		return this.notes.get(k) ?? this.depart.get(k) ?? this.inconnu;
	}

	noteGroupe(joueurs) {
		if (!joueurs.length) return this.p.noteInitiale;
		return joueurs.reduce((s, j) => s + this.noteJoueur(j), 0) / joueurs.length;
	}

	/**
	 * Met les notes à jour après une épreuve terminée.
	 * @param {{ joueurs: string[], place: number }[]} groupes (les groupes sans place sont ignorés)
	 */
	jouer(groupes) {
		const classes = groupes.filter((g) => Number.isInteger(g.place) && g.joueurs.length);
		const n = classes.length;
		if (n < 2) return;
		const notes = classes.map((g) => this.noteGroupe(g.joueurs));
		const ecarts = classes.map((g, i) => {
			let d = 0;
			for (let j = 0; j < n; j++) {
				if (i === j) continue;
				const s = g.place < classes[j].place ? 1 : g.place === classes[j].place ? 0.5 : 0;
				d += s - probaElo(notes[i], notes[j]);
			}
			return (this.p.k * d) / (n - 1);
		});
		classes.forEach((g, i) => {
			for (const j of g.joueurs) this.notes.set(cle(j), this.noteJoueur(j) + ecarts[i]);
		});
	}

	/**
	 * Probabilité que chaque groupe finisse dans le top X, pour chaque seuil.
	 * @param {string[][]} groupes les joueurs de chaque groupe
	 * @param {number[]} seuils ex. [10, 3, 1]
	 * @returns {Record<number, number>[]} pour chaque groupe : { 10: 0.21, 3: 0.06, 1: 0.02 }
	 */
	probasTop(groupes, seuils, graine = 1) {
		const n = groupes.length;
		const forces = groupes.map((g) => (this.noteGroupe(g) * Math.LN10) / 400); // log de la force
		const comptes = groupes.map(() => Object.fromEntries(seuils.map((x) => [x, 0])));
		const hasard = aleatoire(graine);
		const tirage = new Array(n);
		const ordre = [...Array(n).keys()];
		for (let t = 0; t < this.p.tirages; t++) {
			// Astuce de Gumbel : trier force + bruit de Gumbel donne un classement de Plackett-Luce
			for (let i = 0; i < n; i++) tirage[i] = forces[i] - Math.log(-Math.log(hasard() || Number.MIN_VALUE));
			ordre.sort((a, b) => tirage[b] - tirage[a]);
			for (let place = 0; place < n; place++) {
				const g = ordre[place];
				for (const x of seuils) if (place < x) comptes[g][x]++;
			}
		}
		// Lissage : aucune probabilité exactement nulle ou certaine
		return comptes.map((c) => Object.fromEntries(seuils.map((x) => [x, (c[x] + 0.5) / (this.p.tirages + 1)])));
	}
}

/**
 * Notes de départ tirées d'un classement pro : du 1er (1 800) au dernier classé (1 500).
 * Les joueurs absents du classement partent un peu en dessous (1 450) : s'ils étaient
 * au niveau des meilleurs, ils y figureraient.
 * @param {string[]} classement pseudos, du meilleur au moins bon
 * @returns {{ depart: Map<string, number>, horsClassement: number }} (horsClassement : à passer en « inconnu »)
 */
export function departDepuisClassement(classement) {
	const n = classement.length;
	const depart = new Map();
	classement.forEach((pseudo, i) => {
		if (!depart.has(cle(pseudo))) depart.set(cle(pseudo), 1500 + 300 * (n > 1 ? 1 - i / (n - 1) : 1));
	});
	return { depart, horsClassement: n ? 1450 : PARAMETRES_LOBBY.noteInitiale };
}
