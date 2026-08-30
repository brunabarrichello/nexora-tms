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

## MCP connector compatibility

The ChatGPT-hosted Neon connector can temporarily become incompatible with the Neon MCP server when the client and server expose different argument contracts. The regression tracked in `neondatabase/mcp-server-neon#333` is one example: the client exposes camelCase arguments while the hosted server expects snake_case arguments after the tool-generation migration.

Nexora TMS must not depend on that connector contract for database operations. The repository therefore provides `scripts/neon/direct-sql.mjs`, which resolves a PostgreSQL connection string through the Neon CLI and invokes `psql` directly. This path does not construct or consume `fullDatabaseId` and does not pass MCP tool arguments.

The fallback is read-only by default. Any mutating SQL requires the explicit `--allow-write` flag.

Examples:

```bash
# Read-only verification in development
NEON_API_KEY=... pnpm neon:sql -- \
  --environment development \
  --file scripts/neon/verify.sql

# Read-only ad hoc query
NEON_API_KEY=... pnpm neon:sql -- \
  --environment staging \
  --command 'select current_database(), current_user;'

# Explicit write-enabled execution (use only with reviewed SQL)
NEON_API_KEY=... pnpm neon:sql -- \
  --environment development \
  --file path/to/reviewed-migration.sql \
  --allow-write
```

`NEON_DIRECT_DATABASE_URL` can be supplied as an explicit emergency override. When it is present, the script skips Neon CLI connection-string resolution. Do not store that URL in the repository.

## Environment mapping

The workflow input is an environment selector only; it does not use GitHub Environments.

| Workflow input | Neon branch   |
| -------------- | ------------- |
| `production`   | `main`        |
| `staging`      | `staging`     |
| `development`  | `development` |

This repository is private and currently uses GitHub Free. The workflow intentionally avoids GitHub Environment secrets.

## Required GitHub repository secret

Configure this under **Settings → Secrets and variables → Actions → Repository secrets**:

- `NEON_API_KEY` — Neon API key with access to project `raspy-river-76339604`.

No branch-specific administrative database URL is required. The workflow installs the Neon CLI and derives the correct direct PostgreSQL connection string at runtime for the selected Neon branch, database `nexora`, and administrative role `neondb_owner`.

If a legacy `NEON_ADMIN_DATABASE_URL` secret already exists, it is not used by the workflow and can be removed after the new verification flow has passed.

Do not commit connection strings, passwords, API keys, or `.env` files containing secrets.

## Run verification

After the workflow is present on the default branch:

1. Open **Actions** in GitHub.
2. Select **Neon Verify**.
3. Choose **Run workflow**.
4. Select `development`, `staging`, or `production`.
5. Review the workflow summary.

A successful run confirms the selected Neon environment has the expected database foundation through the MCP-independent direct SQL path.

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

GitHub Actions receives only `NEON_API_KEY` from repository Actions Secrets. The branch-specific administrative connection string is generated dynamically inside the runner, masked immediately, used only for the requested SQL step, and never committed.

The direct SQL wrapper enforces read-only PostgreSQL sessions unless `--allow-write` is supplied explicitly. This protects inspection and verification commands from accidental mutations while still allowing reviewed administrative procedures when required.

Runtime application credentials remain separate from infrastructure verification credentials.

Future migration workflows must use a dedicated `MIGRATIONS_DATABASE_URL`/`nexora_migrator` credential and must not reuse the administrative verification connection.
