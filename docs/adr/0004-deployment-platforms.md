# ADR-0004 — Vercel for Web; Railway for API/Worker; Neon PostgreSQL

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Web, API and persistent workers have different runtime profiles. Nexora targets Vercel, Railway and Neon as independent managed platforms.

## Decision

- `apps/web` → Vercel;
- `apps/api` → Railway;
- `apps/worker` → persistent Railway process;
- PostgreSQL → Neon.

Each environment owns its own configuration and secrets.

## Alternatives considered

- host all workloads on one platform;
- use serverless execution for persistent worker responsibilities;
- self-manage PostgreSQL.

## Consequences

**Positive:** each workload runs on an appropriate managed runtime.  
**Trade-off:** observability and configuration span multiple platforms.  
**Mitigation:** common correlation IDs, documented configuration/IaC and unified runbooks.
