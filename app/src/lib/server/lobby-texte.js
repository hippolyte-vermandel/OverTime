// Lecture des listes collées par l'admin pour les épreuves en lobby : participants
// (une ligne par groupe) et classement final. Sans base de données, testable seul.
import { ErreurSaisie } from './erreurs.js';

const TAILLE_MAX_GROUPE = 4;
const SEPARATEURS = /\s*(?:\/|\+|,|&|\|)\s*/;
const norm = (s) => String(s).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Liste de participants collée par l'admin : une ligne par groupe, joueurs séparés par
 * « / » (ou « + », « , », « & »). Les lignes vides sont ignorées.
 * @returns {{ libelle: string, joueurs: string[] }[]}
 */
export function lireParticipants(texte) {
	const groupes = [];
	const vus = new Set();
	String(texte ?? '').split(/\r?\n/).forEach((ligne, i) => {
		const propre = ligne.replace(/^\s*(?:#?\d+\s*[.)\-:]\s*)/, '').trim(); // « 1. », « #2 - » en tête
		if (!propre) return;
		const joueurs = propre.split(SEPARATEURS).map((j) => j.trim()).filter(Boolean);
		if (joueurs.length > TAILLE_MAX_GROUPE) throw new ErreurSaisie(`Ligne ${i + 1} : ${joueurs.length} joueurs, ${TAILLE_MAX_GROUPE} au maximum par groupe.`);
		for (const j of joueurs) {
			if (vus.has(norm(j))) throw new ErreurSaisie(`${j} apparaît dans deux groupes.`);
			vus.add(norm(j));
		}
		groupes.push({ libelle: joueurs.join(' / '), joueurs });
	});
	return groupes;
}

/**
 * Associe chaque ligne d'un classement collé à un participant. Une ligne peut commencer par
 * sa place (« 3. », « #3 ») ; sinon, l'ordre des lignes fait foi. Un groupe est reconnu par
 * son libellé, ou par un de ses joueurs s'il est seul à le contenir.
 * @param {string} texte
 * @param {{ id: number, libelle: string, joueurs: string[] }[]} participants
 * @returns {{ places: Map<number, number>, inconnues: string[], absents: string[] }}
 */
export function lireClassement(texte, participants) {
	const parLibelle = new Map(participants.map((p) => [norm(p.libelle), p]));
	const parJoueur = new Map();
	for (const p of participants) for (const j of p.joueurs) parJoueur.set(norm(j), parJoueur.has(norm(j)) ? null : p);
	const places = new Map();
	const inconnues = [];
	let rang = 0;
	for (const brute of String(texte ?? '').split(/\r?\n/)) {
		if (!brute.trim()) continue;
		rang++;
		const m = brute.match(/^\s*#?(\d+)\s*[.)\-:]\s*(.*)$/);
		const place = m ? Number(m[1]) : rang;
		const reste = (m ? m[2] : brute).trim();
		const noms = reste.split(SEPARATEURS).map(norm).filter(Boolean);
		const p = parLibelle.get(norm(reste)) ?? noms.map((n) => parJoueur.get(n)).find(Boolean) ?? null;
		if (!p || places.has(p.id)) inconnues.push(brute.trim());
		else places.set(p.id, place);
	}
	const absents = participants.filter((p) => !places.has(p.id)).map((p) => p.libelle);
	return { places, inconnues, absents };
}

