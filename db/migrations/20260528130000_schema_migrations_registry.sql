-- UP: Registo de migrações aplicadas (ferramenta scripts/apply-migrations.mjs).
-- DOWN: DROP TABLE IF EXISTS schema_migrations;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schema_migrations IS 'Versões SQL aplicadas a partir de db/migrations/*.sql';
