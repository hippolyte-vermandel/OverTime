# Prototype de moteur de cotes – pronostics e-sport entre amis

Python 3.10+ ; le moteur et la simulation n'utilisent que la bibliothèque standard
(`requests` seulement pour l'import Liquipedia).

| Fichier | Rôle |
|---|---|
| `moteur.py` | Le cœur : Elo par map, oubli partiel après changement d'effectif ou longue pause, correctif léger des confrontations directes, probabilités des séries (BO1/3/5, score exact, map 5), paris « plus ou moins » sur stats, conversion en cotes |
| `simulation.py` | Ligue fictive de 10 équipes où l'on connaît la vraie probabilité de chaque map |
| `evaluation.py` | Rejoue une ligue match par match (sans regarder le futur) et mesure la qualité des cotes |
| `experiences.py` | Même chose sur 30 ligues, pour des conclusions fiables |
| `import_liquipedia.py` | Import de vrais matchs LoL via l'API Liquipedia (**non testé**, clé API nécessaire) |

```bash
python3 evaluation.py     # une ligue, avec un exemple de cotes affichées
python3 experiences.py    # réglages et calibration sur 30 ligues
```

## Réglages par défaut (dans `Parametres`)

- `k = 24` : vitesse d'apprentissage de l'Elo, meilleur compromis dans les essais.
- Confrontations directes : seulement l'année écoulée, seulement si les deux équipes
  ont gardé au moins 3 joueurs sur 5, poids `n / (n + 20)` pour n maps, plafonné à ±5 points.
- `cote(p, marge)` : cote juste = 1/p ; une marge de 5 % baisse toutes les cotes.

## Ce que montrent les essais (monde simulé)

- L'Elo bat nettement le pile ou face, mais reste loin de l'oracle : avec une seule
  ligue régionale, il y a peu de matchs pour apprendre.
- Le correctif des confrontations directes, tel que réglé, n'abîme jamais les
  prévisions et n'aide vraiment que si des « styles » qui gênent certaines équipes existent.
- Calibration correcte ; le moteur est un peu trop prudent sur les gros écarts.
- Les paris sur kills basés sur la médiane battent le hasard, mais surestiment
  les cas extrêmes (la loi de Poisson ne tient pas compte de la victoire ou défaite).

Ces conclusions valent pour un monde simulé : à confirmer sur les vraies données.
