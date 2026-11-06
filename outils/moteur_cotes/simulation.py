"""
Ligue fictive pour tester le moteur de cotes.

Intérêt : dans un monde simulé, on connaît la VRAIE probabilité de chaque
map. On peut donc vérifier si les cotes calculées s'en approchent, ce qui est
impossible avec des données réelles (où la "vraie" probabilité est inconnue).

Le monde simulé imite grossièrement une ligue type LEC :
- 10 équipes, 5 joueurs chacune, un vivier de joueurs qui circulent ;
- deux splits par an, ligue en BO1 puis phase finale en BO3/BO5 ;
- des transferts entre splits (plus nombreux à l'intersaison) ;
- un niveau individuel qui évolue lentement ;
- un petit effet de "style" propre à chaque paire d'équipes, que seul
  l'historique des confrontations directes peut révéler ;
- des kills par joueur et par map, pour tester les paris sur statistiques.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import date, timedelta

from moteur import Match

EQUIPES = ["Corbeaux de Lille", "Lynx Rouges", "Hydre", "Astrolabe",
           "Mistral", "Basilic", "Les Faucheurs", "Nébuleuse",
           "Orque Noir", "Sirocco"]

ECHELLE = 1.6          # écart de niveau -> probabilité (échelle logistique)
STYLE_ECART_TYPE = 0.25  # amplitude de l'effet "style" entre deux équipes


@dataclass
class MapSimulee:
    jour: date
    equipe_a: str
    equipe_b: str
    proba_vraie_a: float
    gagnant: str
    kills: dict          # joueur -> kills sur la map


def _logistique(x: float) -> float:
    return 1 / (1 + math.exp(-x))


class Ligue:
    def __init__(self, graine: int = 7):
        self.rng = random.Random(graine)
        r = self.rng
        self.niveau = {f"J{i:03d}": r.gauss(0, 1.0) for i in range(90)}
        self.agressivite = {j: r.uniform(1.5, 4.5) for j in self.niveau}
        libres = list(self.niveau)
        r.shuffle(libres)
        self.roster = {e: tuple(libres[i * 5:(i + 1) * 5]) for i, e in enumerate(EQUIPES)}
        self.libres = libres[50:]
        self.style = {}
        for i, a in enumerate(EQUIPES):
            for b in EQUIPES[i + 1:]:
                s = r.gauss(0, STYLE_ECART_TYPE)
                self.style[(a, b)], self.style[(b, a)] = s, -s
        self.matchs: list[Match] = []
        self.maps: list[MapSimulee] = []
        self.maps_par_match: list[list[MapSimulee]] = []

    # -- dynamique du monde ------------------------------------------------

    def force(self, equipe: str) -> float:
        return sum(self.niveau[j] for j in self.roster[equipe]) / 5

    def proba_vraie(self, a: str, b: str) -> float:
        return _logistique(ECHELLE * (self.force(a) - self.force(b)) + self.style[(a, b)])

    def evolution(self) -> None:
        for j in self.niveau:
            self.niveau[j] += self.rng.gauss(0, 0.12)

    def transferts(self, intensite: float) -> None:
        """Chaque joueur titulaire a une probabilité `intensite` de partir."""
        r = self.rng
        for e in EQUIPES:
            roster = list(self.roster[e])
            for i in range(5):
                if r.random() < intensite:
                    # on recrute plutôt parmi les meilleurs libres
                    r.shuffle(self.libres)
                    candidats = sorted(self.libres[:6], key=self.niveau.get, reverse=True)
                    nouveau = candidats[0]
                    self.libres.remove(nouveau)
                    self.libres.append(roster[i])
                    roster[i] = nouveau
            self.roster[e] = tuple(roster)
        # Un changement massif efface en partie le "style" de la paire
        # (on garde l'effet simple : il reste, c'est le pire cas pour le H2H).

    # -- jouer -------------------------------------------------------------

    def jouer_serie(self, jour: date, a: str, b: str, best_of: int) -> None:
        r = self.rng
        gagne = best_of // 2 + 1
        wa = wb = 0
        debut_maps = len(self.maps)
        while wa < gagne and wb < gagne:
            p = self.proba_vraie(a, b)
            gagnant = a if r.random() < p else b
            wa += gagnant == a
            wb += gagnant == b
            kills = {}
            for eq in (a, b):
                bonus = 1.35 if eq == gagnant else 0.7
                for j in self.roster[eq]:
                    lam = self.agressivite[j] * bonus
                    # tirage de Poisson
                    k, seuil, prod = 0, math.exp(-lam), r.random()
                    while prod > seuil:
                        k += 1
                        prod *= r.random()
                    kills[j] = k
            self.maps.append(MapSimulee(jour, a, b, p, gagnant, kills))
        self.matchs.append(Match(jour, a, b, best_of, wa, wb,
                                 self.roster[a], self.roster[b]))
        self.maps_par_match.append(self.maps[debut_maps:])

    def jouer_split(self, debut: date) -> date:
        """Double aller-retour en BO1 sur 9 semaines, puis phase finale."""
        r = self.rng
        paires = [(a, b) for i, a in enumerate(EQUIPES) for b in EQUIPES[i + 1:]]
        jour = debut
        victoires = {e: 0 for e in EQUIPES}
        for manche in range(2):
            r.shuffle(paires)
            for i, (a, b) in enumerate(paires):
                if i % 10 == 0 and (i or manche):
                    jour += timedelta(days=7 if i % 20 == 0 else 1)
                    self.evolution() if i % 20 == 0 else None
                self.jouer_serie(jour, a, b, 1)
                m = self.matchs[-1]
                victoires[a if m.maps_a else b] += 1
        # Phase finale : top 6, quarts en BO3, demies et finale en BO5
        top = sorted(EQUIPES, key=victoires.get, reverse=True)[:6]
        jour += timedelta(days=7)
        qualifies = top[:2]
        for a, b in ((top[2], top[5]), (top[3], top[4])):
            self.jouer_serie(jour, a, b, 3)
            m = self.matchs[-1]
            qualifies.append(a if m.maps_a > m.maps_b else b)
        jour += timedelta(days=7)
        finalistes = []
        for a, b in ((qualifies[0], qualifies[3]), (qualifies[1], qualifies[2])):
            self.jouer_serie(jour, a, b, 5)
            m = self.matchs[-1]
            finalistes.append(a if m.maps_a > m.maps_b else b)
        jour += timedelta(days=7)
        self.jouer_serie(jour, finalistes[0], finalistes[1], 5)
        return jour

    def jouer_annees(self, annees: int = 4, debut: date = date(2022, 1, 15)) -> None:
        jour = debut
        for an in range(annees):
            jour = self.jouer_split(date(debut.year + an, 1, 15))
            self.transferts(0.08)          # petit mercato de mi-saison
            jour = self.jouer_split(date(debut.year + an, 6, 10))
            self.transferts(0.25)          # gros mercato d'intersaison
