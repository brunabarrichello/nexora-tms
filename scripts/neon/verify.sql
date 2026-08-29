\set ON_ERROR_STOP on

-- Nexora TMS / Neon PostgreSQL foundation verification.
-- This script is read-only and is safe to run against any Nexora environment.

DO $$
BEGIN
  IF current_database() <> 'nexora' THEN
    RAISE EXCEPTION 'Expected database nexora, connected to %', current_database();
  END IF;
END
$$;

DO $$
DECLARE
  invalid_roles integer;
  role_count integer;
BEGIN
  SELECT count(*)
    INTO role_count
  FROM pg_roles
  WHERE rolname IN ('nexora_owner', 'nexora_migrator', 'nexora_app', 'nexora_worker');

  IF role_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 Nexora roles, found %', role_count;
  END IF;

  SELECT count(*)
    INTO invalid_roles
  FROM pg_roles
  WHERE rolname IN ('nexora_owner', 'nexora_migrator', 'nexora_app', 'nexora_worker')
    AND (
      rolcreatedb
      OR rolcreaterole
      OR rolbypassrls
      OR (rolname = 'nexora_owner' AND rolcanlogin)
      OR (rolname <> 'nexora_owner' AND NOT rolcanlogin)
    );

  IF invalid_roles <> 0 THEN
    RAISE EXCEPTION 'One or more Nexora roles have unexpected administrative/login attributes';
  END IF;
END
$$;

DO $$
DECLARE
  schema_count integer;
BEGIN
  SELECT count(*)
    INTO schema_count
  FROM information_schema.schemata
  WHERE schema_name IN ('core', 'iam', 'tms', 'billing', 'integrations', 'audit');

  IF schema_count <> 6 THEN
    RAISE EXCEPTION 'Expected 6 Nexora schemas, found %', schema_count;
  END IF;
END
$$;

SELECT
  current_database() AS database_name,
  current_user AS current_role,
  current_setting('server_version') AS postgres_version;

SELECT
  rolname,
  rolcanlogin,
  rolcreatedb,
  rolcreaterole,
  rolbypassrls
FROM pg_roles
WHERE rolname IN ('nexora_owner', 'nexora_migrator', 'nexora_app', 'nexora_worker')
ORDER BY rolname;

SELECT
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name IN ('core', 'iam', 'tms', 'billing', 'integrations', 'audit')
ORDER BY schema_name;
