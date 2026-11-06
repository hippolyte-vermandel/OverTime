"""
Moteur de cotes pour une application de pronostics e-sport entre amis.

Principe général
----------------
1. Chaque équipe a une note Elo. Après chaque map jouée, le gagnant prend
   des points au perdant, d'autant plus que la victoire était inattendue.
2. Quand une équipe change de joueurs, sa note est rapprochée de la moyenne
   (on sait moins bien ce qu'elle vaut). Idem après une longue pause.
3. Les confrontations directes récentes servent de LÉGER correctif, et
   seulement si les deux effectifs n'ont pas trop changé depuis.
4. De la probabilité de gagner UNE map, on déduit tout le reste :
   victoire en BO3 / BO5, score exact, présence d'une map 5...
5. Une cote n'est qu'une probabilité retournée : cote = 1 / p
   (moins une éventuelle marge).

Le module ne dépend que de la bibliothèque standard Python.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date


# ---------------------------------------------------------------------------
# Structures de données
# ---------------------------------------------------------------------------

@dataclass
class Match:
    """Une série entre deux équipes (BO1, BO3 ou BO5)."""
    jour: date
    equipe_a: str
    equipe_b: str
    best_of: int
    maps_a: int            # maps gagnées par A
    maps_b: int            # maps gagnées par B
    roster_a: tuple        # noms des joueurs alignés par A
    roster_b: tuple


@dataclass
class Parametres:
    note_initiale: float = 1500.0
    k: float = 24.0                 # vitesse d'apprentissage de l'Elo
    retour_par_joueur: float = 0.15  # part de la note "oubliée" par joueur changé
    pause_jours: int = 45           # au-delà : on considère une nouvelle saison
    retour_pause: float = 0.25      # part de la note "oubliée" après une pause
    # Confrontations directes
    h2h_fenetre_jours: int = 365    # on ne regarde que l'année écoulée
    h2h_joueurs_communs: int = 3    # effectif "comparable" si >= 3 joueurs sur 5
    h2h_prudence: float = 20.0      # plus c'est grand, plus le correctif est léger
    h2h_plafond: float = 0.05       # correctif max : +/- 5 points de pourcentage


# ---------------------------------------------------------------------------
# Outils mathématiques
# ---------------------------------------------------------------------------

def proba_elo(note_a: float, note_b: float) -> float:
    """Probabilité que A gagne une map, selon l'écart de notes Elo."""
    return 1.0 / (1.0 + 10 ** ((note_b - note_a) / 400.0))


def joueurs_communs(r1: tuple, r2: tuple) -> int:
    return len(set(r1) & set(r2))


# ---------------------------------------------------------------------------
# Le moteur
# ---------------------------------------------------------------------------

@dataclass
class _Historique:
    """Une map passée entre deux équipes, avec ce que l'Elo prévoyait alors."""
    jour: date
    gagnant: str
    perdant: str
    proba_prevue_gagnant: float
    roster_gagnant: tuple
    roster_perdant: tuple


@dataclass
class MoteurCotes:
    params: Parametres = field(default_factory=Parametres)
    notes: dict = field(default_factory=dict)
    dernier_roster: dict = field(default_factory=dict)
    dernier_match: dict = field(default_factory=dict)
    historique: list = field(default_factory=list)

    # --- Préparation d'une équipe avant un match --------------------------

    def _preparer(self, equipe: str, roster: tuple, jour: date) -> None:
        p = self.params
        moyenne = p.note_initiale
        if equipe not in self.notes:
            self.notes[equipe] = moyenne
        else:
            note = self.notes[equipe]
            # Longue pause : retour partiel vers la moyenne
            pause = (jour - self.dernier_match[equipe]).days
            if pause > p.pause_jours:
                note = moyenne + (note - moyenne) * (1 - p.retour_pause)
            # Changement d'effectif : retour proportionnel au nombre de départs
            changes = len(roster) - joueurs_communs(roster, self.dernier_roster[equipe])
            if changes > 0:
                oubli = min(1.0, p.retour_par_joueur * changes)
                note = moyenne + (note - moyenne) * (1 - oubli)
            self.notes[equipe] = note
        self.dernier_roster[equipe] = tuple(roster)
        self.dernier_match[equipe] = jour

    # --- Correctif des confrontations directes ----------------------------

    def correctif_h2h(self, a: str, b: str, roster_a: tuple, roster_b: tuple,
                      jour: date) -> tuple[float, int]:
        """
        Compare ce qui s'est réellement passé entre A et B à ce que l'Elo
        prévoyait à l'époque. Si A a "surperformé" contre B, on remonte un peu
        sa probabilité. Le correctif est :
          - limité aux maps récentes avec des effectifs comparables,
          - amorti par le nombre de maps (n / (n + prudence)),
          - plafonné.
        Renvoie (correctif, nombre de maps prises en compte).
        """
        p = self.params
        ecarts = []
        for h in self.historique:
            if (jour - h.jour).days > p.h2h_fenetre_jours:
                continue
            if {h.gagnant, h.perdant} != {a, b}:
                continue
            ra, rb = ((h.roster_gagnant, h.roster_perdant) if h.gagnant == a
                      else (h.roster_perdant, h.roster_gagnant))
            if (joueurs_communs(ra, roster_a) < p.h2h_joueurs_communs or
                    joueurs_communs(rb, roster_b) < p.h2h_joueurs_communs):
                continue
            # Écart du point de vue de A : résultat (1 ou 0) moins prévision
            prevu_a = h.proba_prevue_gagnant if h.gagnant == a else 1 - h.proba_prevue_gagnant
            reel_a = 1.0 if h.gagnant == a else 0.0
            ecarts.append(reel_a - prevu_a)
        n = len(ecarts)
        if n == 0:
            return 0.0, 0
        poids = n / (n + p.h2h_prudence)
        correctif = poids * (sum(ecarts) / n)
        correctif = max(-p.h2h_plafond, min(p.h2h_plafond, correctif))
        return correctif, n

    # --- Prévision ---------------------------------------------------------

    def proba_map(self, a: str, b: str, roster_a: tuple, roster_b: tuple,
                  jour: date, avec_h2h: bool = True) -> dict:
        """Probabilité que A gagne une map contre B, avec le détail du calcul."""
        # On travaille sur une copie pour ne pas modifier l'état réel
        notes = {}
        for eq, ro in ((a, roster_a), (b, roster_b)):
            sauvegarde = (self.notes.get(eq), self.dernier_roster.get(eq),
                          self.dernier_match.get(eq))
            self._preparer(eq, ro, jour)
            notes[eq] = self.notes[eq]
            # restauration
            if sauvegarde[0] is None:
                del self.notes[eq], self.dernier_roster[eq], self.dernier_match[eq]
            else:
                self.notes[eq], self.dernier_roster[eq], self.dernier_match[eq] = sauvegarde
        p_elo = proba_elo(notes[a], notes[b])
        corr, n = (self.correctif_h2h(a, b, roster_a, roster_b, jour)
                   if avec_h2h else (0.0, 0))
        p = min(0.97, max(0.03, p_elo + corr))
        return {"p_map": p, "p_elo": p_elo, "correctif_h2h": corr,
                "maps_h2h": n, "note_a": notes[a], "note_b": notes[b]}

    # --- Apprentissage à partir d'un résultat -----------------------------

    def enregistrer(self, m: Match) -> None:
        """Met à jour les notes après une série terminée (map par map)."""
        self._preparer(m.equipe_a, m.roster_a, m.jour)
        self._preparer(m.equipe_b, m.roster_b, m.jour)
        k = self.params.k
        # L'ordre exact des maps n'est pas toujours connu : on alterne,
        # ce qui évite de biaiser la mise à jour.
        resultats = []
        wa, wb = m.maps_a, m.maps_b
        while wa or wb:
            if wa:
                resultats.append(m.equipe_a); wa -= 1
            if wb:
                resultats.append(m.equipe_b); wb -= 1
        for gagnant in resultats:
            perdant = m.equipe_b if gagnant == m.equipe_a else m.equipe_a
            p = proba_elo(self.notes[gagnant], self.notes[perdant])
            self.historique.append(_Historique(
                m.jour, gagnant, perdant, p,
                m.roster_a if gagnant == m.equipe_a else m.roster_b,
                m.roster_b if gagnant == m.equipe_a else m.roster_a))
            self.notes[gagnant] += k * (1 - p)
            self.notes[perdant] -= k * (1 - p)


# ---------------------------------------------------------------------------
# Des maps aux séries : calcul exact par combinatoire
# ---------------------------------------------------------------------------

def scores_serie(p: float, best_of: int) -> dict:
    """
    Probabilité de chaque score final d'une série, sachant que A gagne
    chaque map avec la probabilité p (maps supposées indépendantes).
    Exemple BO5 : {(3,0): .., (3,1): .., (3,2): .., (0,3): .., ...}
    """
    gagne = best_of // 2 + 1
    q = 1 - p
    res = {}
    for perdues in range(gagne):
        # A gagne la dernière map, et en avait gagné (gagne-1) parmi les précédentes
        nb = math.comb(gagne - 1 + perdues, perdues)
        res[(gagne, perdues)] = nb * p ** gagne * q ** perdues
        res[(perdues, gagne)] = nb * q ** gagne * p ** perdues
    return res


def marches_serie(p: float, best_of: int) -> dict:
    """Probabilités des paris classiques sur une série."""
    sc = scores_serie(p, best_of)
    gagne = best_of // 2 + 1
    marches = {
        "victoire_A": sum(v for (a, b), v in sc.items() if a == gagne),
        "victoire_B": sum(v for (a, b), v in sc.items() if b == gagne),
    }
    for (a, b), v in sc.items():
        marches[f"score_{a}-{b}"] = v
    if best_of > 1:
        # Derniere map jouee = toutes les maps possibles
        marches[f"map_{best_of}_jouee"] = sum(
            v for (a, b), v in sc.items() if a + b == best_of)
    return marches


# ---------------------------------------------------------------------------
# Paris sur statistiques (kills, drakes, dégâts...)
# ---------------------------------------------------------------------------

def _poisson_cdf(k: int, lam: float) -> float:
    """P(X <= k) pour une loi de Poisson de moyenne lam."""
    terme, total = math.exp(-lam), 0.0
    for i in range(k + 1):
        if i > 0:
            terme *= lam / i
        total += terme
    return total


def marche_plus_moins(valeurs_recentes: list[float]) -> dict:
    """
    Pari "plus ou moins de X" sur une statistique de comptage (kills, drakes).
    La ligne est placée à la médiane récente (+0,5 pour éviter l'égalité),
    puis les probabilités sont estimées avec une loi de Poisson de même
    moyenne, plus stable qu'un simple comptage sur peu de matchs.
    Pour une statistique continue comme les dégâts, on garderait la médiane
    comme ligne et on fixerait p = 0,5 de chaque côté.
    """
    if len(valeurs_recentes) < 5:
        raise ValueError("Pas assez d'historique pour proposer ce pari")
    tri = sorted(valeurs_recentes)
    mediane = tri[len(tri) // 2]
    ligne = math.floor(mediane) + 0.5
    moyenne = sum(valeurs_recentes) / len(valeurs_recentes)
    p_moins = _poisson_cdf(int(ligne - 0.5), moyenne)
    return {"ligne": ligne, "plus": 1 - p_moins, "moins": p_moins,
            "moyenne": moyenne}


# ---------------------------------------------------------------------------
# Des probabilités aux cotes
# ---------------------------------------------------------------------------

def cote(p: float, marge: float = 0.0, plafond: float = 25.0) -> float:
    """
    Cote décimale. Sans marge, cote = 1/p (pari "juste").
    Avec une marge de 5 %, toutes les cotes sont un peu réduites,
    ce qui empêche de gagner mécaniquement en pariant sur tout.
    """
    if p <= 0:
        return plafond
    return round(max(1.01, min(plafond, 1.0 / (p * (1 + marge)))), 2)
