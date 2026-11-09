# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

SvelteKit (JavaScript) en application web installable (PWA), PostgreSQL, Node.js. Hébergement sur un PC du groupe (Windows aujourd'hui, Linux possible plus tard), accès par tunnel (Tailscale ou Cloudflare Tunnel). Pas d'application de magasin (App Store, Play Store) prévue pour l'instant.

## Users

Un groupe privé de 15 à 50 personnes, toutes majeures : des amis et des amis d'amis, fans d'e-sport, majoritairement sur iPhone. Ils rejoignent une ligue par un code d'invitation. Un ou plusieurs membres sont administrateurs de la ligue : ils saisissent les matchs et valident les résultats.

Trois situations d'usage dominent :
- juste avant un match : trouver le match et parier en quelques secondes, avant la fermeture des paris à l'heure de début ;
- entre les matchs : consulter le classement, se comparer aux autres, chambrer ;
- pour les statistiques : historique des résultats, rosters, anciennes structures des joueurs, forme des équipes et des joueurs.

Le suivi en direct pendant les matchs n'est pas un usage prioritaire.

## Product Purpose

OverTime est un jeu de pronostics e-sport entre amis, avec une monnaie virtuelle, le noxus. Les membres parient sur des matchs réels (victoire, score, map jouée, statistiques de joueurs et d'équipes, classements en lobby) avec des cotes calculées par l'application. La réussite, c'est la rivalité entre amis : un classement qui compte, qu'on consulte et dont on parle.

## Positioning

Une ligue privée et fermée, centrée sur l'e-sport (région EMEA et compétitions mondiales), avec des paris plus fins que la simple victoire et un classement par saison au rendement, tous jeux confondus. Ce n'est ni un site de paris en argent réel ni une application publique.

## Operating Context

- Jeux couverts : League of Legends, VALORANT (dont la scène féminine Game Changers), Fortnite, Rocket League, TFT, Call of Duty, Warzone, 2XKO.
- Formats : duels d'équipes en BO1 à BO7 ; lobbys à classement (Fortnite, Warzone, TFT) ; duels pour 2XKO.
- Compétitions affichées par leur nom et leur phase (par exemple « Worlds 2026 », « Quart de finale »).
- Saisons de la ligue : un semestre (janvier-juin, juillet-décembre), indépendantes des calendriers des jeux.
- Données : saisie manuelle par l'administrateur pour démarrer et en secours ; import automatique prévu depuis Liquipedia (accès demandé, en attente), Leaguepedia pour League of Legends, éventuellement VLR pour VALORANT.

## Capabilities and Constraints

- Économie : 1000 noxus au début de chaque saison, recharge de 150 par semaine, mises de 10 à 500 par pari. Réglable par ligue.
- Classement unique par ligue, tous jeux confondus, au rendement (gains divisés par mises).
- Paris fermés à l'heure de début du match ; gains arrondis à l'inférieur.
- Combinés : une sélection annulée divise le gain par deux ; si cette moitié est inférieure à la mise, la mise est remboursée ; tout annulé, mise remboursée.
- Une seule sélection par match dans un coupon : en choisir une autre remplace la précédente. Les marchés d'un même match sont liés (un score de 3-1 implique la victoire), les combiner fausserait la cote.
- Cotes calculées avant le match (Elo des équipes, correctif léger des confrontations directes récentes si les effectifs sont comparables), jamais en direct.
- Tout mouvement de noxus passe par des fonctions de la base qui vérifient et écrivent en une seule opération.
- Undecided : source de données définitive (dépend de la réponse de Liquipedia) ; affichage précis des paris sur statistiques.

## Brand Commitments

- Nom de l'application : OverTime. Monnaie : le noxus (nom gardé pour un usage privé ; à revoir si l'application devenait publique, car c'est un nom de l'univers League of Legends).
- Langue de l'interface : français.

## Evidence on Hand

- Aucune donnée réelle pour l'instant : les équipes, joueurs et cotes des maquettes et de `db/demo.sql` sont fictifs.
- Les logos des vraies équipes et des jeux ne sont pas stockés dans le projet : ils viendront de la source de données, avec citation de la source. En leur absence, l'interface affiche le sigle de l'équipe.
- Ne jamais présenter de résultats, de cotes ou de statistiques inventés comme réels.

## Product Principles

1. Le classement est le cœur du jeu : chaque écran doit rapprocher du prochain pari ou de sa place au classement.
2. Parier en quelques secondes : trouver le match, choisir, valider, sans détour, avant la fermeture.
3. Jamais d'argent réel : les noxus ne s'achètent pas, ne se vendent pas, ne s'échangent contre rien.
4. Des règles claires et traçables : chaque noxus gagné ou perdu s'explique, pour que les disputes entre amis se règlent vite.
5. Fiable sans source automatique : l'application doit fonctionner entièrement avec la saisie manuelle.
