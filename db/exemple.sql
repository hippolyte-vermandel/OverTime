-- ===========================================================================
--  Jeu de données d'exemple (équipes et joueurs FICTIFS)
--  À charger après schema.sql et fonctions.sql :
--  psql -f schema.sql -f fonctions.sql -f exemple.sql
-- ===========================================================================

INSERT INTO jeu (code, nom, format) VALUES
  ('lol', 'League of Legends', 'equipes'),
  ('valorant', 'VALORANT', 'equipes'),
  ('fortnite', 'Fortnite', 'lobby'),
  ('2xko', '2XKO', 'duel');

INSERT INTO source (code, nom, licence) VALUES
  ('manuel', 'Saisie manuelle', NULL),
  ('leaguepedia', 'Leaguepedia', 'CC-BY-SA 3.0');

INSERT INTO competition (jeu_id, nom, region, date_debut, date_fin) VALUES
  (1, 'Ligue fictive 2026 Spring', 'EMEA', '2026-03-20', '2026-06-01'),
  (3, 'Coupe fictive Fortnite 2026', 'EMEA', '2026-05-01', '2026-05-03');

INSERT INTO equipe (nom, sigle, pays) VALUES
  ('Corbeaux de Lille', 'CDL', 'FR'),
  ('Lynx Rouges', 'LXR', 'DE'),
  ('Hydre', 'HYD', 'ES');

INSERT INTO joueur (pseudo, pays) VALUES
  ('Aster', 'FR'), ('Brume', 'FR'), ('Celt', 'BE'), ('Dorn', 'FR'), ('Elio', 'IT'),
  ('Fang', 'DE'), ('Gale', 'DE'), ('Hux', 'PL'), ('Ivo', 'DE'), ('Jarl', 'SE'),
  ('Kesh', 'ES');

-- Aster a joué chez Hydre avant de rejoindre les Corbeaux (historique)
INSERT INTO contrat (joueur_id, equipe_id, jeu_id, poste, date_debut, date_fin) VALUES
  (1, 3, 1, 'mid', '2024-01-10', '2025-11-20'),
  (1, 1, 1, 'mid', '2025-11-21', NULL),
  (2, 1, 1, 'top', '2025-01-05', NULL),
  (3, 1, 1, 'jungle', '2025-01-05', NULL),
  (4, 1, 1, 'adc', '2025-01-05', NULL),
  (5, 1, 1, 'support', '2025-01-05', NULL),
  (6, 2, 1, 'top', '2025-01-05', NULL),
  (7, 2, 1, 'jungle', '2025-01-05', NULL),
  (8, 2, 1, 'mid', '2025-01-05', NULL),
  (9, 2, 1, 'adc', '2025-01-05', NULL),
  (10, 2, 1, 'support', '2025-01-05', NULL);

-- Une finale en BO5, terminée 3-1 pour les Corbeaux
INSERT INTO serie (competition_id, phase, date_prevue, best_of, statut, resultat_valide)
VALUES (1, 'finale', '2026-05-30 16:00+00', 5, 'terminee', true);

INSERT INTO participation (serie_id, equipe_id, cote_terrain, score, classement) VALUES
  (1, 1, 'A', 3, 1),
  (1, 2, 'B', 1, 2);

INSERT INTO partie (serie_id, numero, carte, duree_sec, jouee) VALUES
  (1, 1, 'Faille de l''invocateur', 1920, true),
  (1, 2, 'Faille de l''invocateur', 2210, true),
  (1, 3, 'Faille de l''invocateur', 1805, true),
  (1, 4, 'Faille de l''invocateur', 2050, true),
  (1, 5, NULL, NULL, false);              -- la map 5 n'a pas été jouée

INSERT INTO stat_participant (partie_id, participation_id, gagne, eliminations, details) VALUES
  (1, 1, true,  18, '{"drakes": 4, "ame": "infernale", "nashors": 1}'),
  (1, 2, false,  9, '{"drakes": 1, "nashors": 0}'),
  (2, 1, false, 11, '{"drakes": 2, "nashors": 0}'),
  (2, 2, true,  21, '{"drakes": 4, "ame": "oceane", "nashors": 2}'),
  (3, 1, true,  24, '{"drakes": 3, "nashors": 1}'),
  (3, 2, false,  7, '{"drakes": 1, "nashors": 0}'),
  (4, 1, true,  15, '{"drakes": 4, "ame": "montagne", "nashors": 1}'),
  (4, 2, false, 12, '{"drakes": 2, "nashors": 1}');

INSERT INTO stat_joueur (partie_id, joueur_id, participation_id, personnage,
                         kills, morts, assists, degats_infliges) VALUES
  (1, 1, 1, 'Ahri', 7, 1, 8, 24100),
  (2, 1, 1, 'Orianna', 2, 4, 6, 18900),
  (3, 1, 1, 'Sylas', 9, 0, 10, 27800),
  (4, 1, 1, 'Ahri', 5, 2, 7, 21300),
  (1, 8, 2, 'Azir', 3, 4, 4, 19800);

-- Les amis et leur ligue
INSERT INTO utilisateur (pseudo) VALUES ('seb'), ('lea'), ('tom');

INSERT INTO ligue (nom, code_invitation, createur_id) VALUES ('Les potes', 'NOX-4821', 1);

-- On passe TOUJOURS par les fonctions pour tout ce qui touche aux noxus
SELECT rejoindre_ligue(1, 'NOX-4821'), rejoindre_ligue(2, 'NOX-4821'),
       rejoindre_ligue(3, 'NOX-4821');
UPDATE membre_ligue SET role = 'admin' WHERE utilisateur_id = 1;

-- Marchés ouverts avant le match
INSERT INTO marche (serie_id, type, libelle, ferme_le) VALUES
  (1, 'vainqueur', 'Vainqueur de la finale', now() + interval '1 hour'),
  (1, 'map_jouee', 'La map 5 sera-t-elle jouée ?', now() + interval '1 hour');
INSERT INTO marche (serie_id, partie_numero, type, statistique, joueur_id, ligne,
                    libelle, ferme_le)
VALUES (1, 1, 'plus_moins', 'kills', 1, 4.5,
        'Aster : plus ou moins de 4,5 kills (map 1)', now() + interval '1 hour');

INSERT INTO issue (marche_id, libelle, probabilite, cote) VALUES
  (1, 'Corbeaux de Lille', 0.6820, 1.47),
  (1, 'Lynx Rouges',       0.3180, 3.15),
  (2, 'oui', 0.3450, 2.90),
  (2, 'non', 0.6550, 1.53),
  (3, 'plus',  0.4800, 2.08),
  (3, 'moins', 0.5200, 1.92);

SELECT placer_pari(2, 1, 100, ARRAY[1]);     -- Léa : simple sur les Corbeaux
SELECT placer_pari(3, 1,  50, ARRAY[2, 3]);  -- Tom : combiné Lynx + map 5 jouée
SELECT placer_pari(1, 1,  80, ARRAY[5]);     -- Seb : plus de 4,5 kills pour Aster

-- Le match commence (on simule l'heure de début), puis l'admin règle
UPDATE marche SET ferme_le = now() - interval '1 second';
SELECT regler_marche(1, 'Corbeaux de Lille');
SELECT regler_marche(2, 'non');
SELECT regler_marche(3, 'plus');
