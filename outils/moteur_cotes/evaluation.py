"""
Évaluation du moteur de cotes sur la ligue fictive.

Méthode "walk-forward" (comme dans la vraie vie) : pour chaque match, on
calcule d'abord la prévision avec ce que l'on savait AVANT, puis on
enregistre le résultat. Aucune information du futur ne fuit.

Deux mesures d'erreur (plus c'est bas, mieux c'est) :
- Brier : moyenne de (probabilité annoncée - résultat)^2 ; 0,25 = pile ou face.
- Log loss : punit sévèrement les certitudes démenties ; 0,693 = pile ou face.

On compare quatre "pronostiqueurs" :
- pile ou face (50 %) : le plancher à battre ;
- Elo seul ;
- Elo + correctif des confrontations directes ;
- l'oracle, qui connaît la vraie probabilité (le plafond inatteignable).

Usage : python3 evaluation.py
"""

from __future__ import annotations

import math
from collections import defaultdict

from moteur import MoteurCotes, Parametres, marches_serie, marche_plus_moins, cote
from simulation import Ligue

ANNEES = 4
ANNEES_REGLAGE = 2   # on règle K sur les 2 premières années, on évalue sur les 2 suivantes


def brier(p, y):
    return (p - y) ** 2


def logloss(p, y):
    p = min(1 - 1e-9, max(1e-9, p))
    return -(y * math.log(p) + (1 - y) * math.log(1 - p))


def parcourir(ligue: Ligue, params: Parametres, annee_debut_eval: int,
              annee_fin_eval: int):
    """Rejoue toute l'histoire et collecte les prévisions sur la période d'évaluation."""
    moteur = MoteurCotes(params)
    prev_maps, prev_series = [], []
    for m, maps in zip(ligue.matchs, ligue.maps_par_match):
        if annee_debut_eval <= m.jour.year <= annee_fin_eval:
            sans = moteur.proba_map(m.equipe_a, m.equipe_b, m.roster_a, m.roster_b,
                                    m.jour, avec_h2h=False)
            avec = moteur.proba_map(m.equipe_a, m.equipe_b, m.roster_a, m.roster_b,
                                    m.jour, avec_h2h=True)
            vraie = maps[0].proba_vraie_a
            for mp in maps:
                y = 1.0 if mp.gagnant == m.equipe_a else 0.0
                prev_maps.append({"pile": .5, "elo": sans["p_map"],
                                  "elo_h2h": avec["p_map"], "oracle": vraie, "y": y,
                                  "n_h2h": avec["maps_h2h"]})
            y = 1.0 if m.maps_a > m.maps_b else 0.0
            prev_series.append({
                "pile": .5,
                "elo": marches_serie(sans["p_map"], m.best_of)["victoire_A"],
                "elo_h2h": marches_serie(avec["p_map"], m.best_of)["victoire_A"],
                "oracle": marches_serie(vraie, m.best_of)["victoire_A"],
                "y": y, "bo": m.best_of})
        moteur.enregistrer(m)
    return moteur, prev_maps, prev_series


def scores(prev, cle):
    n = len(prev)
    return (sum(brier(p[cle], p["y"]) for p in prev) / n,
            sum(logloss(p[cle], p["y"]) for p in prev) / n)


def tableau_scores(titre, prev):
    print(f"\n{titre} ({len(prev)} prévisions)")
    print(f"  {'pronostiqueur':<28}{'Brier':>8}{'Log loss':>10}")
    noms = {"pile": "pile ou face (50 %)", "elo": "Elo seul",
            "elo_h2h": "Elo + confrontations dir.", "oracle": "oracle (vraie proba)"}
    for cle, nom in noms.items():
        b, l = scores(prev, cle)
        print(f"  {nom:<28}{b:>8.4f}{l:>10.4f}")


def calibration(prev, cle, bornes=(0, .2, .35, .45, .55, .65, .8, 1.0001)):
    """Compare, par tranche, la probabilité annoncée à la fréquence observée."""
    lignes = []
    for lo, hi in zip(bornes, bornes[1:]):
        t = [p for p in prev if lo <= p[cle] < hi]
        if t:
            annonce = sum(p[cle] for p in t) / len(t)
            observe = sum(p["y"] for p in t) / len(t)
            lignes.append((lo, min(hi, 1), annonce, observe, len(t)))
    return lignes


def main():
    ligue = Ligue(graine=7)
    ligue.jouer_annees(ANNEES)
    an0 = ligue.matchs[0].jour.year
    print(f"Ligue fictive : {len(ligue.matchs)} séries, {len(ligue.maps)} maps, "
          f"{ANNEES} saisons ({an0}-{an0 + ANNEES - 1})")

    # 1. Réglage de K sur les premières années (la toute première sert de rodage)
    print("\n=== 1. Réglage de la vitesse d'apprentissage K "
          f"(saisons {an0 + 1}-{an0 + ANNEES_REGLAGE - 1}) ===")
    meilleur = None
    for k in (12, 16, 24, 32, 40, 48, 64):
        _, pm, _ = parcourir(ligue, Parametres(k=k), an0 + 1, an0 + ANNEES_REGLAGE - 1)
        ll = scores(pm, "elo")[1]
        print(f"  K = {k:>2} -> log loss par map {ll:.4f}")
        if meilleur is None or ll < meilleur[1]:
            meilleur = (k, ll)
    k = meilleur[0]
    print(f"  => K retenu : {k}")

    # 2. Évaluation honnête sur les saisons jamais vues pendant le réglage
    debut, fin = an0 + ANNEES_REGLAGE, an0 + ANNEES - 1
    moteur, pm, ps = parcourir(ligue, Parametres(k=k), debut, fin)
    print(f"\n=== 2. Évaluation sur les saisons {debut}-{fin} ===")
    tableau_scores("Par map", pm)
    tableau_scores("Par série (vainqueur du BO1/BO3/BO5)", ps)
    avec_h2h = [p for p in pm if p["n_h2h"] > 0]
    print(f"\n  Maps où un correctif H2H s'appliquait : {len(avec_h2h)} sur {len(pm)}")

    print("\n  Calibration par map (Elo + H2H) : quand le moteur annonce X %, "
          "l'équipe gagne-t-elle X % du temps ?")
    print(f"  {'tranche':<12}{'annoncé':>9}{'observé':>9}{'maps':>7}")
    for lo, hi, a, o, n in calibration(pm, "elo_h2h"):
        print(f"  {lo:.2f}-{hi:.2f}  {a:>8.1%}{o:>9.1%}{n:>7}")

    # 3. Paris sur statistiques : plus ou moins de X kills
    print("\n=== 3. Paris 'plus ou moins de X kills' (ligne = médiane des 15 dernières maps) ===")
    historique = defaultdict(list)
    prev_props = []
    for mp in ligue.maps:
        for joueur, kills in mp.kills.items():
            h = historique[joueur]
            if mp.jour.year >= debut and len(h) >= 10:
                mk = marche_plus_moins(h[-15:])
                prev_props.append({"p": mk["plus"], "y": 1.0 if kills > mk["ligne"] else 0.0})
            h.append(kills)
    n = len(prev_props)
    b = sum(brier(p["p"], p["y"]) for p in prev_props) / n
    b0 = sum(brier(.5, p["y"]) for p in prev_props) / n
    print(f"  {n} paris simulés - Brier moteur {b:.4f} / pile ou face {b0:.4f}")
    for lo, hi, a, o, c in calibration([{"x": p["p"], "y": p["y"]} for p in prev_props], "x"):
        print(f"  {lo:.2f}-{hi:.2f}  annoncé {a:>6.1%}  observé {o:>6.1%}  ({c})")

    # 4. Exemple concret : les cotes affichées pour une finale fictive
    m = ligue.matchs[-1]
    det = moteur.proba_map(m.equipe_a, m.equipe_b, m.roster_a, m.roster_b, m.jour)
    marches = marches_serie(det["p_map"], 5)
    print(f"\n=== 4. Exemple : {m.equipe_a} vs {m.equipe_b} (BO5) ===")
    print(f"  Notes Elo : {det['note_a']:.0f} contre {det['note_b']:.0f}")
    print(f"  Proba par map : Elo {det['p_elo']:.1%}, correctif H2H "
          f"{det['correctif_h2h']:+.1%} sur {det['maps_h2h']} maps -> {det['p_map']:.1%}")
    print(f"  {'pari':<20}{'proba':>8}{'cote juste':>12}{'cote marge 5 %':>16}")
    for nom, p in marches.items():
        print(f"  {nom:<20}{p:>8.1%}{cote(p):>12.2f}{cote(p, .05):>16.2f}")
    return ligue, moteur, pm, ps


if __name__ == "__main__":
    main()
