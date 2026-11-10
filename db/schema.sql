-- ===========================================================================
--  NOXUS - Schéma de la base de données (PostgreSQL 14+)
--  Application de pronostics e-sport entre amis, monnaie virtuelle : le noxus
-- ===========================================================================
--
--  Le schéma est découpé en quatre blocs :
--
--   0. Les comptes (Better Auth)
--   A. Le référentiel e-sport : jeux, compétitions, équipes, joueurs, contrats
--   B. Les rencontres et leurs statistiques : séries, parties (maps), stats
--   C. Les paris : marchés, issues, paris, ligues entre amis
--   D. L'économie des noxus : un registre de tous les mouvements
--   E. La provenance des données : d'où vient chaque information importée
--
--  Conventions :
--   - noms de tables au singulier, en français, sans accents ;
--   - chaque table a une clé "id" générée automatiquement ;
--   - les dates/heures sont en "timestamptz" (avec fuseau), stockées en UTC.
-- ===========================================================================

BEGIN;

-- ===========================================================================
--  0. COMPTES (tables gérées par Better Auth, la bibliothèque d'authentification)
--  Ne pas modifier à la main : elles suivent le format attendu par Better Auth.
--  Les mots de passe sont hachés par Better Auth dans "account".password.
--  Les noms entre guillemets ("user", "createdAt"...) sont ceux de Better Auth.
-- ===========================================================================

create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "username" text unique, "displayUsername" text);
create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");

-- ===========================================================================
--  A. RÉFÉRENTIEL E-SPORT
-- ===========================================================================

-- Les jeux couverts. Le "format" dit comment se jouent les rencontres :
--   'equipes' : deux équipes s'affrontent (LoL, Valorant, Rocket League, CoD)
--   'lobby'   : beaucoup de participants, un classement (Fortnite, Warzone, TFT)
--   'duel'    : un contre un ou duo contre duo (2XKO)
CREATE TABLE jeu (
    id      serial PRIMARY KEY,
    code    text NOT NULL UNIQUE,            -- 'lol', 'valorant', 'fortnite'...
    nom     text NOT NULL,
    format  text NOT NULL CHECK (format IN ('equipes', 'lobby', 'duel'))
);

-- Une compétition = une étape précise : "LEC 2026 Winter", "Worlds 2026",
-- "VCT Game Changers EMEA 2026 Stage 1"...
CREATE TABLE competition (
    id          serial PRIMARY KEY,
    jeu_id      int  NOT NULL REFERENCES jeu(id),
    nom         text NOT NULL,
    region      text NOT NULL,               -- 'EMEA', 'International'...
    categorie   text NOT NULL DEFAULT 'open'
                CHECK (categorie IN ('open', 'feminine')),  -- Game Changers = 'feminine'
    niveau      int  NOT NULL DEFAULT 1,     -- 1 = élite (LEC, Worlds), 2 = division inférieure
    date_debut  date,
    date_fin    date,
    UNIQUE (jeu_id, nom)
);

-- Une équipe (une "structure"). Une même organisation présente sur plusieurs
-- jeux (ex. Karmine Corp en LoL et en Valorant) est UNE équipe : c'est le
-- contrat qui dit sur quel jeu joue chaque joueur.
CREATE TABLE equipe (
    id        serial PRIMARY KEY,
    nom       text NOT NULL UNIQUE,
    sigle     text,                          -- 'KC', 'G2', 'FNC'
    pays      text,                          -- code ISO : 'FR', 'DE'...
    logo_url  text,
    active    boolean NOT NULL DEFAULT true
);

-- Un joueur professionnel. On ne stocke que son identité publique de joueur.
CREATE TABLE joueur (
    id           serial PRIMARY KEY,
    pseudo       text NOT NULL,
    pays         text,                       -- nationalité sportive, code ISO
    photo_url    text,
    -- Deux joueurs peuvent porter le même pseudo sur deux jeux différents :
    -- l'unicité est donc garantie par les identifiants externes (bloc E).
    cree_le      timestamptz NOT NULL DEFAULT now()
);

-- LE tableau clé de l'historique : qui a joué où, à quel poste, et quand.
-- date_fin vide = contrat en cours. Le roster actuel et la carrière d'un
-- joueur ("anciennes structures") sont deux lectures de ce même tableau.
CREATE TABLE contrat (
    id          serial PRIMARY KEY,
    joueur_id   int  NOT NULL REFERENCES joueur(id),
    equipe_id   int  NOT NULL REFERENCES equipe(id),
    jeu_id      int  NOT NULL REFERENCES jeu(id),
    poste       text,                        -- 'top', 'jungle', 'duelliste', 'igl'...
    statut      text NOT NULL DEFAULT 'titulaire'
                CHECK (statut IN ('titulaire', 'remplacant', 'coach', 'pret')),
    date_debut  date NOT NULL,
    date_fin    date,
    CHECK (date_fin IS NULL OR date_fin >= date_debut)
);
CREATE INDEX contrat_equipe_idx ON contrat (equipe_id, jeu_id, date_debut);
CREATE INDEX contrat_joueur_idx ON contrat (joueur_id, date_debut);


-- ===========================================================================
--  B. RENCONTRES ET STATISTIQUES
-- ===========================================================================

-- Une série = une rencontre complète : un BO1, BO3, BO5... ou, pour un jeu
-- en lobby, une session de plusieurs parties (ex. une journée de FNCS).
CREATE TABLE serie (
    id              serial PRIMARY KEY,
    competition_id  int  NOT NULL REFERENCES competition(id),
    phase           text,                    -- 'saison reguliere', 'demi-finale'...
    date_prevue     timestamptz NOT NULL,    -- sert aussi d'heure de verrouillage des paris
    best_of         int  CHECK (best_of IN (1, 3, 5, 7)),  -- vide pour un lobby
    statut          text NOT NULL DEFAULT 'programmee'
                    CHECK (statut IN ('programmee', 'en_cours', 'terminee',
                                      'annulee', 'forfait')),
    resultat_valide boolean NOT NULL DEFAULT false  -- un admin a confirmé le résultat
);
CREATE INDEX serie_date_idx ON serie (date_prevue);

-- Qui participe à une série. Deux lignes pour un match d'équipes, une
-- trentaine pour un lobby Fortnite. Un participant est soit une équipe,
-- soit un joueur seul (duel, solo) : exactement l'un des deux.
CREATE TABLE participation (
    id          serial PRIMARY KEY,
    serie_id    int  NOT NULL REFERENCES serie(id) ON DELETE CASCADE,
    equipe_id   int  REFERENCES equipe(id),
    joueur_id   int  REFERENCES joueur(id),
    cote_terrain char(1) CHECK (cote_terrain IN ('A', 'B')),  -- pour les duels d'équipes
    score       int,                         -- maps gagnées (ou points cumulés en lobby)
    classement  int,                         -- 1 = vainqueur ; position finale en lobby
    CHECK ((equipe_id IS NULL) <> (joueur_id IS NULL)),
    UNIQUE (serie_id, equipe_id),
    UNIQUE (serie_id, joueur_id)
);

-- Une partie = une map (Valorant, LoL) ou une game de lobby (Fortnite).
CREATE TABLE partie (
    id          serial PRIMARY KEY,
    serie_id    int  NOT NULL REFERENCES serie(id) ON DELETE CASCADE,
    numero      int  NOT NULL,               -- map 1, map 2...
    carte       text,                        -- 'Ascent', 'Faille de l'invocateur'...
    duree_sec   int,
    jouee       boolean NOT NULL DEFAULT true,   -- false : map 5 jamais jouée
    UNIQUE (serie_id, numero)
);

-- Statistiques d'un participant (équipe ou joueur seul) sur une partie.
-- Les colonnes communes à tous les jeux sont de vraies colonnes ;
-- ce qui est propre à un jeu va dans "details" (format JSON) :
--   LoL      : {"drakes": 3, "ame": "infernale", "nashors": 1, "tours": 9}
--   Fortnite : {"points": 34}
--   Rocket League : {"buts": 4, "arrets": 7}
CREATE TABLE stat_participant (
    partie_id        int NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    participation_id int NOT NULL REFERENCES participation(id) ON DELETE CASCADE,
    gagne            boolean,                -- vainqueur de la map
    classement       int,                    -- position dans la game (lobby)
    eliminations     int,                    -- kills de l'équipe
    details          jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY (partie_id, participation_id)
);

-- Statistiques individuelles d'un joueur sur une partie.
-- Même principe : colonnes communes + "details" pour le reste.
--   LoL      : {"or": 14200, "cs": 312, "vision": 41}
--   Valorant : {"acs": 245, "premier_kill": 3, "headshot_pct": 28}
CREATE TABLE stat_joueur (
    partie_id        int NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    joueur_id        int NOT NULL REFERENCES joueur(id),
    participation_id int NOT NULL REFERENCES participation(id) ON DELETE CASCADE,
    personnage       text,                   -- champion, agent, skin...
    kills            int,
    morts            int,
    assists          int,
    degats_infliges  int,
    degats_subis     int,
    details          jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY (partie_id, joueur_id)
);
CREATE INDEX stat_joueur_joueur_idx ON stat_joueur (joueur_id);

-- Historique des notes Elo calculées par le moteur de cotes, après chaque
-- série. Permet d'afficher la courbe de forme d'une équipe.
CREATE TABLE note_elo (
    equipe_id  int  NOT NULL REFERENCES equipe(id),
    jeu_id     int  NOT NULL REFERENCES jeu(id),
    serie_id   int  NOT NULL REFERENCES serie(id),
    note       numeric(7,2) NOT NULL,
    PRIMARY KEY (equipe_id, jeu_id, serie_id)
);


-- ===========================================================================
--  C. PARIS ET LIGUES ENTRE AMIS
-- ===========================================================================

-- Les joueurs de l'application (tes amis). L'identité de connexion (pseudo,
-- mot de passe haché) est dans les tables de Better Auth ; on y relie le
-- joueur par "auth_id". Vide seulement pour les comptes de démonstration.
CREATE TABLE utilisateur (
    id       serial PRIMARY KEY,
    pseudo   text NOT NULL UNIQUE,
    auth_id  text UNIQUE REFERENCES "user" (id) ON DELETE CASCADE,
    cree_le  timestamptz NOT NULL DEFAULT now()
);

-- Une ligue = un groupe d'amis avec SES règles d'économie.
-- Chaque groupe peut ainsi régler son propre équilibre.
CREATE TABLE ligue (
    id               serial PRIMARY KEY,
    nom              text NOT NULL,
    code_invitation  text NOT NULL UNIQUE,
    createur_id      int  REFERENCES utilisateur(id),   -- vide : ligue créée par l'administrateur du serveur
    solde_depart     int  NOT NULL DEFAULT 1000 CHECK (solde_depart > 0),
    recharge_hebdo   int  NOT NULL DEFAULT 150  CHECK (recharge_hebdo >= 0),
    mise_min         int  NOT NULL DEFAULT 10   CHECK (mise_min > 0),
    mise_max         int  NOT NULL DEFAULT 500,
    marge_pct        numeric(4,2) NOT NULL DEFAULT 0,   -- marge appliquée aux cotes
    combines_permis  boolean NOT NULL DEFAULT true,
    cree_le          timestamptz NOT NULL DEFAULT now(),
    CHECK (mise_max >= mise_min)
);

CREATE TABLE membre_ligue (
    ligue_id        int NOT NULL REFERENCES ligue(id) ON DELETE CASCADE,
    utilisateur_id  int NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'membre'
                    CHECK (role IN ('membre', 'admin', 'proprietaire')),
                    -- admin : matchs, résultats, membres ; proprietaire : en plus, nomme et
                    -- retire les admins (un seul par ligue, le premier inscrit)
    rejoint_le      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ligue_id, utilisateur_id)
);
-- Un seul propriétaire par ligue
CREATE UNIQUE INDEX un_proprietaire_par_ligue ON membre_ligue (ligue_id) WHERE role = 'proprietaire';

-- Les saisons d'une ligue : par défaut, un semestre (janvier-juin,
-- juillet-décembre). Elles sont propres à la LIGUE, pas aux jeux : chaque
-- jeu pro a son propre calendrier, mais tes amis jouent un seul championnat
-- de pronostics. À chaque nouvelle saison, tout le monde repart du solde de
-- départ, et un classement par saison est conservé pour l'historique.
CREATE TABLE saison (
    id          serial PRIMARY KEY,
    ligue_id    int  NOT NULL REFERENCES ligue(id) ON DELETE CASCADE,
    nom         text NOT NULL,               -- '2026 S1', '2026 S2'
    date_debut  date NOT NULL,
    date_fin    date NOT NULL,               -- dernier jour inclus
    CHECK (date_fin > date_debut),
    UNIQUE (ligue_id, date_debut)
);

-- Rang de chaque membre au classement de la saison, noté chaque jour (le dernier relevé
-- de la journée fait foi). Sert aux flèches « places gagnées ou perdues depuis la veille ».
CREATE TABLE rang_classement (
    ligue_id        int  NOT NULL,
    saison_id       int  NOT NULL REFERENCES saison(id) ON DELETE CASCADE,
    utilisateur_id  int  NOT NULL,
    jour            date NOT NULL,
    rang            int  NOT NULL CHECK (rang > 0),
    PRIMARY KEY (ligue_id, saison_id, jour, utilisateur_id),
    FOREIGN KEY (ligue_id, utilisateur_id)
        REFERENCES membre_ligue (ligue_id, utilisateur_id) ON DELETE CASCADE
);

-- Un marché = une question sur laquelle on peut parier.
--   type 'vainqueur'      : qui gagne la série ?
--   type 'score_exact'    : 3-1, 2-3... ?
--   type 'map_jouee'      : la map 5 sera-t-elle jouée ?
--   type 'plus_moins'     : plus ou moins de X (kills d'un joueur, drakes...)
--   type 'top'            : finira dans le top 10/5/3/1 (lobby)
--   type 'premier_objectif', 'ame' : qui prend la soul, de quel élément...
-- "statistique" + "ligne" décrivent les paris sur stats, par exemple
-- statistique = 'kills', joueur_id = Caps, ligne = 4.5
CREATE TABLE marche (
    id             serial PRIMARY KEY,
    serie_id       int  NOT NULL REFERENCES serie(id),
    partie_numero  int,                      -- vide = toute la série ; 2 = map 2 seulement
    type           text NOT NULL,
    statistique    text,
    joueur_id      int  REFERENCES joueur(id),
    equipe_id      int  REFERENCES equipe(id),
    ligne          numeric(8,1),
    libelle        text NOT NULL,            -- texte affiché : "Caps : plus ou moins de 4,5 kills"
    statut         text NOT NULL DEFAULT 'ouvert'
                   CHECK (statut IN ('ouvert', 'verrouille', 'regle', 'annule')),
    ferme_le       timestamptz NOT NULL,     -- au-delà, plus aucun pari accepté
    cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marche_serie_idx ON marche (serie_id);

-- Les réponses possibles d'un marché, chacune avec sa cote.
CREATE TABLE issue (
    id           serial PRIMARY KEY,
    marche_id    int  NOT NULL REFERENCES marche(id) ON DELETE CASCADE,
    libelle      text NOT NULL,              -- 'G2', '3-1', 'plus', 'moins', 'oui'
    probabilite  numeric(5,4) NOT NULL CHECK (probabilite > 0 AND probabilite < 1),
    cote         numeric(6,2) NOT NULL CHECK (cote >= 1.01),
    gagnante     boolean,                    -- vide tant que non réglé
    UNIQUE (marche_id, libelle)
);

-- Un pari d'un ami, dans une ligue. Un pari simple a UNE sélection,
-- un combiné en a plusieurs (toutes doivent être gagnantes).
CREATE TABLE pari (
    id              serial PRIMARY KEY,
    utilisateur_id  int  NOT NULL,
    ligue_id        int  NOT NULL,
    saison_id       int  NOT NULL REFERENCES saison(id),
    mise            int  NOT NULL CHECK (mise > 0),
    cote_totale     numeric(8,2) NOT NULL,   -- figée au moment du pari
    statut          text NOT NULL DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente', 'gagne', 'perdu', 'rembourse')),
    gain            int,                     -- rempli au règlement
    gain_reduit     boolean NOT NULL DEFAULT false,  -- combiné payé à moitié (sélection annulée)
    place_le        timestamptz NOT NULL DEFAULT now(),
    regle_le        timestamptz,
    FOREIGN KEY (ligue_id, utilisateur_id)
        REFERENCES membre_ligue (ligue_id, utilisateur_id)
);
CREATE INDEX pari_ligue_idx ON pari (ligue_id, utilisateur_id);

CREATE TABLE pari_selection (
    pari_id     int NOT NULL REFERENCES pari(id) ON DELETE CASCADE,
    issue_id    int NOT NULL REFERENCES issue(id),
    cote_prise  numeric(6,2) NOT NULL,       -- la cote au moment du pari, même si elle change ensuite
    PRIMARY KEY (pari_id, issue_id)
);

-- Garde-fou : refuser toute sélection sur un marché fermé ou verrouillé.
-- (L'application le vérifie aussi, mais la base est le dernier rempart :
-- même un bug ou une manipulation ne pourra pas faire passer un pari tardif.)
CREATE FUNCTION verifier_marche_ouvert() RETURNS trigger AS $$
DECLARE
    m marche%ROWTYPE;
BEGIN
    SELECT marche.* INTO m
      FROM marche JOIN issue ON issue.marche_id = marche.id
     WHERE issue.id = NEW.issue_id;
    IF m.statut <> 'ouvert' OR now() >= m.ferme_le THEN
        RAISE EXCEPTION 'Paris fermés pour le marché "%"', m.libelle;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pari_selection_marche_ouvert
    BEFORE INSERT ON pari_selection
    FOR EACH ROW EXECUTE FUNCTION verifier_marche_ouvert();


-- ===========================================================================
--  D. ÉCONOMIE DES NOXUS : LE REGISTRE
-- ===========================================================================
-- On ne stocke PAS un solde qu'on modifierait. On note chaque mouvement
-- (+1000 au départ, -50 pour une mise, +120 pour un gain...), et le solde
-- est la somme des mouvements. Avantages : on peut tout retracer, ce qui
-- règle les disputes entre amis, et une erreur se corrige par un mouvement
-- inverse, sans jamais effacer l'historique. C'est le principe d'un livre
-- de comptes.
CREATE TABLE mouvement_noxus (
    id              bigserial PRIMARY KEY,
    ligue_id        int  NOT NULL,
    utilisateur_id  int  NOT NULL,
    saison_id       int  NOT NULL REFERENCES saison(id),
    montant         int  NOT NULL CHECK (montant <> 0),   -- positif = crédit, négatif = débit
    motif           text NOT NULL
                    CHECK (motif IN ('depart', 'recharge', 'mise', 'gain',
                                     'remboursement', 'correction')),
    pari_id         int  REFERENCES pari(id),
    commentaire     text,
    cree_le         timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (ligue_id, utilisateur_id)
        REFERENCES membre_ligue (ligue_id, utilisateur_id) ON DELETE CASCADE
);
CREATE INDEX mouvement_membre_idx ON mouvement_noxus (saison_id, utilisateur_id);


-- ===========================================================================
--  E. PROVENANCE DES DONNÉES (la couche d'"adaptateurs")
-- ===========================================================================
-- Chaque source (Liquipedia, Leaguepedia, saisie manuelle...) a ses propres
-- identifiants. On les relie ici à NOS identifiants. Ainsi :
--   - un réimport ne crée pas de doublons ;
--   - on peut ajouter une source sans toucher au reste du schéma ;
--   - on sait toujours d'où vient une donnée (et qui citer).
CREATE TABLE source (
    id       serial PRIMARY KEY,
    code     text NOT NULL UNIQUE,           -- 'liquipedia', 'leaguepedia', 'manuel'
    nom      text NOT NULL,
    licence  text                            -- 'CC-BY-SA 3.0'...
);

CREATE TABLE identifiant_externe (
    source_id    int  NOT NULL REFERENCES source(id),
    type_entite  text NOT NULL
                 CHECK (type_entite IN ('equipe', 'joueur', 'competition',
                                        'serie', 'partie')),
    id_externe   text NOT NULL,              -- l'identifiant chez la source
    id_interne   int  NOT NULL,              -- notre "id" dans la table correspondante
    importe_le   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, type_entite, id_externe)
);


-- ===========================================================================
--  VUES : des "tableaux calculés" prêts à l'emploi
-- ===========================================================================

-- Solde de chaque membre, saison par saison
CREATE VIEW v_solde AS
SELECT s.ligue_id, s.id AS saison_id, s.nom AS saison,
       m.utilisateur_id, u.pseudo,
       COALESCE(SUM(mv.montant), 0) AS solde
  FROM saison s
  JOIN membre_ligue m ON m.ligue_id = s.ligue_id
  JOIN utilisateur u  ON u.id = m.utilisateur_id
  LEFT JOIN mouvement_noxus mv
         ON mv.saison_id = s.id AND mv.utilisateur_id = m.utilisateur_id
 GROUP BY s.ligue_id, s.id, s.nom, m.utilisateur_id, u.pseudo;

-- Roster actuel de chaque équipe, par jeu
CREATE VIEW v_roster_actuel AS
SELECT e.nom AS equipe, j.code AS jeu, jo.pseudo, c.poste, c.statut, c.date_debut
  FROM contrat c
  JOIN equipe e  ON e.id  = c.equipe_id
  JOIN jeu j     ON j.id  = c.jeu_id
  JOIN joueur jo ON jo.id = c.joueur_id
 WHERE c.date_fin IS NULL;

-- Classement d'une ligue : solde, et surtout rendement des paris réglés
-- (gains / mises), pour ne pas favoriser celui qui mise tout sur les favoris.
-- Un classement par saison : les anciennes saisons restent consultables.
CREATE VIEW v_classement AS
SELECT s.ligue_id, s.saison_id, s.saison, s.pseudo, s.solde,
       COUNT(p.id) FILTER (WHERE p.statut IN ('gagne', 'perdu'))  AS paris_regles,
       COUNT(p.id) FILTER (WHERE p.statut = 'gagne')              AS paris_gagnes,
       ROUND(SUM(COALESCE(p.gain, 0)) FILTER (WHERE p.statut IN ('gagne', 'perdu'))::numeric
             / NULLIF(SUM(p.mise) FILTER (WHERE p.statut IN ('gagne', 'perdu')), 0), 3)
                                                                  AS rendement
  FROM v_solde s
  LEFT JOIN pari p ON p.saison_id = s.saison_id AND p.utilisateur_id = s.utilisateur_id
 GROUP BY s.ligue_id, s.saison_id, s.saison, s.pseudo, s.solde;

-- Forme récente de chaque joueur : moyennes sur ses 5 dernières parties.
-- L'équipe est retrouvée via la participation : c'est l'équipe AU MOMENT
-- de la partie, donc juste même après un transfert.
CREATE VIEW v_forme_joueur AS
WITH recentes AS (
    SELECT sj.*, p.equipe_id,
           ROW_NUMBER() OVER (PARTITION BY sj.joueur_id
                              ORDER BY s.date_prevue DESC, pa.numero DESC) AS rang
      FROM stat_joueur sj
      JOIN partie pa       ON pa.id = sj.partie_id
      JOIN serie s         ON s.id  = pa.serie_id
      JOIN participation p ON p.id  = sj.participation_id
)
SELECT r.joueur_id, j.pseudo,
       COUNT(*)                         AS parties,
       ROUND(AVG(r.kills), 2)           AS kills_moy,
       ROUND(AVG(r.morts), 2)           AS morts_moy,
       ROUND(AVG(r.assists), 2)         AS assists_moy,
       ROUND(SUM(r.kills + r.assists)::numeric / NULLIF(SUM(r.morts), 0), 2) AS kda,
       ROUND(AVG(r.degats_infliges))    AS degats_moy
  FROM recentes r
  JOIN joueur j ON j.id = r.joueur_id
 WHERE r.rang <= 5
 GROUP BY r.joueur_id, j.pseudo;

-- Forme récente de chaque équipe : ses 5 dernières parties.
CREATE VIEW v_forme_equipe AS
WITH recentes AS (
    SELECT sp.*, p.equipe_id,
           ROW_NUMBER() OVER (PARTITION BY p.equipe_id
                              ORDER BY s.date_prevue DESC, pa.numero DESC) AS rang
      FROM stat_participant sp
      JOIN partie pa       ON pa.id = sp.partie_id
      JOIN serie s         ON s.id  = pa.serie_id
      JOIN participation p ON p.id  = sp.participation_id
     WHERE p.equipe_id IS NOT NULL
)
SELECT r.equipe_id, e.nom,
       COUNT(*)                                          AS parties,
       COUNT(*) FILTER (WHERE r.gagne)                   AS victoires,
       ROUND(AVG(r.eliminations), 2)                     AS kills_moy,
       ROUND(AVG((r.details->>'drakes')::int), 2)        AS drakes_moy   -- LoL
  FROM recentes r
  JOIN equipe e ON e.id = r.equipe_id
 WHERE r.rang <= 5
 GROUP BY r.equipe_id, e.nom;

COMMIT;
