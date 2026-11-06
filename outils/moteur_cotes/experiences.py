"""
Expériences sur 30 ligues fictives différentes (une seule ligue, c'est
trop peu de matchs : les résultats varieraient beaucoup d'une graine à l'autre).

Questions posées :
1. Quelle vitesse d'apprentissage K choisir ?
2. Le correctif des confrontations directes aide-t-il, et dans quel cas ?
3. Le moteur est-il bien calibré (annonce 60 % -> gagne 60 % du temps) ?

Usage : python3 experiences.py
"""

import statistics as st

import simulation
from evaluation import parcourir, scores, calibration
from moteur import Parametres
from simulation import Ligue

GRAINES = range(30)


def ligues(style):
    simulation.STYLE_ECART_TYPE = style
    out = []
    for g in GRAINES:
        lg = Ligue(g)
        lg.jouer_annees(4)
        out.append(lg)
    return out


def brier_moyen(lgs, cle, **params):
    return st.mean(scores(parcourir(lg, Parametres(**params), 2023, 2025)[1], cle)[0]
                   for lg in lgs)


def main():
    lgs = ligues(0.25)
    print("1. Vitesse d'apprentissage (Brier par map, Elo + H2H, plus bas = mieux)")
    for k in (12, 16, 24, 32, 48):
        print(f"   K = {k:>2} : {brier_moyen(lgs, 'elo_h2h', k=k):.4f}")

    print("\n2. Apport des confrontations directes selon l'importance du 'style'")
    for style, texte in ((0.0, "aucun effet de style"), (0.25, "effet modéré"),
                         (0.5, "effet marqué")):
        lg = ligues(style)
        res = {c: brier_moyen(lg, c) for c in ("pile", "elo", "elo_h2h", "oracle")}
        print(f"   {texte:<22} pile {res['pile']:.4f} | Elo {res['elo']:.4f} | "
              f"Elo+H2H {res['elo_h2h']:.4f} | oracle {res['oracle']:.4f}")

    print("\n3. Calibration par map, 30 ligues cumulées (Elo + H2H)")
    tout = []
    for lg in lgs:
        tout += parcourir(lg, Parametres(), 2023, 2025)[1]
    for lo, hi, a, o, n in calibration(tout, "elo_h2h"):
        print(f"   annoncé {a:>6.1%}  observé {o:>6.1%}   ({n} maps)")


if __name__ == "__main__":
    main()
