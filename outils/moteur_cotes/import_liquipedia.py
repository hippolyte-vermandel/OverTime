"""
Import de vrais matchs depuis l'API LiquipediaDB (LPDB v3), puis calcul
de l'Elo des équipes sur ces données.

ATTENTION : script écrit d'après la documentation publique de l'API mais
NON TESTÉ (pas d'accès réseau à Liquipedia depuis l'environnement où il a
été écrit). Les noms de champs sont à vérifier à la première exécution :
le script sauvegarde la réponse brute dans un fichier JSON pour faciliter
ce contrôle.

Prérequis :
- une clé API, à demander sur https://liquipedia.net/api (gratuite pour un
  projet personnel / éducatif non commercial) ;
- variables d'environnement :
    LIQUIPEDIA_API_KEY=ta_cle
    LIQUIPEDIA_CONTACT=ton.adresse@exemple.fr   (exigé par les conditions)
- pip install requests

Conditions d'utilisation à respecter : mettre en cache (ne pas redemander
les mêmes données), User-Agent identifiant le projet avec un contact,
et citer Liquipedia (licence CC-BY-SA 3.0) dans l'application.

Usage :
    python3 import_liquipedia.py "[[parent::LEC/2025/Winter]]" "[[parent::LEC/2025/Spring]]"
(une ou plusieurs conditions LPDB ; adapter selon la page du tournoi)
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from moteur import Match, MoteurCotes

API = "https://api.liquipedia.net/api/v3/match"
CACHE = Path("cache_liquipedia")


def recuperer(condition: str) -> list[dict]:
    import requests  # importé ici pour que le reste du module marche sans

    CACHE.mkdir(exist_ok=True)
    fichier = CACHE / (condition.replace("/", "_").replace(":", "").strip("[]") + ".json")
    if fichier.exists():                       # cache : on ne redemande jamais
        return json.loads(fichier.read_text(encoding="utf-8"))

    entetes = {
        "Authorization": f"Apikey {os.environ['LIQUIPEDIA_API_KEY']}",
        "User-Agent": f"PronosEntreAmis/0.1 ({os.environ['LIQUIPEDIA_CONTACT']})",
        "Accept-Encoding": "gzip",
    }
    resultats, offset = [], 0
    while True:
        r = requests.get(API, headers=entetes, timeout=30, params={
            "wiki": "leagueoflegends",
            "conditions": condition + " AND [[finished::1]]",
            "order": "date ASC",
            "limit": 500,
            "offset": offset,
        })
        r.raise_for_status()
        page = r.json().get("result", [])
        resultats += page
        if len(page) < 500:
            break
        offset += 500
        time.sleep(2)                          # politesse envers l'API
    fichier.write_text(json.dumps(resultats, ensure_ascii=False, indent=1),
                       encoding="utf-8")
    return resultats


def vers_match(brut: dict) -> Match | None:
    """Convertit un match LPDB ("match2") vers notre format. Champs à vérifier."""
    adv = brut.get("match2opponents") or []
    if len(adv) != 2:
        return None
    try:
        sa, sb = int(adv[0]["score"]), int(adv[1]["score"])
    except (KeyError, TypeError, ValueError):
        return None
    if sa < 0 or sb < 0:                       # forfait ou score inconnu
        return None
    roster = lambda o: tuple(p.get("name", "?") for p in (o.get("match2players") or []))
    return Match(
        jour=datetime.fromisoformat(brut["date"][:10]).date(),
        equipe_a=adv[0]["name"], equipe_b=adv[1]["name"],
        best_of=int(brut.get("bestof") or (2 * max(sa, sb) - 1)),
        maps_a=sa, maps_b=sb,
        roster_a=roster(adv[0]), roster_b=roster(adv[1]),
    )


def main(conditions: list[str]) -> None:
    matchs = []
    for c in conditions:
        matchs += [m for m in map(vers_match, recuperer(c)) if m]
    matchs.sort(key=lambda m: m.jour)
    print(f"{len(matchs)} séries importées")
    moteur = MoteurCotes()
    for m in matchs:
        moteur.enregistrer(m)
    print("\nClassement Elo :")
    for eq, note in sorted(moteur.notes.items(), key=lambda x: -x[1]):
        print(f"  {note:7.0f}  {eq}")
    print("\nDonnées : Liquipedia (CC-BY-SA 3.0)")


if __name__ == "__main__":
    main(sys.argv[1:] or ["[[parent::LEC/2025/Winter]]"])
