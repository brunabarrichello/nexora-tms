# API security and credential rotation baseline

Jira: NEX-81  
Date: 31/08/2026  
Profile: Free-only Production baseline

## Scope

This document defines the minimum API request controls and credential lifecycle for the current Nexora TMS synchronous Web → API → Neon topology. It does not claim that the future Worker/Outbox topology is already active.

## Global API request controls

`apps/api/src/security/api-security.middleware.ts` is the global request boundary executed after HTTP correlation/security headers and before controllers.

The baseline enforces:

- bounded fixed-window request limiting;
- a stricter bucket for `/api/v1/auth/*` and `/api/v1/tenant/runtime-gate`;
- HTTP 429 with `Retry-After` when a bucket is exhausted;
- bounded in-memory client tracking to avoid an unbounded rate-limit map;
- rejection of HTTP TRACE;
- rejection of malformed `Content-Length`;
- early HTTP 413 for declared payloads over the configured global body limit;
- body-bearing `POST`/`PUT`/`PATCH` requests must use an explicitly supported media type;
- JSON, multipart form data and octet-stream are allowed so the global boundary does not break document/upload flows;
- generic error payloads with `Cache-Control: no-store`; no request body, credential, cookie or raw internal exception is reflected in the rejection response.

### Configuration

| Variable | Default | Purpose |
| --- | ---: | --- |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Fixed-window duration |
| `RATE_LIMIT_MAX_REQUESTS` | `120` | General requests per client/window |
| `RATE_LIMIT_SENSITIVE_MAX_REQUESTS` | `30` | Auth/runtime-gate requests per client/window |
| `RATE_LIMIT_MAX_TRACKED_CLIENTS` | `10000` | Memory bound for active client buckets |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Early declared-body limit |
| `RATE_LIMIT_TRUST_FORWARDED_FOR` | `false` | Opt-in forwarded client identity only after proxy-chain validation |

Invalid/out-of-range environment values fall back to bounded defaults rather than disabling the control.

## Rate-limit topology constraint

The current Railway Production API has one replica. The in-process limiter is therefore a valid baseline for the active topology, but it is intentionally **not** presented as a distributed limiter.

Before increasing the API above one replica, the release gate must either:

1. move rate-limit state to a shared/distributed store or provider-backed limiter; or
2. document and approve an equivalent edge enforcement mechanism.

Scaling replicas without that gate would make per-client counters independently enforced per replica and is not an approved Production posture.

`RATE_LIMIT_TRUST_FORWARDED_FOR` must remain false until the exact trusted proxy chain is validated. Enabling it without that validation could allow client-controlled forwarding headers to weaken source-based limiting.

## Input-validation policy

The global middleware is the protocol-level boundary; domain payload correctness remains the responsibility of the existing explicit validators in each module.

The required layered strategy is:

1. **Protocol boundary:** method, declared size and supported media type checked globally.
2. **Authentication/tenant boundary:** OIDC, external identity, TenantContext and tenant membership fail closed where required.
3. **Domain boundary:** module validators parse/normalize identifiers, enums, dates, amounts and lifecycle rules before persistence.
4. **Database boundary:** PostgreSQL constraints, grants and RLS remain the final tenant/data-integrity boundary.

New write endpoints must not accept unvalidated arbitrary payloads. They must reuse a typed domain validator or introduce one with negative tests.

## Error handling and sensitive information

Existing HTTP observability and readiness controls remain authoritative:

- correlation IDs are bounded and sanitized;
- logs omit Authorization, cookies, request bodies and query strings;
- readiness errors return generic 503 responses;
- API security rejections expose only stable error codes/messages;
- Production HSTS and defensive response headers remain enabled.

## Secret and credential lifecycle

Never place credential values in Jira, Confluence, Git history, PR bodies, workflow logs or chat. Only secret **names/categories** may be recorded as evidence.

Credential categories include, when configured:

- Neon runtime/migration/admin credentials and connection URLs;
- `NEON_API_KEY` used by protected operational workflows;
- OIDC/provider client credentials when the selected integration requires them;
- third-party integration tokens introduced by future modules.

### Rotation targets

- privileged administrative/API credentials: rotate at least every 90 days where provider mechanics permit;
- database login credentials: rotate at least every 90 days or immediately after suspected exposure;
- provider client secrets: rotate at least every 90 days when used;
- immediate rotation/revocation after suspected disclosure, member/offboarding event affecting access, or provider security incident.

Provider-managed public keys/JWKS are not copied into secrets and follow provider key rotation.

## Rotation procedure

For a credential that supports overlap:

1. inventory the credential by **name**, owner, environment and consumers — never read it into documentation;
2. create a successor credential with equal or lower privilege;
3. stage the successor in development and execute health/auth/database gates;
4. promote the successor to staging and repeat the gates;
5. update Production only through the controlled release/configuration process;
6. verify health, authentication/tenant gates and database connectivity;
7. revoke the predecessor only after the successor is proven healthy;
8. verify that rollback no longer depends on the revoked credential;
9. record date, credential category, operator and gate evidence — not the secret value.

For a credential that cannot overlap, define a maintenance/rollback window before replacement and preserve the last known-good application release independently from the secret.

## Revocation procedure

Emergency revocation order:

1. disable/revoke the suspected credential at the provider;
2. create a replacement with minimum privilege;
3. update the affected secret store(s);
4. redeploy/restart only the consumers that require the new credential;
5. run health/auth/tenant/database gates;
6. inspect logs/audit for suspicious use during the exposure window;
7. record an incident/finding under the NEX-82 security-event policy.

## Non-destructive rotation drill — 31/08/2026

A tabletop/dry-run drill was completed as part of NEX-81 implementation. No live Production credential value was read, copied, changed or revoked.

The drill validated the operational sequence for the current topology:

- GitHub protected operational secret category → identify workflow consumers → successor first → workflow gate → revoke predecessor;
- Railway API database credential category → successor database credential → update environment secret → exact release deployment → `/health` + `/health/ready` + authenticated tenant runtime gate → revoke predecessor;
- OIDC/provider credential category, when applicable → successor provider credential → environment-specific validation → audience/issuer checks → revoke predecessor;
- rollback remains application-SHA based and must not require restoring a credential already revoked.

The drill intentionally stops before any live secret mutation. Actual Production credential rotation is an operational change and requires the same release/configuration authorization used for Production changes.

## Closure gates for NEX-81 implementation tranche

- required PR CI green, including unit tests for rate limiting and protocol validation;
- post-merge CI green;
- no Production runtime deployment triggered by the implementation PR;
- Jira records the scaling constraint and credential drill;
- Production application of the new middleware is tracked as a separate release/deployment gate because Production remains pinned to the qualified `v0.1.0` SHA until explicitly promoted.
