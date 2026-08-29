# Neon PostgreSQL via GitHub Actions

This workflow is the supported operational fallback for Nexora TMS when an external MCP/client integration cannot reliably invoke Neon management or SQL operations.

## Scope

The workflow `.github/workflows/neon-verify.yml` verifies, without changing the database:

- the Neon project `nexora-tms`;
- the expected branch for the selected environment;
- the `nexora` database;
- the four required roles;
- role administrative/login attributes;
- the six foundation schemas.

The SQL verification lives at `scripts/neon/verify.sql` and is read-only.

## Environment mapping

The workflow input is an environment selector only; it does not use GitHub Environments.

| Workflow input | Neon branch |
| --- | --- |
| `production` | `main` |
| `staging` | `staging` |
| `development` | `development` |

This repository is private and currently uses GitHub Free. GitHub Environment secrets for private repositories require a paid plan, so the workflow intentionally uses repository-level Actions secrets instead.

## Required GitHub repository secrets

Configure these under **Settings → Secrets and variables → Actions → Repository secrets**:

- `NEON_API_KEY` — Neon API key with access to project `raspy-river-76339604`;
- `NEON_ADMIN_DATABASE_URL_DEVELOPMENT` — direct PostgreSQL connection string for database `nexora` on Neon branch `development`;
- `NEON_ADMIN_DATABASE_URL_STAGING` — direct PostgreSQL connection string for database `nexora` on Neon branch `staging`;
- `NEON_ADMIN_DATABASE_URL_PRODUCTION` — direct PostgreSQL connection string for database `nexora` on Neon branch `main`.

Use an administrative database role only for this infrastructure verification. Do not use `nexora_app`, `nexora_worker`, or application runtime credentials for infrastructure verification.

Do not commit connection strings, passwords, API keys, or `.env` files containing secrets.

## Run verification

After the workflow is present on the default branch:

1. Open **Actions** in GitHub.
2. Select **Neon Verify**.
3. Choose **Run workflow**.
4. Select `development`, `staging`, or `production`.
5. Review the workflow summary.

A successful run confirms the selected Neon environment has the expected database foundation.

## Expected database foundation

Required roles:

- `nexora_owner` — `NOLOGIN`;
- `nexora_migrator` — `LOGIN`, no database/role creation, no RLS bypass;
- `nexora_app` — `LOGIN`, no database/role creation, no RLS bypass;
- `nexora_worker` — `LOGIN`, no database/role creation, no RLS bypass.

Required schemas:

- `core`;
- `iam`;
- `tms`;
- `billing`;
- `integrations`;
- `audit`.

## Security model

GitHub Actions receives credentials only from repository Actions Secrets. The verification script never prints passwords or connection strings. Runtime application credentials remain separate from the administrative verification credential.

Future migration workflows must use a dedicated `MIGRATIONS_DATABASE_URL`/`nexora_migrator` credential and must not reuse the administrative verification connection.
