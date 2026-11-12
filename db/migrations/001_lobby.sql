-- Migration 001 : épreuves en lobby (Fortnite, Warzone, TFT), paris « top X ».
-- Pour une base créée avant cette version. Sans danger si on la relance.
--   psql -U overtime -d overtime -f db/migrations/001_lobby.sql
-- Ensuite, recharger les fonctions : psql -U overtime -d overtime -f db/fonctions.sql
BEGIN;

ALTER TABLE participation ADD COLUMN IF NOT EXISTS libelle text;
ALTER TABLE participation DROP CONSTRAINT IF EXISTS participation_check;
ALTER TABLE participation ADD CONSTRAINT participation_check CHECK (
    ((equipe_id IS NULL) <> (joueur_id IS NULL))
    OR (equipe_id IS NULL AND joueur_id IS NULL AND libelle IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS participation_libelle_idx ON participation (serie_id, lower(libelle));

CREATE TABLE IF NOT EXISTS participation_joueur (
    participation_id int NOT NULL REFERENCES participation(id) ON DELETE CASCADE,
    joueur_id        int NOT NULL REFERENCES joueur(id),
    PRIMARY KEY (participation_id, joueur_id)
);

ALTER TABLE marche ADD COLUMN IF NOT EXISTS participation_id int REFERENCES participation(id);

COMMIT;
