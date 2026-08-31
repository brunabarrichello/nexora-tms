# Hardening Gap Register

Jira: NEX-80 / NEX-81 / NEX-82 / NEX-84 / NEX-85

Date: 31/08/2026.

## NEX-80 — logs, correlation and health

### Already present before this tranche

- Railway `/health` deployment probe.
- Railway deploy/HTTP logs available operationally.
- Vercel runtime/build logs available.

### Added in this tranche

- request correlation through `x-correlation-id`;
- generated safe correlation ID when an inbound value is absent/invalid;
- structured JSON HTTP completion log with timestamp, level, service, environment, correlation ID, method, path, status and duration;
- no request body, Authorization header, cookies, query string or database error detail written by this access log;
- `/health/live` explicit liveness;
- `/health/ready` database-backed readiness using `SELECT 1`;
- readiness failure returns a generic 503 message rather than raw database detail.

### Remaining gaps

- Worker correlation and Worker readiness after NEX-91 exists;
- centralized metrics and alert thresholds/destinations;
- explicit SLO/error-budget policy.

## NEX-81 — API and secrets security

### Already present before this tranche

- OIDC JWT verification and fail-closed authentication;
- separate environment audiences;
- minimum-privilege Neon runtime/migration roles;
- TLS `verify-full` Production posture;
- GitHub/Railway/Vercel secret stores used instead of committing credentials.

### Added in this tranche

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- restrictive `Permissions-Policy`;
- `Cross-Origin-Resource-Policy: same-site`;
- HSTS when the API runs in Production;
- correlation IDs are constrained to a safe bounded character set;
- readiness errors are sanitized.

### Remaining gaps

- distributed or provider-backed rate limiting;
- formal global request-validation strategy for endpoints that do not already use domain validators;
- documented secret rotation/revocation cadence and drill result;
- CORS policy must be made explicit if browser-direct API access is introduced.

## NEX-82 — audit, metrics and vulnerability management

### Already present

- Wave 0024 database Audit schema and immutability qualification;
- Production dependency audit (`pnpm audit:prod`) in required CI;
- GitHub Actions and platform logs provide an initial evidence trail.

### Remaining gaps

- application security-event taxonomy;
- operational metrics and alert rules;
- vulnerability triage SLA/severity policy;
- recurring dependency/update review and evidence retention.

## NEX-84 — critical IAM, multi-tenant and E2E tests

### Already present

- OIDC authentication unit/integration coverage;
- TenantContext coverage;
- database tenant/RLS gates exercised in Neon workflows;
- authenticated Production runtime gate previously proved OIDC -> external identity -> TenantContext -> API -> Neon -> RLS.

### Added in this tranche

- liveness/readiness success and fail-closed unit tests;
- HTTP correlation/security-header tests;
- DR workflow runs API smoke against a real restored database target and verifies fail-closed unauthenticated access.

### Remaining gaps

- repeatable CI-authenticated E2E using a controlled test identity/provider fixture;
- explicit automated two-tenant negative read/write E2E at the API layer;
- broader critical business-flow E2E beyond runtime qualification.

## NEX-85 — CI quality gates

### Current evidence

The repository ruleset `main-protection` is active and requires `Build, typecheck and test` with no bypass actor. The required workflow executes:

- dependency installation with frozen lockfile;
- Production dependency security audit;
- lint;
- formatting check;
- typecheck;
- tests;
- build;
- Docker Compose model validation;
- Drizzle generation/check;
- verification that migration artifacts are versioned.

### Remaining gap before closure

- reconcile Jira acceptance wording with the already-enforced ruleset and this hardening tranche;
- decide whether database-specific Production/Neon gates should remain release workflows or become additional required PR checks. They must not be made required if they depend on protected Production secrets for untrusted PR execution.

## Execution order

1. Complete NEX-79/NEX-93 controlled restore qualification and record measured RTO/RPO.
2. Merge the API observability/security baseline after CI passes.
3. Reconcile NEX-85 against the active required ruleset.
4. Define alerting/metrics and vulnerability-management policy for NEX-82.
5. Implement rate limiting and remaining API-security controls for NEX-81.
6. Add controlled authenticated API-layer E2E for NEX-84.
