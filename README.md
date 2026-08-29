# Nexora TMS

Nexora TMS is a next-generation Transportation Management System focused on road freight
operations, multi-tenant SaaS architecture, security, observability, and scalable integrations.

## Status

**Wave 0 — Foundation** is in progress.

Architecture baseline NEX-17/NEX-62/NEX-63/NEX-64 is established. Repository execution is currently
focused on NEX-18: monorepo and developer experience.

## Canonical deployables

- `apps/web` — Next.js + React, target Vercel
- `apps/api` — NestJS, target Railway
- `apps/worker` — NestJS standalone worker, target Railway
- PostgreSQL — Neon

The backend starts as a modular monolith. Multi-tenancy, security, auditability, explicit contracts,
and observability are foundational constraints rather than later hardening work.

## Toolchain

- Node.js `24.20.0`
- pnpm `11.23.0`
- TypeScript `6.0.0`
- pnpm workspaces + Turborepo

## Repository structure

```text
apps/
  web/
  api/
  worker/
packages/
infrastructure/
docs/
scripts/
tests/
```

Shared packages are created only when reuse is real; see `packages/README.md`.

## Bootstrap

```bash
corepack enable
corepack prepare pnpm@11.23.0 --activate
pnpm bootstrap
```

See `docs/operations/local-development.md` for the complete local workflow.

## Governance

- Architecture decisions: `docs/adr/`
- Architecture documentation: `docs/architecture/`
- Contribution rules: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`

This repository is the canonical source code and versioned technical configuration location for
Nexora TMS.

---

Copyright © 2026 Nexora TMS. All rights reserved.
