-- ===========================================================================
--  NOXUS - Fonctions qui manipulent l'argent virtuel
--  À charger après schema.sql : psql -f schema.sql -f fonctions.sql
-- ===========================================================================
--
--  Règle d'or : l'application n'écrit JAMAIS directement dans pari,
--  pari_selection ou mouvement_noxus. Elle appelle ces fonctions, qui font
--  tout d'un bloc (une "transaction") : soit tout réussit, soit rien n'est
--  écrit. Impossible d'avoir un pari sans débit, ou un débit sans pari.
--
--   saison_courante(...)    : la saison en cours (créée automatiquement)
--   placer_pari(...)        : vérifie tout, crée le pari, débite les noxus
--   regler_marche(...)      : enregistre la bonne réponse, paie les gagnants
--   annuler_marche(...)     : match annulé, map non jouée... rembourse
--   crediter_recharges()    : solde de départ en début de saison,
--                             puis recharge hebdomadaire
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
--  SAISON EN COURS d'une ligue à une date donnée.
--  Si elle n'existe pas encore, on crée le semestre correspondant :
--  1er janvier - 30 juin ("S1") ou 1er juillet - 31 décembre ("S2").
-- ---------------------------------------------------------------------------
CREATE FUNCTION saison_courante(p_ligue int, p_jour date DEFAULT current_date)
RETURNS int AS $$
DECLARE
    v_id    int;
    debut   date;
BEGIN
    SELECT id INTO v_id FROM saison
     WHERE ligue_id = p_ligue AND p_jour BETWEEN date_debut AND date_fin;
    IF FOUND THEN
        RETURN v_id;
    END IF;
    debut := make_date(extract(year FROM p_jour)::int,
                       CASE WHEN extract(month FROM p_jour) <= 6 THEN 1 ELSE 7 END, 1);
    INSERT INTO saison (ligue_id, nom, date_debut, date_fin)
    VALUES (p_ligue,
            extract(year FROM p_jour)::text
              || CASE WHEN extract(month FROM p_jour) <= 6 THEN ' S1' ELSE ' S2' END,
            debut, (debut + interval '6 months' - interval '1 day')::date)
    ON CONFLICT (ligue_id, date_debut) DO NOTHING;
    SELECT id INTO v_id FROM saison
     WHERE ligue_id = p_ligue AND p_jour BETWEEN date_debut AND date_fin;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
--  SOLDE d'un membre dans une saison (par défaut : la saison en cours)
-- ---------------------------------------------------------------------------
CREATE FUNCTION solde_saison(p_saison int, p_utilisateur int) RETURNS int AS $$
    SELECT COALESCE(SUM(montant), 0)::int
      FROM mouvement_noxus
     WHERE saison_id = p_saison AND utilisateur_id = p_utilisateur;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION solde(p_ligue int, p_utilisateur int) RETURNS int AS $$
    SELECT solde_saison(saison_courante(p_ligue), p_utilisateur);
$$ LANGUAGE sql;


-- ---------------------------------------------------------------------------
--  SOLDE DE DÉPART : versé une fois par saison et par membre.
--  Renvoie true si le versement vient d'être fait.
-- ---------------------------------------------------------------------------
CREATE FUNCTION assurer_depart(p_ligue int, p_utilisateur int, p_saison int,
                               p_quand timestamptz DEFAULT now())
RETURNS boolean AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM mouvement_noxus
                WHERE saison_id = p_saison AND utilisateur_id = p_utilisateur
                  AND motif = 'depart') THEN
        RETURN false;
    END IF;
    INSERT INTO mouvement_noxus (ligue_id, utilisateur_id, saison_id, montant, motif, cree_le)
    SELECT p_ligue, p_utilisateur, p_saison, solde_depart, 'depart', p_quand
      FROM ligue WHERE id = p_ligue;
    RETURN true;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
--  PLACER UN PARI
--  p_issues : la liste des issues choisies. Une seule = pari simple,
--  plusieurs = combiné. Renvoie le numéro du pari créé.
-- ---------------------------------------------------------------------------
CREATE FUNCTION placer_pari(p_utilisateur int, p_ligue int, p_mise int,
                            p_issues int[]) RETURNS int AS $$
DECLARE
    regles      ligue%ROWTYPE;
    nb          int := COALESCE(array_length(p_issues, 1), 0);
    nb_marches  int;
    cote_tot    numeric := 1;
    sel         record;
    v_pari      int;
    v_saison    int;
    fin_saison  date;
BEGIN
    -- 1. Le joueur est-il membre ? On "verrouille" sa ligne pendant
    --    l'opération : deux paris envoyés en même temps (double clic...)
    --    sont traités l'un après l'autre, sans pouvoir dépasser le solde.
    PERFORM 1 FROM membre_ligue
     WHERE ligue_id = p_ligue AND utilisateur_id = p_utilisateur
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tu n''es pas membre de cette ligue';
    END IF;

    SELECT * INTO regles FROM ligue WHERE id = p_ligue;

    -- Saison en cours ; premier pari de la saison = versement du solde de départ
    v_saison := saison_courante(p_ligue);
    SELECT date_fin INTO fin_saison FROM saison WHERE id = v_saison;
    PERFORM assurer_depart(p_ligue, p_utilisateur, v_saison);

    -- 2. La mise respecte-t-elle les règles de la ligue et le solde ?
    IF p_mise < regles.mise_min OR p_mise > regles.mise_max THEN
        RAISE EXCEPTION 'Mise hors limites : entre % et % noxus',
                        regles.mise_min, regles.mise_max;
    END IF;
    IF solde_saison(v_saison, p_utilisateur) < p_mise THEN
        RAISE EXCEPTION 'Solde insuffisant (% noxus disponibles)',
                        solde_saison(v_saison, p_utilisateur);
    END IF;

    -- 3. Les sélections sont-elles valides ?
    IF nb = 0 THEN
        RAISE EXCEPTION 'Aucune sélection';
    END IF;
    IF nb > 1 AND NOT regles.combines_permis THEN
        RAISE EXCEPTION 'Les combinés ne sont pas autorisés dans cette ligue';
    END IF;
    IF (SELECT COUNT(*) FROM issue WHERE id = ANY (p_issues)) <> nb THEN
        RAISE EXCEPTION 'Sélection inconnue ou en double';
    END IF;
    -- Pas deux réponses à la même question dans un combiné
    -- ("G2 gagne" ET "Fnatic gagne" n'a pas de sens)
    SELECT COUNT(DISTINCT marche_id) INTO nb_marches
      FROM issue WHERE id = ANY (p_issues);
    IF nb_marches <> nb THEN
        RAISE EXCEPTION 'Un combiné ne peut pas contenir deux issues du même marché';
    END IF;

    -- Un pari ne peut pas déborder sur la saison suivante
    IF EXISTS (SELECT 1 FROM issue i
                 JOIN marche m ON m.id = i.marche_id
                 JOIN serie  s ON s.id = m.serie_id
                WHERE i.id = ANY (p_issues) AND s.date_prevue::date > fin_saison) THEN
        RAISE EXCEPTION 'Ce match a lieu après la fin de la saison (%)', fin_saison;
    END IF;

    -- 4. Cote totale = produit des cotes (figées à cet instant)
    FOR sel IN SELECT cote FROM issue WHERE id = ANY (p_issues) LOOP
        cote_tot := cote_tot * sel.cote;
    END LOOP;

    -- 5. Écritures : le pari, ses sélections, le débit.
    --    Le déclencheur verifier_marche_ouvert refuse un marché fermé.
    INSERT INTO pari (utilisateur_id, ligue_id, saison_id, mise, cote_totale)
    VALUES (p_utilisateur, p_ligue, v_saison, p_mise, round(cote_tot, 2))
    RETURNING id INTO v_pari;

    INSERT INTO pari_selection (pari_id, issue_id, cote_prise)
    SELECT v_pari, id, cote FROM issue WHERE id = ANY (p_issues);

    INSERT INTO mouvement_noxus (ligue_id, utilisateur_id, saison_id, montant, motif, pari_id)
    VALUES (p_ligue, p_utilisateur, v_saison, -p_mise, 'mise', v_pari);

    RETURN v_pari;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
--  ÉVALUER UN PARI (utilisée par regler_marche et annuler_marche)
--  Un pari se règle quand toutes ses sélections sont connues :
--    - une sélection perdante            -> pari perdu
--    - toutes les sélections annulées    -> mise remboursée
--    - combiné avec une sélection annulée, et tout le reste gagné :
--      on calcule le gain sans la sélection annulée, et on en verse
--      la MOITIÉ (règle de la ligue : le risque du combiné est partagé) ;
--      si cette moitié est inférieure à la mise, la mise est remboursée
--      en entier (on ne "gagne" jamais en perdant des noxus)
--  Tant qu'une sélection attend son résultat, le pari reste en attente.
-- ---------------------------------------------------------------------------
CREATE FUNCTION evaluer_pari(p_pari int) RETURNS void AS $$
DECLARE
    p           pari%ROWTYPE;
    perdues     int;
    en_attente  int;
    valides     int;
    annulees    int;
    cote_finale numeric := 1;
    sel         record;
    v_gain      int;
BEGIN
    SELECT * INTO p FROM pari WHERE id = p_pari FOR UPDATE;
    IF p.statut <> 'en_attente' THEN
        RETURN;                              -- déjà réglé : on ne paie jamais deux fois
    END IF;

    SELECT COUNT(*) FILTER (WHERE m.statut <> 'annule' AND i.gagnante IS FALSE),
           COUNT(*) FILTER (WHERE m.statut <> 'annule' AND i.gagnante IS NULL),
           COUNT(*) FILTER (WHERE m.statut <> 'annule'),
           COUNT(*) FILTER (WHERE m.statut = 'annule')
      INTO perdues, en_attente, valides, annulees
      FROM pari_selection ps
      JOIN issue i  ON i.id = ps.issue_id
      JOIN marche m ON m.id = i.marche_id
     WHERE ps.pari_id = p_pari;

    IF perdues > 0 THEN
        UPDATE pari SET statut = 'perdu', gain = 0, regle_le = now() WHERE id = p_pari;
        RETURN;
    END IF;
    IF en_attente > 0 THEN
        RETURN;                              -- on attendra les autres résultats
    END IF;
    IF valides = 0 THEN                      -- tout a été annulé
        UPDATE pari SET statut = 'rembourse', gain = p.mise, regle_le = now()
         WHERE id = p_pari;
        INSERT INTO mouvement_noxus (ligue_id, utilisateur_id, saison_id, montant, motif, pari_id)
        VALUES (p.ligue_id, p.utilisateur_id, p.saison_id, p.mise, 'remboursement', p_pari);
        RETURN;
    END IF;

    -- Gagné : on multiplie les cotes prises, sauf celles des marchés annulés
    FOR sel IN
        SELECT ps.cote_prise FROM pari_selection ps
          JOIN issue i ON i.id = ps.issue_id JOIN marche m ON m.id = i.marche_id
         WHERE ps.pari_id = p_pari AND m.statut <> 'annule'
    LOOP
        cote_finale := cote_finale * sel.cote_prise;
    END LOOP;
    IF annulees > 0 THEN
        -- Combiné amputé d'une sélection annulée : moitié du gain
        v_gain := floor(p.mise * cote_finale / 2);   -- arrondi à l'inférieur, toujours
        IF v_gain < p.mise THEN
            -- Plancher : remboursement complet de la mise
            UPDATE pari SET statut = 'rembourse', gain = p.mise, regle_le = now()
             WHERE id = p_pari;
            INSERT INTO mouvement_noxus (ligue_id, utilisateur_id, saison_id, montant,
                                         motif, pari_id, commentaire)
            VALUES (p.ligue_id, p.utilisateur_id, p.saison_id, p.mise, 'remboursement',
                    p_pari, 'combiné avec sélection annulée : moitié du gain < mise');
            RETURN;
        END IF;
    ELSE
        v_gain := floor(p.mise * cote_finale);
    END IF;

    UPDATE pari SET statut = 'gagne', gain = v_gain, gain_reduit = (annulees > 0),
                    regle_le = now()
     WHERE id = p_pari;
    INSERT INTO mouvement_noxus (ligue_id, utilisateur_id, saison_id, montant, motif,
                                 pari_id, commentaire)
    VALUES (p.ligue_id, p.utilisateur_id, p.saison_id, v_gain, 'gain', p_pari,
            CASE WHEN annulees > 0 THEN 'gain réduit de moitié : sélection annulée' END);
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
--  RÉGLER UN MARCHÉ : l'admin indique la bonne réponse (son libellé)
-- ---------------------------------------------------------------------------
CREATE FUNCTION regler_marche(p_marche int, p_libelle_gagnant text) RETURNS int AS $$
DECLARE
    m       marche%ROWTYPE;
    p_id    int;
    nb      int := 0;
BEGIN
    SELECT * INTO m FROM marche WHERE id = p_marche FOR UPDATE;
    IF m.statut IN ('regle', 'annule') THEN
        RAISE EXCEPTION 'Marché déjà réglé ou annulé';
    END IF;
    IF now() < m.ferme_le THEN
        RAISE EXCEPTION 'Impossible de régler un marché avant sa fermeture';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM issue WHERE marche_id = p_marche
                                         AND libelle = p_libelle_gagnant) THEN
        RAISE EXCEPTION 'Réponse "%" inconnue pour ce marché', p_libelle_gagnant;
    END IF;

    UPDATE issue SET gagnante = (libelle = p_libelle_gagnant) WHERE marche_id = p_marche;
    UPDATE marche SET statut = 'regle' WHERE id = p_marche;

    FOR p_id IN SELECT DISTINCT ps.pari_id FROM pari_selection ps
                  JOIN issue i ON i.id = ps.issue_id WHERE i.marche_id = p_marche
    LOOP
        PERFORM evaluer_pari(p_id);
        nb := nb + 1;
    END LOOP;
    RETURN nb;                               -- nombre de paris examinés
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
--  ANNULER UN MARCHÉ (match annulé, map 5 jamais jouée sur un pari "map 5"...)
-- ---------------------------------------------------------------------------
CREATE FUNCTION annuler_marche(p_marche int) RETURNS int AS $$
DECLARE
    p_id  int;
    nb    int := 0;
BEGIN
    UPDATE marche SET statut = 'annule'
     WHERE id = p_marche AND statut NOT IN ('regle', 'annule');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marché introuvable, déjà réglé ou déjà annulé';
    END IF;
    FOR p_id IN SELECT DISTINCT ps.pari_id FROM pari_selection ps
                  JOIN issue i ON i.id = ps.issue_id WHERE i.marche_id = p_marche
    LOOP
        PERFORM evaluer_pari(p_id);
        nb := nb + 1;
    END LOOP;
    RETURN nb;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
--  DÉPARTS ET RECHARGES
--  À lancer chaque jour par une tâche planifiée. Pour chaque membre :
--    - nouvelle saison et pas encore de solde de départ -> solde de départ ;
--    - sinon, rien reçu depuis 7 jours                   -> recharge hebdo.
--  La relancer plusieurs fois le même jour ne crédite rien de plus.
--  Renvoie le nombre de versements effectués.
-- ---------------------------------------------------------------------------
CREATE FUNCTION crediter_recharges(p_jour date DEFAULT current_date) RETURNS int AS $$
DECLARE
    mb       record;
    v_saison int;
    nb       int := 0;
    -- Date utilisée pour les versements (la date passée en paramètre
    -- permet de simuler un autre jour dans les tests)
    v_quand  timestamptz := CASE WHEN p_jour = current_date THEN now()
                                 ELSE p_jour::timestamptz END;
BEGIN
    FOR mb IN SELECT ml.ligue_id, ml.utilisateur_id, l.recharge_hebdo
                FROM membre_ligue ml JOIN ligue l ON l.id = ml.ligue_id
    LOOP
        v_saison := saison_courante(mb.ligue_id, p_jour);
        IF assurer_depart(mb.ligue_id, mb.utilisateur_id, v_saison, v_quand) THEN
            nb := nb + 1;
        ELSIF mb.recharge_hebdo > 0 AND NOT EXISTS (
                SELECT 1 FROM mouvement_noxus mv
                 WHERE mv.saison_id = v_saison AND mv.utilisateur_id = mb.utilisateur_id
                   AND mv.motif IN ('recharge', 'depart')
                   AND mv.cree_le > v_quand - interval '7 days') THEN
            INSERT INTO mouvement_noxus (ligue_id, utilisateur_id, saison_id, montant,
                                         motif, cree_le)
            VALUES (mb.ligue_id, mb.utilisateur_id, v_saison, mb.recharge_hebdo,
                    'recharge', v_quand);
            nb := nb + 1;
        END IF;
    END LOOP;
    RETURN nb;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
--  REJOINDRE UNE LIGUE : adhésion + solde de départ en une seule opération
-- ---------------------------------------------------------------------------
CREATE FUNCTION rejoindre_ligue(p_utilisateur int, p_code text) RETURNS int AS $$
DECLARE
    l ligue%ROWTYPE;
BEGIN
    SELECT * INTO l FROM ligue WHERE code_invitation = p_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Code d''invitation inconnu';
    END IF;
    INSERT INTO membre_ligue (ligue_id, utilisateur_id) VALUES (l.id, p_utilisateur);
    PERFORM assurer_depart(l.id, p_utilisateur, saison_courante(l.id));
    RETURN l.id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
