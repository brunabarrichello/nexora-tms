# Nexora TMS

Nexora TMS is a next-generation Transportation Management System focused on road freight operations, multi-tenant SaaS architecture, security, observability, and scalable integrations.

## Status

Foundation implementation is active. The repository contains executable Web, API and Worker deployables, shared packages, database foundations, CI gates and architecture documentation.

## Runtime baseline

- Node.js `24.20.0` LTS
- pnpm `11.24.0`
- Turborepo
- TypeScript strict
- Next.js Web
- NestJS API and Worker
- Railway for API/worker runtime
- Neon PostgreSQL for persistence
- Vercel for the web runtime

## Monorepo

```text
apps/
  api/        Nexora HTTP API
  web/        Nexora web application
  worker/     Nexora persistent worker
packages/     shared packages with explicit ownership and reuse
scripts/      local bootstrap, diagnostics and operational tooling
docs/         architecture, ADRs, security, operations and runbooks
```

## First local bootstrap

Use the exact toolchain declared by the repository:

```bash
node --version
pnpm --version
pnpm doctor
pnpm bootstrap
pnpm validate
```

Expected versions:

```text
Node.js 24.20.0
pnpm 11.24.0
```

`pnpm doctor` fails fast when Node.js, pnpm or the committed lockfile do not match the repository baseline. `pnpm bootstrap` repeats that validation and installs dependencies with `--frozen-lockfile`.

## Runtime environment

The API variable contract is documented in:

```text
apps/api/.env.example
```

The application reads runtime variables from the process environment. The example file is a reference and is not automatically loaded by the API. Never commit a populated `.env` file or credentials.

For local execution, provide the required values through your shell or another approved local secret mechanism. Railway, Vercel, Neon and GitHub environments remain responsible for deployed secrets.

Local default ports:

```text
Web: http://localhost:3000
API: http://localhost:3001
```

A deployment-provided `PORT` always overrides the API local fallback.

## Development commands

Web development server:

```bash
pnpm dev:web
```

Build and start the API:

```bash
pnpm dev:api
```

Build and start the Worker:

```bash
pnpm dev:worker
```

Operational health endpoint:

```text
GET http://localhost:3001/health
```

API contract base path:

```text
/api/v1
```

## Quality gates

Run the complete local gate before pushing:

```bash
pnpm validate
```

The validation chain includes:

```text
lint → formatting → typecheck → tests → build
```

Git hooks apply lint-staged on pre-commit and `pnpm validate` on pre-push. GitHub Actions repeats the repository quality gates and database migration checks for protected changes.

## Architecture and governance

Canonical architecture, module boundaries, ADRs and operational documentation live under `docs/`. Material architecture changes require a new ADR and changes follow the Jira-keyed branch + pull request workflow described in `CONTRIBUTING.md`.

See `docs/operations/local-development.md` for the complete local development procedure.

---

Copyright © 2026 Nexora TMS. All rights reserved.
