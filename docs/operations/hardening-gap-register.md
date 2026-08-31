# Hardening Gap Register

Jira: NEX-80 / NEX-81 / NEX-82 / NEX-84 / NEX-85

Date: 31/08/2026.

This register distinguishes controls already implemented from the next executable gaps. It must not treat a future Worker or asynchronous topology as if it were already active in Production.

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
- DR restore qualification exercised liveness/readiness and correlation/security headers against a real restored Neon database.

### Remaining executable gaps

- Worker correlation and Worker readiness after NEX-91 makes Worker part of the active topology;
- centralized operational metrics and alert thresholds/destinations;
- explicit SLO/error-budget policy.

**Status recommendation:** keep NEX-80 in progress until the remaining observability scope is either implemented or formally split/delegated.

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

**Status recommendation:** keep NEX-81 in progress. Rate limiting is an explicit acceptance-scope gap.

## NEX-82 — audit, metrics and vulnerability management

### Implemented

- Wave 0024 database Audit schema and immutability qualification;
- Production dependency audit (`pnpm audit:prod`) in required CI;
- GitHub Actions and platform logs as an initial evidence trail;
- restored-database Audit/immutability and runtime RLS qualification in DR run `33396554407`.

### Remaining executable gaps

- application security-event taxonomy;
- operational metrics and alert rules;
- vulnerability triage SLA/severity policy;
- recurring dependency/update review and evidence-retention process.

**Status recommendation:** keep NEX-82 in progress.

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

### Implemented and enforced

The repository ruleset `main-protection` is active and requires `Build, typecheck and test` with no bypass actor. Pull requests cannot be integrated while that required check is red.

The required workflow executes:

- frozen-lockfile dependency installation;
- Production dependency security audit;
- lint;
- formatting check;
- typecheck;
- automated tests;
- build;
- Docker Compose model validation;
- Drizzle generation/check;
- verification that migration artifacts are versioned.

Objective evidence from the hardening/DR tranche:

- PR #121 required CI run `33395048908` — success;
- post-merge #121 CI run `33395933222` — success;
- PR #122 required CI run `33396432314` — success;
- post-merge #122 CI run `33396554367` — success.

Database-specific Production workflows remain separate release/qualification gates because they consume protected Production capabilities and should not be made ordinary untrusted-PR requirements.

**Status recommendation:** NEX-85 acceptance scope is satisfied and can be closed.

## DR qualification now completed

NEX-79/NEX-93 controlled restore qualification is complete for the current synchronous topology:

- successful run `33396554407`, job `99502337881`;
- canonical Production history: 21,600 seconds;
- tested recovery-point lag: 300 seconds;
- database-ready RTO: 2 seconds;
- ledger 25/25;
- minimum-privilege roles, TLS, Audit immutability and runtime RLS: PASS;
- restored API liveness/readiness, correlation/security headers and negative auth 401: PASS;
- exact temporary restore-branch cleanup: PASS;
- no residual `dr-pitr` branch found after the run;
- Neon `compare_schema` returned HTTP 413 because of response size, so byte-for-byte provider diff equality is not claimed; exact ledger plus executable schema/Audit/RLS and API compatibility gates are authoritative.

## Next execution order

1. Close/reconcile NEX-79 and NEX-93 against the successful restore evidence.
2. Close NEX-85 against the enforced CI/ruleset evidence.
3. NEX-82: define and implement minimum metrics/alerts plus vulnerability-management policy.
4. NEX-81: implement rate limiting, global validation policy and credential-rotation drill.
5. NEX-84: add controlled authenticated API-layer two-tenant E2E in CI.
6. NEX-80: finish centralized observability/SLOs and later extend correlation/readiness to Worker when NEX-91 enters Production.
