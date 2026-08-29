# Nexora TMS

Nexora TMS is a next-generation Transportation Management System focused on road freight operations, multi-tenant SaaS architecture, security, observability, and scalable integrations.

## Status

Project bootstrap in progress. The repository is currently in **Wave 0 — Architecture & Foundations**.

The first executable backend foundation is defined under `apps/api` and follows the accepted architecture baseline: Node.js, TypeScript, pnpm workspaces, Turborepo and NestJS.

## Runtime baseline

- Node.js `24.20.0` LTS
- pnpm `11.24.0`
- Turborepo
- TypeScript strict
- NestJS API
- Railway for API/worker runtime
- Neon PostgreSQL for persistence
- Vercel for the web runtime

## Monorepo

```text
apps/
  api/        Nexora HTTP API
  web/        planned web application
  worker/     planned persistent worker
packages/     shared packages created only when real reuse exists
```

## API bootstrap

Install dependencies and run the API from the repository root:

```bash
pnpm install
pnpm build:api
pnpm start:api
```

Operational health endpoint:

```text
GET /health
```

API contract base path:

```text
/api/v1
```

## Quality gates

```bash
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions executes the same quality gates for pull requests and pushes to `main`.

## Architecture and governance

Canonical architecture, module boundaries, ADRs and operational documentation live under `docs/`. Material architecture changes require a new ADR and changes follow the branch + pull request workflow described in `CONTRIBUTING.md`.

---

Copyright © 2026 Nexora TMS. All rights reserved.
