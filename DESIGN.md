---
name: OverTime
description: Pronostics e-sport entre amis, en noxus virtuels ; une arène e-sport qui tient dans la main.
colors:
  magenta-arene: "#FF4FD8"
  vert-cote: "#C6FF4D"
  violet-gradin: "#8264FF"
  ambre-fermeture: "#FFB547"
  rouge-perte: "#FF9494"
  menthe-victoire: "#8FE3C0"
  nuit-arene: "#0C0C12"
  surface-gradin: "#15141B"
  surface-carte: "#1B1A22"
  surface-active: "#2A2833"
  bordure-forte: "#383542"
  texte-principal: "#F1F0F5"
  texte-doux: "#D3D1DC"
  texte-discret: "#A3A1B0"
  texte-eteint: "#6E6C7A"
typography:
  display:
    fontFamily: "Rubik, -apple-system, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Rubik, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Rubik, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Rubik, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Rubik, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
  cote:
    fontFamily: "Rubik, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
  logo:
    fontFamily: "Rubik, -apple-system, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
rounded:
  cote: "7px"
  pastille: "8px"
  bouton: "12px"
  controle: "14px"
  carte: "16px"
  section: "22px"
  feuille: "26px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  bouton-parier:
    backgroundColor: "{colors.magenta-arene}"
    textColor: "{colors.nuit-arene}"
    typography: "{typography.title}"
    rounded: "{rounded.bouton}"
    padding: "0 22px"
    height: "48px"
  bouton-secondaire:
    backgroundColor: "{colors.texte-principal}"
    textColor: "{colors.nuit-arene}"
    typography: "{typography.title}"
    rounded: "{rounded.controle}"
    height: "50px"
  bouton-discret:
    backgroundColor: "{colors.surface-carte}"
    textColor: "{colors.texte-principal}"
    rounded: "{rounded.bouton}"
    height: "44px"
  cote-libre:
    textColor: "{colors.texte-principal}"
    typography: "{typography.cote}"
    rounded: "{rounded.cote}"
    height: "52px"
  cote-choisie:
    textColor: "#FFFFFF"
    typography: "{typography.cote}"
    rounded: "{rounded.cote}"
    height: "52px"
  onglet-actif:
    backgroundColor: "{colors.surface-active}"
    textColor: "{colors.texte-principal}"
    rounded: "11px"
    height: "40px"
  onglet-inactif:
    textColor: "{colors.texte-discret}"
    height: "40px"
  carte-match:
    backgroundColor: "{colors.surface-carte}"
    rounded: "{rounded.carte}"
    padding: "8px 10px 10px"
  section-competition:
    backgroundColor: "{colors.surface-gradin}"
    rounded: "{rounded.section}"
    padding: "6px"
  pastille-fermeture:
    backgroundColor: "#FFB5471F"
    textColor: "{colors.ambre-fermeture}"
    typography: "{typography.label}"
    rounded: "{rounded.pastille}"
    padding: "2px 8px"
---

# Design System: OverTime

## Overview

**Creative North Star: "L'Arène de poche"**

OverTime est un plateau e-sport qui tient dans la main. On y vient avant un match ou entre deux matchs, pour parier en quelques secondes, voir ce que les amis ont joué et se situer au classement. L'écran est un outil de travail (mode Operate) avec une signature de vitrine : la carte du prochain match garde un grand face-à-face, tout le reste est une liste compacte et dense.

Le duel est l'image centrale. Deux cotes inclinées en miroir encadrent un VS, comme deux équipes qui se font face sur une scène. Autour, la nuit de l'arène : un fond presque noir, deux lueurs fixes (magenta en haut, violet en bas, comme les projecteurs et la salle) et des surfaces sombres empilées en couches. La lumière est dosée : une seule chose brille vraiment, ce que la personne a choisi.

Le ressenti est celui d'un duel premium : peu d'éléments, des finitions soignées, une énergie e-sport sans décor de casino. L'illustration de référence est la planche « Étoile polaire · L'Arène de poche » du canevas de DA (finale M8 contre KC sur l'écran géant, téléphone ouvert sur OverTime au premier plan).

**Key Characteristics:**
- Fond Nuit de l'arène avec deux lueurs fixes, jamais sur les composants.
- Cotes inclinées en miroir autour d'un VS : la signature visuelle.
- Le magenta veut dire « choisi » ou « parier », rien d'autre.
- Surfaces sombres en couches plutôt qu'ombres portées.
- Une seule famille, Rubik ; l'italique gras est réservé au logo et au VS.

## Colors

Une palette nocturne : un magenta vif et un vert-jaune électrique sur des noirs violacés, avec un ambre réservé à l'urgence.

### Primary
- **Magenta Arène** (#FF4FD8) : ce que la personne a choisi (cote, jour du calendrier, jeu filtré) et l'action de parier (bouton « Miser », « Parier N noxus »). Aussi le cadre de TIME dans le logo, seule exception décorative.

### Secondary
- **Vert Cote** (#C6FF4D) : les cotes libres, en dégradé translucide avec un liseré plein du côté extérieur. Aussi les états gagnés (pastille « Gagné », icône de sélection gagnée).

### Tertiary
- **Violet Gradin** (#8264FF) : la lueur basse du fond, au-dessus de la barre d'onglets. Jamais sur un composant.
- **Ambre Fermeture** (#FFB547) : un match ferme dans moins d'une heure (« ferme dans 40 min »), toujours sur une pastille à 12 % d'opacité.

### Neutral
- **Nuit de l'arène** (#0C0C12) : le fond de toute l'appli et le texte posé sur le magenta ou le blanc.
- **Surface Gradin** (#15141B) : sections de compétition, barres, feuilles, barre de navigation.
- **Surface Carte** (#1B1A22) : cartes de match et lignes de coupon, posées sur une Surface Gradin.
- **Surface Active** (#2A2833) : onglet actif, ta ligne au classement, filets de séparation.
- **Bordure forte** (#383542) : contours de boutons discrets et du coupon.
- **Texte principal** (#F1F0F5), **Texte doux** (#D3D1DC), **Texte discret** (#A3A1B0, métadonnées : BO, phase, heure lointaine), **Texte éteint** (#6E6C7A, jours sans match).
- **Menthe Victoire** (#8FE3C0) et **Rouge Perte** (#FF9494) : les V et D de la forme d'une équipe, l'état perdu d'un pari.

### Named Rules
**The Une Lueur, Un Sens Rule.** Le magenta plein ou en dégradé lumineux ne sert qu'à deux choses : ce que la personne a choisi, et l'action de parier. Un VS, un onglet actif, un lien ou un badge de filtre ne sont jamais magenta : ils passent en blanc ou en gris.

**The Lueurs Fixes Rule.** Le fond porte deux lueurs radiales et rien d'autre : magenta à 17 % en haut (ellipse 110 % × 50 %), violet à 30 % au-dessus des onglets (ellipse 90 % × 20 %, centrée à 88 %). On ne les atténue pas et on n'en ajoute pas.

**The Vert-Libre, Magenta-Choisi Rule.** Une cote change de couleur, jamais de forme : même inclinaison, même dégradé, même liseré, en vert quand elle est libre et en magenta (plus dense, liseré plus épais, lueur) quand elle est choisie.

## Typography

**Display Font:** Rubik (repli -apple-system, Segoe UI, sans-serif)
**Body Font:** Rubik
**Label/Mono Font:** pas de police à chasse fixe

**Character:** Une seule famille arrondie et dense, lisible en petit sur iPhone. L'énergie vient de l'italique gras du logo et du VS, et de l'inclinaison des cotes, pas d'un mélange de polices.

### Hierarchy
- **Logo** (800 italique, 21px, majuscules) : OVER en blanc, TIME en Nuit de l'arène dans un cadre magenta incliné de −10°.
- **Display** (700, 26px, 1,15) : titre d'écran (Mes paris, Classement, nom du profil).
- **Headline** (600, 18px) : titre de journée (« Aujourd'hui, vendredi 6 novembre »).
- **Title** (600, 15px) : nom de compétition, titre de carte, libellé de pari.
- **Body** (400, 14px, 1,4) : textes d'aide et phrases sociales (« Hugo, Léa et 2 autres ont parié »).
- **Label** (500, 12px) : métadonnées, pastilles, légendes de statistiques. Jamais en majuscules.
- **Cote** (600, 17px compacte, 19px sur la carte vedette) : toujours avec la virgule décimale française (1,61).
- **VS** (700 italique, 26px sur la vedette, 13px en compact) : Texte doux ou gris, jamais magenta.

### Named Rules
**The Pas de Capitales Rule.** Aucun libellé en majuscules espacées dans l'interface. Les majuscules sont réservées au logo et à l'écran géant de l'illustration.

## Layout

Conçu pour un iPhone en portrait (viewport de référence 390 × 844 pt), installable en PWA. Marges latérales de 10 à 16px, rythme vertical par pas de 4 (4, 8, 12, 14, 16, 20).

En-tête : logo et solde en haut, qui défilent avec la page ; la barre Liste / Semaine / Mois et le bouton de filtre restent collés en haut avec un fond flouté. Barre de navigation fixe en bas (Matchs, Mes paris, Classement, Profil), coupon flottant juste au-dessus quand une cote est choisie. Le contenu garde une marge basse de 120px, 200px quand le coupon est visible, pour que le dernier match ne passe jamais dessous.

Densité : la carte vedette (prochain match du jour) fait environ 260px ; les autres matchs sont des cartes compactes d'environ 105px, regroupées par compétition et phase dans une section commune.

### Named Rules
**The Une Vedette Par Jour Rule.** Une seule grande carte par journée, celle du prochain duel à commencer. Tout le reste est compact.

## Elevation & Depth

Pas d'ombres portées sur les cartes : la profondeur vient de couches tonales (Nuit de l'arène, puis Surface Gradin, puis Surface Carte, puis Surface Active) séparées par des filets de 1px. Deux exceptions : le coupon flottant (ombre `0 12px 32px rgba(0,0,0,0.55)`) et la lueur magenta `0 0 18px #FF4FD859` autour d'un élément choisi. Les feuilles (coupon, filtre, confirmation) montent du bas sur un voile `rgba(5,5,10,0.6)`.

### Named Rules
**The Seule la Sélection Brille Rule.** Une lueur autour d'un élément veut dire « tu l'as choisi ». Aucune autre lueur sur les composants.

## Shapes

Des arrondis qui grandissent avec la taille du conteneur : 7px pour les cotes, 8px pour les pastilles, 12px pour les boutons, 14px pour les contrôles, 16px pour les cartes de match, 22px pour les sections, 26px pour le haut des feuilles. Les cotes sont inclinées : ±10° en compact, ±12° sur la carte vedette, −10° pour les paris de classement (Top 1, 3, 10) ; le contenu est contre-incliné pour rester droit. Avatars et points du calendrier sont des cercles parfaits.

## Components

### Buttons
Nerveux et francs : un seul bouton plein magenta par écran.
- **Shape :** arrondi de bouton (12px), hauteur 44 à 54px, cible tactile d'au moins 44px.
- **Parier / Miser :** fond Magenta Arène, texte Nuit de l'arène, 700. Libellé qui dit l'action et la somme (« Parier 50 noxus »).
- **Secondaire :** fond Texte principal, texte Nuit de l'arène (« Voir 21 matchs », « Continuer », « Partager »).
- **Discret :** transparent ou Surface Carte avec Bordure forte (« Vider », « Voir mes paris », −/+ de la mise).
- **Inactif :** fond Surface Active, texte éteint, avec `aria-disabled` et un message qui dit quoi faire.
- **Focus :** contour 2px Texte principal, décalé de 2px.

### Cotes (composant signature)
- **Libre :** dégradé Vert Cote de 30 % à 7 % vers le VS, bordure 1px Vert Cote à 35 %, liseré plein de 3px du côté extérieur.
- **Choisie :** dégradé Magenta Arène de 70 % à 25 %, bordure 1px à 65 %, liseré plein de 4px, lueur magenta, texte blanc (contraste 4,8:1 au plus dense).
- **Disposition :** équipe A à gauche avec son liseré à gauche, équipe B à droite en miroir ; en compact, nom et petit logo à l'extérieur, chiffre côté VS.
- Libellé accessible complet : « Parier sur Corbeaux de Lille, cote 1,61 », avec `aria-pressed`.

### Chips (filtres de jeu, mises rapides)
- **Style :** Surface Carte, bordure Surface Active, pictogramme du jeu sur fond teinté de sa couleur.
- **État choisi :** bordure magenta et coche magenta. Un choix « Tous les jeux » est coché quand aucun filtre n'est actif.

### Cards / Containers
- **Section de compétition :** Surface Gradin, arrondi 22px, padding 6px, en-tête avec le pictogramme du jeu, le nom et la phase.
- **Carte de match compacte :** Surface Carte, arrondi 16px ; ligne 1 : heure, BO, pastille de fermeture, avatars des amis, « +N paris › » ; ligne 2 : les deux cotes autour du VS.
- **Carte vedette :** dégradé #211F2A vers Surface Carte, bordure #2E2B38, arrondi 22px ; grands logos d'équipe, cotes de 50px, phrase sociale en pied.
- **Pas de carte dans une carte** au-delà de ces deux niveaux.

### Navigation
- **Barre basse :** Surface Gradin, filet en haut, quatre entrées icône + libellé 11px. Actif : texte principal et pastille Surface Active derrière l'icône (jamais magenta). Inactif : Texte discret.
- **Contrôle segmenté :** Surface Gradin, onglet actif Surface Active, inactifs transparents en Texte discret.

### Calendrier
- Jours en cases arrondies de 14px ; jour choisi en dégradé magenta avec liseré 2px et lueur, chiffre blanc ; aujourd'hui non choisi : bordure Texte principal ; jours sans match : Texte éteint. Points de couleur des jeux sous le chiffre (trois au plus).

### Avatars d'amis
- Cercles de couleurs neutres (jamais magenta) avec l'initiale en Nuit de l'arène, empilés avec un recouvrement de 3px et un filet de la couleur du fond.

## Do's and Don'ts

### Do:
- **Do** réserver le Magenta Arène à la sélection et au bouton Parier (The Une Lueur, Un Sens Rule).
- **Do** garder les deux lueurs du fond à leurs valeurs exactes (17 % magenta en haut, 30 % violet en bas).
- **Do** afficher sur chaque coupon la mise, le gain possible arrondi à l'inférieur et l'heure de fermeture.
- **Do** écrire les cotes avec une virgule (1,61) et les nombres avec une espace fine (1 240 noxus).
- **Do** montrer l'activité des amis (avatars, phrase sociale) sur les matchs : la rivalité est le moteur du produit.
- **Do** garder des cibles tactiles d'au moins 44px et un contraste d'au moins 4,5:1, y compris sur le magenta.

### Don't:
- **Don't** colorer le VS, un onglet actif, un lien ou un badge en magenta.
- **Don't** atténuer ou multiplier les lueurs du fond, ni ajouter de halo décoratif à un composant non choisi.
- **Don't** utiliser de majuscules espacées pour les libellés, ni de police à chasse fixe.
- **Don't** reproduire les logos officiels d'équipes, de jeux ou de compétitions : pictogrammes maison, les vrais logos viendront de la source de données sous licence.
- **Don't** empiler plus de deux niveaux de cartes, ni donner le même arrondi à tout.
- **Don't** emprunter les codes du casino (jetons, rouleaux, pluie de pièces) : OverTime parle de duel, pas de jackpot.
