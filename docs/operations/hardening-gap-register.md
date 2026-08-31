# Hardening Gap Register

Jira: NEX-80 / NEX-81 / NEX-82 / NEX-84 / NEX-85

Date: 31/08/2026.

This register distinguishes controls already implemented from the next executable gaps. It must not treat a future Worker or asynchronous topology as if it were already active in Production.

## Closed items in this hardening sequence

- **NEX-79 — Feito:** backup/restore policy, destructive-change expand/contract checklist and real recovery exercise completed.
- **NEX-93 — Feito:** controlled Production PITR Restore Qualification passed in run `33396554407`.
- **NEX-85 — Feito:** required CI and merge-blocking quality gates reconciled and verified.
- **NEX-82 — closure-qualified:** audit, minimum metrics/alerting and vulnerability-management baseline implemented; controlled monitor lifecycle passed after PR #124.

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

### Implemented

- OIDC JWT verification and fail-closed authentication;
- separate environment audiences;
- minimum-privilege Neon runtime/migration roles;
- Production TLS `sslmode=verify-full`;
- GitHub/Railway/Vercel secret stores instead of committed credentials;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- restrictive `Permissions-Policy`;
- `Cross-Origin-Resource-Policy: same-site`;
- HSTS in Production;
- bounded correlation IDs;
- sanitized readiness errors.

### Remaining executable gaps

- distributed or provider-backed rate limiting;
- formal global request-validation strategy for endpoints not already covered by domain validators;
- documented credential rotation/revocation cadence plus an executed drill;
- explicit CORS policy if browser-direct API access is introduced.

**Status recommendation:** keep NEX-81 in progress. Rate limiting remains an explicit acceptance-scope gap.

## NEX-82 — audit, metrics and vulnerability management

**Status recommendation: closure-ready / Feito after Jira reconciliation.**

### Qualified controls

- Wave 0024 durable database Audit schema and immutability;
- Production dependency audit (`pnpm audit:prod`) in required CI;
- restored-database Audit/immutability and runtime RLS qualification in DR run `33396554407`;
- weekly Dependabot review for npm and GitHub Actions;
- Railway Production CPU/memory/network metrics confirmed available over a 24-hour window;
- scheduled external Production `/health` monitor twice per hour;
- three bounded retries before operational alerting;
- durable GitHub incident issue creation while unhealthy and automatic closure after verified recovery;
- alert workflow failure state as durable evidence while an incident is active;
- health-monitor incident evidence excludes response body, credentials, cookies and request headers;
- critical security/operational event taxonomy, evidence-retention classes, vulnerability triage workflow, remediation targets and finding ownership documented in `docs/operations/security-observability-policy.md`.

### Objective monitor qualification

PR #124 merged as `30fb440c10cd7df7b51a8f69120c8457c706985a` after required PR CI `33398199634` succeeded.

Post-merge evidence on the same SHA:

- Production Health Monitor run `33401498707` — success;
- qualification job `99518637088` — success;
- controlled issue `#125` (`[monitor-test] Production health alert lifecycle qualification`) created automatically;
- real Railway Production `/health` verified with HTTP 200;
- issue #125 received recovery evidence and was automatically closed as `completed` by GitHub Actions;
- post-merge CI run `33401498734` — success;
- `pnpm audit:prod` reported no known high/critical Production vulnerabilities in that CI run.

The controlled `monitor-test` validates issue creation, real-health verification and automatic closure without falsely asserting that Production was actually unavailable. Scheduled/manual operational monitor executions remain responsible for opening `[monitor] Production API health unavailable` only when the real probe fails or an explicit manual failure simulation is invoked.

## NEX-84 — critical IAM, multi-tenant and E2E tests

### Implemented

- OIDC authentication unit/integration coverage;
- TenantContext coverage;
- database tenant/RLS gates exercised in Neon workflows;
- authenticated Production runtime gate previously proved OIDC → external identity → TenantContext → API → Neon → RLS;
- liveness/readiness success and fail-closed tests;
- HTTP correlation/security-header tests;
- DR workflow starts the API against a real restored database and verifies liveness, DB readiness and fail-closed unauthenticated access;
- PR #121 head validation passed `OIDC identity mapping against nexora_app` and `TenantContext against nexora_app` on isolated Neon branches.

### Remaining executable gaps

- repeatable CI-authenticated E2E using a controlled test identity/provider fixture;
- explicit automated two-tenant negative read/write E2E at the API layer;
- broader critical business-flow E2E beyond runtime qualification.

**Status recommendation:** keep NEX-84 in progress until the repeatable authenticated API-layer E2E is in CI.

## NEX-85 — CI quality gates

**Status: Feito.**

The repository ruleset `main-protection` is active and requires `Build, typecheck and test` with no bypass actor. Pull requests cannot be integrated while that required check is red.

The required workflow covers frozen-lockfile install, Production dependency security audit, lint, formatting, typecheck, tests, build, Docker Compose validation, Drizzle generation/check and versioned migration artifacts.

Recent objective evidence includes PR and post-merge CI runs `33395048908`, `33395933222`, `33396432314`, `33396554367`, `33397235412`, `33397375771`, `33398199634` and `33401498734`, all successful.

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
- no residual `dr-pitr` branch found after the run;
- Neon `compare_schema` HTTP 413 is recorded as a provider response-size limitation; byte-for-byte provider diff equality is not claimed.

## Next execution order

1. Reconcile NEX-82 to Feito against PR #124 + monitor-test + post-merge CI evidence.
2. NEX-81: implement rate limiting, global validation policy and credential-rotation drill.
3. NEX-84: add controlled authenticated API-layer two-tenant E2E in CI.
4. NEX-80: formalize SLO/error-budget policy and later extend correlation/readiness to Worker when NEX-91 enters Production.
