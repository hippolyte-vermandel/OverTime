-- ===========================================================================
--  Données de démonstration pour OverTime (équipes et joueurs FICTIFS)
--  Les dates sont calculées à partir du moment du chargement : les matchs
--  apparaissent donc toujours "à venir" sur la page d'accueil.
--
--  À charger sur une base vide, après schema.sql et fonctions.sql :
--    psql -U overtime -d overtime -f db/demo.sql
--  À ne PAS charger sur la vraie base de la ligue.
-- ===========================================================================

BEGIN;

INSERT INTO jeu (code, nom, format) VALUES
  ('lol',      'League of Legends', 'equipes'),
  ('valorant', 'VALORANT',          'equipes'),
  ('rocket',   'Rocket League',     'equipes'),
  ('cod',      'Call of Duty',      'equipes'),
  ('2xko',     '2XKO',              'duel'),
  ('fortnite', 'Fortnite',          'lobby'),
  ('warzone',  'Warzone',           'lobby'),
  ('tft',      'TFT',               'lobby');

INSERT INTO source (code, nom) VALUES ('manuel', 'Saisie manuelle');

INSERT INTO competition (jeu_id, nom, region, categorie) VALUES
  (1, 'Ligue démo LoL',          'EMEA', 'open'),     -- 1
  (2, 'Ligue démo Valorant',     'EMEA', 'open'),     -- 2
  (2, 'Ligue démo Valorant GC',  'EMEA', 'feminine'), -- 3
  (3, 'Coupe démo Rocket',       'EMEA', 'open'),     -- 4
  (4, 'Ligue démo CoD',          'EMEA', 'open');     -- 5

INSERT INTO equipe (nom, sigle, pays) VALUES
  ('Corbeaux de Lille', 'CDL', 'FR'),   -- 1
  ('Lynx Rouges',       'LXR', 'DE'),   -- 2
  ('Hydre',             'HYD', 'ES'),   -- 3
  ('Astrolabe',         'AST', 'FR'),   -- 4
  ('Mistral',           'MIS', 'FR'),   -- 5
  ('Basilic',           'BSL', 'IT'),   -- 6
  ('Nébuleuse',         'NEB', 'BE'),   -- 7
  ('Sirocco',           'SIR', 'ES');   -- 8

-- Séries à venir : (compétition, décalage, BO, phase, équipe A, équipe B)
CREATE TEMP TABLE _a_venir (n int, comp int, dans interval, bo int, phase text,
                            a int, b int, p_a numeric);
INSERT INTO _a_venir VALUES
  (1, 1, '2 hours',          1, 'saison régulière', 1, 2, 0.62),
  (2, 1, '3 hours',          1, 'saison régulière', 3, 4, 0.45),
  (3, 2, '5 hours',          3, 'phase de groupes', 5, 6, 0.55),
  (4, 3, '1 day 2 hours',    3, 'phase de groupes', 7, 8, 0.70),
  (5, 4, '1 day 4 hours',    5, 'demi-finale',      2, 5, 0.50),
  (6, 1, '2 days 3 hours',   5, 'finale',           1, 3, 0.58),
  (7, 5, '2 days 5 hours',   5, 'saison régulière', 4, 6, 0.40);

INSERT INTO serie (id, competition_id, phase, date_prevue, best_of)
SELECT n, comp, phase, date_trunc('hour', now()) + dans, bo FROM _a_venir;
SELECT setval('serie_id_seq', (SELECT max(id) FROM serie));

INSERT INTO participation (serie_id, equipe_id, cote_terrain)
SELECT n, a, 'A' FROM _a_venir UNION ALL SELECT n, b, 'B' FROM _a_venir;

-- Marché "vainqueur" de chaque série. Probabilité de victoire de la série
-- (ici donnée directement ; en vrai, calculée par le moteur de cotes).
INSERT INTO marche (id, serie_id, type, libelle, ferme_le)
SELECT n, n, 'vainqueur', 'Vainqueur', date_trunc('hour', now()) + dans FROM _a_venir;
SELECT setval('marche_id_seq', (SELECT max(id) FROM marche));

INSERT INTO issue (marche_id, libelle, probabilite, cote)
SELECT v.n, e.nom, v.p_a, round(1 / v.p_a, 2)
  FROM _a_venir v JOIN equipe e ON e.id = v.a
UNION ALL
SELECT v.n, e.nom, 1 - v.p_a, round(1 / (1 - v.p_a), 2)
  FROM _a_venir v JOIN equipe e ON e.id = v.b;

-- Quelques marchés supplémentaires sur les BO5 (pour le "+N paris")
INSERT INTO marche (serie_id, type, libelle, ferme_le)
SELECT n, 'map_jouee', 'La map 5 sera-t-elle jouée ?', date_trunc('hour', now()) + dans
  FROM _a_venir WHERE bo = 5;
INSERT INTO marche (serie_id, type, libelle, ferme_le)
SELECT n, 'score_exact', 'Score exact', date_trunc('hour', now()) + dans
  FROM _a_venir WHERE bo = 5;

-- Une ligue de démonstration
INSERT INTO utilisateur (pseudo) VALUES ('demo');
INSERT INTO ligue (nom, code_invitation, createur_id) VALUES ('Ligue démo', 'DEMO-0000', 1);
SELECT rejoindre_ligue(1, 'DEMO-0000');
UPDATE membre_ligue SET role = 'proprietaire';

COMMIT;
