// Chaîne d'import commune à toutes les sources automatiques (Leaguepedia, Liquipedia...).
// Chaque source traduit ses données en « matchs normalisés » ; ce module les range dans la base :
//   - un match à venir inconnu    -> créé avec ses paris et des cotes du moteur ;
//   - un match terminé inconnu    -> enregistré dans l'historique (il nourrit le moteur) ;
//   - un match connu qui se termine -> résultat validé, paris payés ;
//   - un match connu déplacé       -> nouvelle heure, ou annulé s'il est reporté de plus de 48 h.
// L'identifiant de la source est gardé dans identifiant_externe : relancer l'import ne crée
// jamais de doublon, on peut donc le lancer toutes les heures sans risque.
import { requete } from '../db.js';
import { creerMatch, enregistrerMatchPasse, validerResultat, annulerMatch } from '../admin.js';
import { equipeConnue, scoreValide } from './outils.js';

/**
 * @typedef {{
 *   id: string,            // identifiant du match chez la source
 *   jeu: string,           // code du jeu chez nous : 'lol', 'valorant'...
 *   competition: string, region: string, phase: string,
 *   quand: Date, bestOf: number,
 *   equipeA: string, equipeB: string,
 *   termine: boolean, scoreA: number | null, scoreB: number | null,
 *   annule: boolean
 * }} MatchNormalise
 */

const CINQ_MINUTES = 5 * 60 * 1000;
const QUARANTE_HUIT_HEURES = 48 * 60 * 60 * 1000;

/** Garantit que la source (avec sa licence, pour l'attribution) et ses jeux existent */
export async function preparerSource(source, jeux) {
	await requete(`INSERT INTO source (code, nom, licence) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`, [source.code, source.nom, source.licence]);
	for (const jeu of jeux) await requete(`INSERT INTO jeu (code, nom, format) VALUES ($1, $2, 'equipes') ON CONFLICT (code) DO NOTHING`, [jeu.code, jeu.nom]);
	const [s] = await requete('SELECT id FROM source WHERE code = $1', [source.code]);
	return s.id;
}

async function serieConnue(sourceId, idExterne) {
	const [r] = await requete(
		`SELECT s.id, s.statut, s.date_prevue, s.resultat_valide,
		        EXISTS (SELECT 1 FROM marche m WHERE m.serie_id = s.id AND m.type = 'vainqueur'
		                   AND m.partie_numero IS NULL AND m.statut NOT IN ('regle', 'annule')) AS a_regler
		   FROM identifiant_externe ie JOIN serie s ON s.id = ie.id_interne
		  WHERE ie.source_id = $1 AND ie.type_entite = 'serie' AND ie.id_externe = $2`,
		[sourceId, idExterne]
	);
	return r ?? null;
}

const noter = (sourceId, idExterne, serieId) =>
	requete(
		`INSERT INTO identifiant_externe (source_id, type_entite, id_externe, id_interne) VALUES ($1, 'serie', $2, $3)
		 ON CONFLICT (source_id, type_entite, id_externe) DO UPDATE SET id_interne = EXCLUDED.id_interne, importe_le = now()`,
		[sourceId, idExterne, serieId]
	);

/**
 * Range une liste de matchs normalisés dans la base. Chaque match est traité à part :
 * une erreur sur l'un n'empêche pas les autres.
 * @param {number} sourceId
 * @param {MatchNormalise[]} matchs
 * @param {Date} [maintenant]
 */
export async function rangerMatchs(sourceId, matchs, maintenant = new Date()) {
	const bilan = { crees: 0, historique: 0, resultats: 0, deplaces: 0, annules: 0, ignores: 0, erreurs: /** @type {string[]} */ ([]) };
	// Du plus ancien au plus récent : l'historique est en place avant le calcul des cotes
	const tries = [...matchs].sort((x, y) => x.quand.getTime() - y.quand.getTime());

	for (const m of tries) {
		const nom = `${m.equipeA} contre ${m.equipeB} (${m.competition})`;
		try {
			const connue = await serieConnue(sourceId, m.id);

			if (connue) {
				if (connue.statut !== 'programmee' || !connue.a_regler) continue; // déjà réglé ou annulé
				if (m.annule) {
					await annulerMatch(connue.id);
					bilan.annules++;
				} else if (m.termine) {
					if (!scoreValide(m.bestOf, m.scoreA, m.scoreB)) {
						bilan.ignores++;
						continue; // score incomplet ou forfait : l'admin le valide à la main
					}
					if (m.quand < connue.date_prevue) {
						// Joué plus tôt que prévu : les paris se ferment à l'heure réelle du match
						await requete('UPDATE serie SET date_prevue = $2 WHERE id = $1', [connue.id, m.quand]);
						await requete(`UPDATE marche SET ferme_le = $2 WHERE serie_id = $1 AND ferme_le > $2`, [connue.id, m.quand]);
					}
					await validerResultat(connue.id, m.scoreA, m.scoreB);
					bilan.resultats++;
				} else if (Math.abs(m.quand.getTime() - connue.date_prevue.getTime()) > 60_000 && connue.date_prevue > maintenant) {
					if (m.quand.getTime() - connue.date_prevue.getTime() > QUARANTE_HUIT_HEURES) {
						// Règle de la ligue : reporté de plus de 48 h = annulé, mises remboursées.
						// Le lien est oublié : le match revient au prochain import, à sa nouvelle date.
						await annulerMatch(connue.id);
						await requete(`DELETE FROM identifiant_externe WHERE source_id = $1 AND type_entite = 'serie' AND id_externe = $2`, [sourceId, m.id]);
						bilan.annules++;
					} else {
						await requete('UPDATE serie SET date_prevue = $2 WHERE id = $1', [connue.id, m.quand]);
						await requete(`UPDATE marche SET ferme_le = $2 WHERE serie_id = $1 AND statut = 'ouvert'`, [connue.id, m.quand]);
						bilan.deplaces++;
					}
				}
				continue;
			}

			// Match encore inconnu
			if (m.annule || !equipeConnue(m.equipeA) || !equipeConnue(m.equipeB) || m.equipeA === m.equipeB) {
				bilan.ignores++;
				continue;
			}
			const base = { jeu: m.jeu, competition: m.competition, region: m.region, phase: m.phase, quand: m.quand, bestOf: m.bestOf, equipeA: m.equipeA, equipeB: m.equipeB };
			if (m.termine) {
				if (!scoreValide(m.bestOf, m.scoreA, m.scoreB) || m.quand > maintenant) {
					bilan.ignores++;
					continue;
				}
				await noter(sourceId, m.id, await enregistrerMatchPasse({ ...base, scoreA: m.scoreA, scoreB: m.scoreB }));
				bilan.historique++;
			} else if (m.quand.getTime() > maintenant.getTime() + CINQ_MINUTES) {
				const { serieId } = await creerMatch(base);
				await noter(sourceId, m.id, serieId);
				bilan.crees++;
			} else {
				bilan.ignores++; // déjà commencé : trop tard pour ouvrir les paris
			}
		} catch (e) {
			bilan.erreurs.push(`${nom} : ${e.message}`);
		}
	}
	return bilan;
}

/** Résumé lisible d'un bilan d'import */
export function resumer(nom, b) {
	const parts = [];
	if (b.crees) parts.push(`${b.crees} match${b.crees > 1 ? 's' : ''} ouvert${b.crees > 1 ? 's' : ''} aux paris`);
	if (b.resultats) parts.push(`${b.resultats} résultat${b.resultats > 1 ? 's' : ''} validé${b.resultats > 1 ? 's' : ''}`);
	if (b.historique) parts.push(`${b.historique} match${b.historique > 1 ? 's' : ''} passé${b.historique > 1 ? 's' : ''} ajouté${b.historique > 1 ? 's' : ''} à l’historique`);
	if (b.deplaces) parts.push(`${b.deplaces} horaire${b.deplaces > 1 ? 's' : ''} mis à jour`);
	if (b.annules) parts.push(`${b.annules} match${b.annules > 1 ? 's' : ''} annulé${b.annules > 1 ? 's' : ''}`);
	const texte = parts.length ? parts.join(', ') : 'rien de nouveau';
	return `${nom} : ${texte}.${b.erreurs.length ? ` ${b.erreurs.length} erreur${b.erreurs.length > 1 ? 's' : ''} (voir la console du serveur).` : ''}`;
}
