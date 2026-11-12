-- ===========================================================================
--  Tests automatiques des fonctions (base vide + schema.sql + fonctions.sql)
--  Chaque ASSERT arrête tout s'il est faux. Si le script va au bout et
--  affiche "TOUS LES TESTS PASSENT", tout est bon.
-- ===========================================================================
\set ON_ERROR_STOP 1
SET client_min_messages = warning;

-- Une fonction d'aide : vérifie qu'une instruction est bien REFUSÉE
CREATE FUNCTION doit_echouer(sql text, attendu text) RETURNS void AS $$
BEGIN
    EXECUTE sql;
    RAISE EXCEPTION 'ÉCHEC DU TEST : aurait dû être refusé -> %', sql;
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ÉCHEC DU TEST%' THEN RAISE; END IF;
    IF position(attendu IN SQLERRM) = 0 THEN
        RAISE EXCEPTION 'Mauvais refus pour % : %', sql, SQLERRM;
    END IF;
    RAISE NOTICE 'refus attendu OK : %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ---- Mise en place --------------------------------------------------------
INSERT INTO jeu (code, nom, format) VALUES ('lol', 'League of Legends', 'equipes');
INSERT INTO competition (jeu_id, nom, region) VALUES (1, 'Ligue fictive', 'EMEA');
INSERT INTO equipe (nom) VALUES ('Corbeaux de Lille'), ('Lynx Rouges');
INSERT INTO joueur (pseudo) VALUES ('Aster');
-- Trois matchs à venir : un pari ne peut viser qu'une fois chaque match
INSERT INTO serie (competition_id, date_prevue, best_of) VALUES
  (1, now() + interval '1 hour', 5),                               -- match 1
  (1, now() + interval '1 hour', 5),                               -- match 2
  (1, now() + interval '1 hour', 5);                               -- match 3

INSERT INTO utilisateur (pseudo) VALUES ('seb'), ('lea'), ('tom'), ('intrus'), ('zoe');
INSERT INTO ligue (nom, code_invitation, createur_id) VALUES ('Les potes', 'NOX-1', 1);
INSERT INTO ligue (nom, code_invitation, createur_id, combines_permis)
VALUES ('Sans combinés', 'NOX-2', 1, false);

SELECT rejoindre_ligue(1, 'NOX-1'), rejoindre_ligue(2, 'NOX-1'),
       rejoindre_ligue(3, 'NOX-1'), rejoindre_ligue(1, 'NOX-2'),
       rejoindre_ligue(5, 'NOX-1');

DO $$ BEGIN
    ASSERT solde(1, 1) = 1000 AND solde(1, 2) = 1000 AND solde(1, 3) = 1000,
           'solde de départ';
END $$;

INSERT INTO marche (serie_id, type, libelle, ferme_le) VALUES
  (1, 'vainqueur', 'Vainqueur', now() + interval '1 hour'),        -- marché 1 (match 1)
  (2, 'map_jouee', 'Map 5 jouée ?', now() + interval '1 hour'),    -- marché 2 (match 2)
  (3, 'plus_moins', 'Aster kills', now() + interval '1 hour'),     -- marché 3 (match 3)
  (1, 'map_jouee', 'Map 5 jouée ?', now() + interval '1 hour');    -- marché 4 (match 1)
INSERT INTO issue (marche_id, libelle, probabilite, cote) VALUES
  (1, 'Corbeaux', .68, 1.47), (1, 'Lynx', .32, 3.15),             -- issues 1, 2
  (2, 'oui', .345, 2.90),     (2, 'non', .655, 1.53),             -- issues 3, 4
  (3, 'plus', .48, 2.08),     (3, 'moins', .52, 1.92),            -- issues 5, 6
  (4, 'oui', .40, 2.50),      (4, 'non', .60, 1.67);              -- issues 7, 8

-- ---- Paris valides --------------------------------------------------------
SELECT placer_pari(2, 1, 100, ARRAY[1]);       -- pari 1 : Léa, simple Corbeaux
SELECT placer_pari(3, 1,  50, ARRAY[2, 3]);    -- pari 2 : Tom, combiné Lynx + map 5
SELECT placer_pari(1, 1,  80, ARRAY[1, 5]);    -- pari 3 : Seb, combiné Corbeaux + plus

DO $$ BEGIN
    ASSERT solde(1, 2) = 900, 'Léa débitée';
    ASSERT (SELECT cote_totale FROM pari WHERE id = 2) = 9.14, 'cote du combiné';
    ASSERT (SELECT COUNT(*) FROM pari_selection WHERE pari_id = 2) = 2, 'deux sélections';
END $$;

-- ---- Paris refusés --------------------------------------------------------
SELECT doit_echouer('SELECT placer_pari(4, 1, 50, ARRAY[1])', 'pas membre');
SELECT doit_echouer('SELECT placer_pari(2, 1, 600, ARRAY[1])', 'hors limites');
SELECT doit_echouer('SELECT placer_pari(2, 1, 5, ARRAY[1])', 'hors limites');
SELECT doit_echouer('SELECT placer_pari(2, 1, 50, ARRAY[1, 2])', 'même marché');
SELECT doit_echouer('SELECT placer_pari(2, 1, 50, ARRAY[]::int[])', 'Aucune');
SELECT doit_echouer('SELECT placer_pari(2, 1, 50, ARRAY[1, 999])', 'inconnue');
SELECT doit_echouer('SELECT placer_pari(1, 2, 50, ARRAY[1, 3])', 'combinés');
-- Un seul pari par match : ni l'autre équipe, ni un marché secondaire du même match
SELECT doit_echouer('SELECT placer_pari(2, 1, 50, ARRAY[2])', 'déjà un pari sur ce match');
SELECT doit_echouer('SELECT placer_pari(2, 1, 50, ARRAY[7])', 'déjà un pari sur ce match');
SELECT doit_echouer('SELECT placer_pari(5, 1, 50, ARRAY[1, 7])', 'une sélection par match');
-- Léa a 900 : 500 passe, puis 400 passe, puis plus rien
SELECT placer_pari(2, 1, 500, ARRAY[4]);       -- pari 4 : Léa, "non" map 5
SELECT placer_pari(2, 1, 400, ARRAY[6]);       -- pari 5 : Léa, "moins" de kills
SELECT doit_echouer('SELECT placer_pari(2, 1, 10, ARRAY[1])', 'Solde insuffisant');
-- Un refus ne doit rien avoir écrit
DO $$ BEGIN
    ASSERT (SELECT COUNT(*) FROM pari) = 5, 'aucun pari fantôme après les refus';
    ASSERT solde(1, 2) = 0, 'Léa à zéro';
END $$;

-- Zoé : combiné de trois matchs, dont la cote restante dépassera 2
SELECT placer_pari(5, 1, 60, ARRAY[1, 4, 5]);  -- pari 6 : Corbeaux + map 5 non + plus

-- ---- Saisons : pas de pari sur un match après la fin du semestre -----------
INSERT INTO serie (competition_id, date_prevue, best_of)
VALUES (1, (date_trunc('year', now()) + interval '13 months')::timestamptz, 5);  -- match 4
INSERT INTO marche (serie_id, type, libelle, ferme_le)
VALUES (4, 'vainqueur', 'Match de la saison prochaine', now() + interval '400 days');  -- marché 5
INSERT INTO issue (marche_id, libelle, probabilite, cote) VALUES (5, 'Corbeaux', .5, 2);  -- issue 9
SELECT doit_echouer('SELECT placer_pari(3, 1, 10, ARRAY[9])', 'fin de la saison');

-- ---- Le match commence ----------------------------------------------------
UPDATE marche SET ferme_le = now() - interval '1 second' WHERE serie_id IN (1, 2, 3);
-- Seb n'a rien parié dans sa seconde ligue : seul le match commencé l'arrête
SELECT doit_echouer('SELECT placer_pari(1, 2, 10, ARRAY[1])', 'Paris fermés');

-- ---- Règlement ------------------------------------------------------------
SELECT doit_echouer('SELECT regler_marche(1, ''G2'')', 'inconnue');
SELECT regler_marche(1, 'Corbeaux');           -- les Corbeaux gagnent

DO $$ BEGIN
    ASSERT (SELECT statut FROM pari WHERE id = 1) = 'gagne', 'Léa gagne le simple';
    ASSERT (SELECT gain FROM pari WHERE id = 1) = 147, 'gain 100 x 1,47';
    ASSERT (SELECT statut FROM pari WHERE id = 2) = 'perdu', 'combiné de Tom perdu';
    ASSERT (SELECT statut FROM pari WHERE id = 3) = 'en_attente',
           'combiné de Seb attend le marché des kills';
END $$;

-- Le marché des kills est annulé (ex. Aster remplacé). Règle de la ligue :
-- combiné payé sur les cotes restantes, divisé par deux, et au minimum la mise.
-- Seb : 80 x 1,47 / 2 = 58 < 80 -> mise remboursée en entier
SELECT annuler_marche(3);
DO $$ BEGIN
    ASSERT (SELECT statut FROM pari WHERE id = 3) = 'rembourse', 'Seb remboursé';
    ASSERT (SELECT gain FROM pari WHERE id = 3) = 80, 'remboursement de la mise';
    ASSERT (SELECT statut FROM pari WHERE id = 5) = 'rembourse', 'simple annulé remboursé';
    ASSERT (SELECT gain FROM pari WHERE id = 5) = 400, 'remboursement intégral';
END $$;

SELECT regler_marche(2, 'non');                -- la map 5 n'est pas jouée
DO $$ BEGIN
    -- Zoé : 60 x 1,47 x 1,53 / 2 = 67,47 -> 67, supérieur à la mise : payé
    ASSERT (SELECT statut FROM pari WHERE id = 6) = 'gagne', 'combiné de Zoé gagné';
    ASSERT (SELECT gain FROM pari WHERE id = 6) = 67, 'moitié du gain';
    ASSERT (SELECT gain_reduit FROM pari WHERE id = 6), 'gain marqué comme réduit';
    ASSERT (SELECT gain FROM pari WHERE id = 4) = 765, 'gain 500 x 1,53';
    ASSERT (SELECT COUNT(*) FROM mouvement_noxus WHERE pari_id = 2) = 1,
           'Tom (déjà perdant) n''est ni payé ni redébité';
END $$;

SELECT doit_echouer('SELECT regler_marche(1, ''Lynx'')', 'déjà réglé');

-- ---- Bilan des soldes -----------------------------------------------------
DO $$ BEGIN
    ASSERT solde(1, 1) = 1000 - 80 + 80,              'solde de Seb';
    ASSERT solde(1, 2) = 1000 - 1000 + 147 + 765 + 400, 'solde de Léa';
    ASSERT solde(1, 3) = 1000 - 50,                   'solde de Tom';
    ASSERT solde(1, 5) = 1000 - 60 + 67,              'solde de Zoé';
END $$;

-- ---- Recharges ------------------------------------------------------------
DO $$ BEGIN
    ASSERT crediter_recharges() = 0, 'pas de recharge la première semaine';
END $$;
UPDATE mouvement_noxus SET cree_le = cree_le - interval '8 days';
DO $$ BEGIN
    ASSERT crediter_recharges() = 5, 'une recharge par membre de chaque ligue';
    ASSERT crediter_recharges() = 0, 'relancer ne recrédite pas';
    ASSERT solde(1, 3) = 950 + 150, 'Tom rechargé de 150';
END $$;

-- ---- Nouvelle saison : tout le monde repart de 1000 ----------------------
DO $$
DECLARE
    debut_suivante date := (date_trunc('year', now())
        + CASE WHEN extract(month FROM now()) <= 6 THEN interval '6 months'
               ELSE interval '12 months' END)::date;
    nouvelle int;
BEGIN
    ASSERT crediter_recharges(debut_suivante + 2) = 5, 'un départ par membre';
    nouvelle := saison_courante(1, debut_suivante + 2);
    ASSERT solde_saison(nouvelle, 2) = 1000, 'Léa repart de 1000';
    ASSERT solde_saison(nouvelle, 3) = 1000, 'Tom repart de 1000';
    ASSERT crediter_recharges(debut_suivante + 2) = 0, 'pas de double départ';
    ASSERT (SELECT COUNT(*) FROM saison WHERE ligue_id = 1) = 2, 'deux saisons';
END $$;

-- ---- Épreuve en lobby : paris « top X », un pari par participant ---------
INSERT INTO jeu (code, nom, format) VALUES ('fortnite', 'Fortnite', 'lobby');
INSERT INTO competition (jeu_id, nom, region)
SELECT id, 'FNCS', 'EU' FROM jeu WHERE code = 'fortnite';
DO $$
DECLARE
    s   int;
    pa  int;
    mk  int;
    g   text;
BEGIN
    INSERT INTO serie (competition_id, date_prevue, best_of)
    SELECT id, now() + interval '1 hour', NULL FROM competition WHERE nom = 'FNCS' RETURNING id INTO s;
    FOREACH g IN ARRAY ARRAY['Alpha / Bravo', 'Charlie / Delta', 'Echo / Fox'] LOOP
        INSERT INTO participation (serie_id, libelle) VALUES (s, g) RETURNING id INTO pa;
        INSERT INTO marche (serie_id, type, participation_id, ligne, libelle, ferme_le)
        VALUES (s, 'top', pa, 1, g || ' : top 1', now() + interval '1 hour') RETURNING id INTO mk;
        INSERT INTO issue (marche_id, libelle, probabilite, cote) VALUES (mk, 'oui', .33, 3), (mk, 'non', .67, 1.5);
    END LOOP;
    -- un groupe sans aucun libellé ni équipe est refusé
    BEGIN
        INSERT INTO participation (serie_id) VALUES (s);
        RAISE EXCEPTION 'participant vide accepté';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;
CREATE TEMP VIEW t_issue AS
SELECT i.id, pa.libelle AS groupe, i.libelle AS reponse
  FROM issue i JOIN marche m ON m.id = i.marche_id JOIN participation pa ON pa.id = m.participation_id;
-- Zoé parie sur deux duos de la même épreuve : permis
SELECT placer_pari(5, 1, 50, ARRAY[(SELECT id FROM t_issue WHERE groupe = 'Alpha / Bravo' AND reponse = 'oui')]);
SELECT placer_pari(5, 1, 40, ARRAY[(SELECT id FROM t_issue WHERE groupe = 'Charlie / Delta' AND reponse = 'oui')]);
-- mais pas deux fois sur le même duo
SELECT doit_echouer(format('SELECT placer_pari(5, 1, 50, ARRAY[%s])', (SELECT id FROM t_issue WHERE groupe = 'Alpha / Bravo' AND reponse = 'non')), 'déjà un pari sur ce participant');
-- ni deux sélections de la même épreuve dans un combiné
SELECT doit_echouer(format('SELECT placer_pari(5, 1, 50, ARRAY[%s, %s])',
    (SELECT id FROM t_issue WHERE groupe = 'Echo / Fox' AND reponse = 'oui'),
    (SELECT id FROM t_issue WHERE groupe = 'Charlie / Delta' AND reponse = 'non')), 'une sélection par match');
DO $$
DECLARE
    s int := (SELECT serie_id FROM participation WHERE libelle = 'Alpha / Bravo');
    avant int := solde(1, 5);
BEGIN
    UPDATE marche SET ferme_le = now() - interval '1 second' WHERE serie_id = s;
    PERFORM doit_echouer(format('SELECT regler_epreuve(%s)', s), 'Aucun classement');
    UPDATE participation SET classement = 1 WHERE libelle = 'Alpha / Bravo';
    UPDATE participation SET classement = 3 WHERE libelle = 'Charlie / Delta';
    -- Echo / Fox absent du classement : ses paris seront remboursés
    PERFORM regler_epreuve(s);
    ASSERT (SELECT statut FROM marche WHERE participation_id = (SELECT id FROM participation WHERE libelle = 'Echo / Fox')) = 'annule', 'absent : marché annulé';
    ASSERT (SELECT p.statut FROM pari p JOIN pari_selection ps ON ps.pari_id = p.id JOIN t_issue t ON t.id = ps.issue_id WHERE t.groupe = 'Alpha / Bravo') = 'gagne', 'Alpha / Bravo top 1 : gagné';
    ASSERT (SELECT p.statut FROM pari p JOIN pari_selection ps ON ps.pari_id = p.id JOIN t_issue t ON t.id = ps.issue_id WHERE t.groupe = 'Charlie / Delta') = 'perdu', 'Charlie / Delta 3e : perdu';
    ASSERT solde(1, 5) = avant + 150, 'Zoé touche 50 x 3';
    ASSERT (SELECT statut FROM serie WHERE id = s) = 'terminee', 'épreuve terminée';
    ASSERT regler_epreuve(s) = 0, 'relancer ne règle rien deux fois';
    ASSERT solde(1, 5) = avant + 150, 'ni ne paie deux fois';
END $$;

\echo 'Classements par saison (l''ancienne saison reste consultable) :'
SELECT saison, pseudo, solde, paris_regles, paris_gagnes, rendement
  FROM v_classement WHERE ligue_id = 1 ORDER BY saison, rendement DESC NULLS LAST;

\echo 'TOUS LES TESTS PASSENT'
