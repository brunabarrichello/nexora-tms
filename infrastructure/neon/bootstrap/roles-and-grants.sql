-- Nexora TMS database capability-role bootstrap.
-- Jira: NEX-22 / NEX-77
--
-- This file intentionally contains NO passwords and NO connection strings.
-- Physical LOGIN roles/credentials must be provisioned through Neon/secret-management
-- and granted membership in the capability roles below.

BEGIN;

-- Capability roles. NOLOGIN is deliberate: credentials are managed outside Git.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_app') THEN
    CREATE ROLE nexora_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_worker') THEN
    CREATE ROLE nexora_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_migrator') THEN
    CREATE ROLE nexora_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

-- Harden the default schema surface.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Application-owned schema.
CREATE SCHEMA IF NOT EXISTS nexora AUTHORIZATION nexora_migrator;

GRANT USAGE ON SCHEMA nexora TO nexora_app, nexora_worker;

-- Existing objects. Fine-grained restrictions can be tightened per module later.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nexora TO nexora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nexora TO nexora_worker;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA nexora TO nexora_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA nexora TO nexora_worker;

-- Future objects created by the migrator inherit runtime grants.
ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA nexora
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA nexora
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA nexora
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO nexora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA nexora
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO nexora_worker;

COMMIT;

-- Validation queries (read-only) to run after applying this bootstrap:
-- SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
-- FROM pg_roles
-- WHERE rolname IN ('nexora_app', 'nexora_worker', 'nexora_migrator')
-- ORDER BY rolname;
--
-- SELECT schema_name, schema_owner
-- FROM information_schema.schemata
-- WHERE schema_name = 'nexora';
