# Hardening Gap Register

Jira: NEX-80 / NEX-81 / NEX-82 / NEX-84 / NEX-85

Date: 31/08/2026.

This register distinguishes controls already implemented from the next executable gaps. It must not treat a future Worker or asynchronous topology as if it were already active in Production.

## Closed items in this hardening sequence

- **NEX-79 — Feito:** backup/restore policy, destructive-change expand/contract checklist and real recovery exercise completed.
- **NEX-93 — Feito:** controlled Production PITR Restore Qualification passed in run `33396554407`.
- **NEX-85 — Feito:** required CI and merge-blocking quality gates reconciled and verified.
- **NEX-82 — Feito:** audit, minimum metrics/alerting and vulnerability-management baseline implemented; controlled monitor lifecycle passed in run `33401498707` and issue #125 closed after real Production HTTP 200.

## NEX-80 — logs, correlation and health

### Implemented for the current synchronous topology

- Railway deployment `/health` probe;
- Railway deploy/HTTP logs available operationally;
- Vercel runtime/build logs available;
- request correlation through `x-correlation-id`;
- generated bounded correlation ID when the inbound value is absent/invalid;
- structured JSON HTTP completion logs with timestamp, level, service, environment, correlation ID, method, sanitized path, status and duration;
- no request body, Authorization header, cookies, query string or raw database error detail in the HTTP access log;
- `/health/live` explicit liveness;
- `/health/ready` database-backed readiness using `SELECT 1`;
- readiness failures return a generic 503 rather than raw database detail;
- DR restore qualification exercised liveness/readiness and correlation/security headers against a real restored Neon database;
- NEX-82 adds an external scheduled Production `/health` monitor and durable incident issue lifecycle.

### Remaining executable gaps

- Worker correlation and Worker readiness after NEX-91 makes Worker part of the active topology;
- centralized long-term metric aggregation/APM beyond provider dashboards;
- explicit SLO/error-budget policy.

**Status recommendation:** keep NEX-80 in progress. The current Web/API observability baseline is functional, but the broader observability scope remains.

## NEX-81 — API and secrets security

### Already qualified before this tranche

- OIDC JWT verification and fail-closed authentication;
- separate environment audiences;
- minimum-privilege Neon runtime/migration roles;
- Production TLS `sslmode=verify-full`;
- GitHub/Railway/Vercel secret stores instead of committed credentials;
- defensive response headers including HSTS in Production;
- bounded correlation IDs and sanitized readiness errors.

### Implemented in `hardening/nex-81-api-security`

- bounded fixed-window rate limiting for the current single-replica API topology;
- stricter limits for `/api/v1/auth/*` and `/api/v1/tenant/runtime-gate`;
- HTTP 429 + `Retry-After` and rate-limit response metadata;
- bounded active-client map to prevent unbounded in-process state;
- forwarded-client identity is ignored by default and can only be enabled after proxy-chain validation;
- global rejection of HTTP TRACE;
- malformed `Content-Length` rejection;
- early global declared-body-size limit with HTTP 413;
- protocol-level Content-Type policy for body-bearing write requests;
- JSON, multipart and octet-stream compatibility retained for domain/upload flows;
- stable generic security error responses with `Cache-Control: no-store`;
- layered validation policy: protocol → auth/tenant → typed domain validators → PostgreSQL constraints/RLS;
- credential rotation/revocation cadence and operational procedure documented in `docs/operations/api-security-and-secret-rotation.md`;
- non-destructive rotation/revocation tabletop drill executed without reading or changing any live secret value.

### Scaling constraint

The current Railway Production API has one replica. The in-process limiter is valid only for this topology. Before scaling above one replica, Production must move rate-limit state to a shared/provider-backed control or equivalent trusted edge enforcement. This is an explicit release gate, not a hidden limitation.

### Closure gates for implementation

- required PR CI green including rate-limit/protocol negative tests;
- post-merge CI green;
- no implicit Production redeploy from this PR;
- Jira records the topology constraint and credential drill.

### Production application gate

Production remains pinned to the qualified `v0.1.0` SHA. The new middleware is not considered active in Production until a deliberate release/deployment promotes a SHA containing this tranche and reruns health/auth/tenant gates.

**Status recommendation:** implementation becomes complete after PR/CI; keep NEX-81 in progress until Production application is explicitly promoted or split into a release qualification successor.

## NEX-82 — audit, metrics and vulnerability management

**Status: Feito.**

Qualified controls include Wave 0024 Audit/immutability, Production dependency audit, Dependabot, Railway resource metrics, scheduled external Production health monitoring, durable incident lifecycle, critical-event taxonomy, evidence retention and vulnerability triage/remediation policy.

Objective closure evidence:

- PR #124 head CI `33398199634` — success;
- merge SHA `30fb440c10cd7df7b51a8f69120c8457c706985a`;
- Production Health Monitor run `33401498707` / qualification job `99518637088` — success;
- controlled issue #125 created, real Production `/health` HTTP 200 verified, issue automatically closed as completed;
- post-merge CI `33401498734` — success;
- PR #126 documentation reconciliation merged as `a61fba0825863b9a5b59db447ba9c5c08a11da6a`;
- post-merge CI `33402097894` — success;
- Jira NEX-82 transitioned to Feito with comment 10232.

## NEX-84 — critical IAM, multi-tenant and E2E tests

### Implemented

- OIDC authentication unit/integration coverage;
- TenantContext coverage;
- database tenant/RLS gates exercised in Neon workflows;
- authenticated Production runtime gate previously proved OIDC → external identity → TenantContext → API → Neon → RLS;
- liveness/readiness success and fail-closed tests;
- HTTP correlation/security-header tests;
- DR workflow starts the API against a real restored database and verifies liveness, DB readiness and fail-closed unauthenticated access;
- isolated Neon OIDC identity mapping and TenantContext integration gates have passed.

### Remaining executable gaps

- repeatable CI-authenticated E2E using a controlled test identity/provider fixture;
- explicit automated two-tenant negative read/write E2E at the API layer;
- broader critical business-flow E2E beyond runtime qualification.

**Status recommendation:** keep NEX-84 in progress until the repeatable authenticated API-layer E2E is in CI.

## NEX-85 — CI quality gates

**Status: Feito.**

The repository ruleset `main-protection` requires `Build, typecheck and test` with no bypass. The workflow covers frozen-lockfile install, Production dependency security audit, lint, formatting, typecheck, tests, build, Docker Compose validation, Drizzle generation/check and versioned migration artifacts.

## DR qualification

NEX-79/NEX-93 are **Feito** for the current synchronous topology:

- restore run `33396554407`, job `99502337881`;
- canonical Production history: 21,600 seconds;
- tested recovery-point lag: 300 seconds;
- database-ready RTO: 2 seconds;
- ledger 25/25;
- minimum-privilege roles, TLS, Audit immutability and runtime RLS: PASS;
- restored API liveness/readiness, correlation/security headers and negative auth 401: PASS;
- exact temporary restore-branch cleanup: PASS;
- no residual `dr-pitr` branch found after the run.

## Next execution order

1. NEX-81: validate and merge the API-security implementation; keep Production promotion as an explicit release gate.
2. NEX-84: add controlled authenticated API-layer two-tenant E2E in CI.
3. NEX-80: formalize SLO/error-budget policy and later extend correlation/readiness to Worker when NEX-91 enters Production.
4. After the hardening block is reconciled, continue IAM/Tenant/RBAC → NEX-90 → NEX-91 → Trips residual → Tracking/ETA → Wave 0025+.
