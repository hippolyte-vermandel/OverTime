"""
Exporte une ligue simulée et les prévisions du moteur Python, pour vérifier
que le moteur JavaScript de l'application donne exactement les mêmes chiffres.

Usage : python3 exporter_parite.py  (écrit app/tests/fixtures/parite-moteur.json)
"""
import json
from datetime import date
from pathlib import Path

from moteur import MoteurCotes, marches_serie, cote
from simulation import Ligue

ligue = Ligue(graine=11)
ligue.jouer_annees(annees=2, debut=date(2024, 1, 15))
moteur = MoteurCotes()
cas = []
for m in ligue.matchs:
    prev = moteur.proba_map(m.equipe_a, m.equipe_b, m.roster_a, m.roster_b, m.jour)
    marches = marches_serie(prev["p_map"], m.best_of)
    cas.append({
        "match": {"jour": m.jour.isoformat(), "equipe_a": m.equipe_a, "equipe_b": m.equipe_b,
                  "best_of": m.best_of, "maps_a": m.maps_a, "maps_b": m.maps_b,
                  "roster_a": list(m.roster_a), "roster_b": list(m.roster_b)},
        "prevision": prev,
        "marches": marches,
        "cote_a": cote(marches["victoire_A"]),
        "cote_a_marge": cote(marches["victoire_A"], 0.05),
    })
    moteur.enregistrer(m)

sortie = Path(__file__).resolve().parents[2] / "app" / "tests" / "fixtures" / "parite-moteur.json"
sortie.parent.mkdir(parents=True, exist_ok=True)
sortie.write_text(json.dumps(cas, ensure_ascii=False))
print(len(cas), "matchs exportés vers", sortie)
