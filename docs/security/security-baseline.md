# Nexora TMS — Security Baseline

**Status:** Wave 0 baseline in progress  
**Jira:** NEX-23 / NEX-81

## Security principles

1. deny by default;
2. authenticate identity before business authorization;
3. authorize server-side for every protected operation;
4. resolve tenant context centrally and never trust client-supplied tenant/organization/role identifiers as proof;
5. enforce least privilege for users, services and database roles;
6. treat RLS as defense in depth, not a replacement for application authorization;
7. secrets never belong in code, logs, commits, fixtures or documentation;
8. sensitive actions are auditable;
9. security controls are feature Definition of Done, not post-MVP hardening.

## Authorization decision

A protected operation evaluates, as applicable:

1. authenticated identity;
2. active local identity state;
3. active membership;
4. active tenant context;
5. roles and permissions;
6. organizational/business scope;
7. resource/operation policy;
8. database isolation defense such as RLS where enabled.

A UUID, `tenant_id`, `organization_id`, role name, route parameter, header or browser state received from the client is untrusted input.

## Identity provider boundary

Use a managed IdP behind an adapter as established by ADR-0005. The concrete provider is selected/evaluated without coupling domain code to its SDK.

The IdP proves identity. Nexora remains authority for:

- organizations/tenants;
- memberships;
- roles/permissions;
- business scopes;
- suspension/activation state;
- authorization decisions and audit.

Administrative MFA is required when provider/platform capability supports it. Enterprise SSO/SCIM should remain possible without blocking MVP delivery.

## Session and browser controls

Target controls include:

- secure session lifecycle and revocation;
- HttpOnly/Secure cookies where cookie sessions are used;
- appropriate SameSite policy;
- CSRF protection when the authentication/session architecture requires it;
- restrictive CORS;
- CSP and security headers for Web;
- no auth/security authority delegated to browser state.

## API controls

Every public API boundary applies, where relevant:

- schema/input validation;
- request size limits;
- rate limiting/abuse controls;
- anti-enumeration behavior for identity and sensitive resources;
- safe error envelopes without stack traces, SQL or secrets;
- correlation identifiers;
- authorization before resource disclosure;
- idempotency for duplicate-sensitive commands;
- explicit timeout/retry policy for outbound calls.

## Webhooks and external integrations

Inbound webhook baseline:

- authenticate/verify provider signature or equivalent proof;
- validate timestamp/replay window where supported;
- reject duplicate delivery safely through idempotency;
- validate schema/version;
- do not trust provider payload tenant/resource IDs without local resolution;
- audit repeated invalid/replay attempts when operationally useful.

Outbound integrations:

- credentials live in managed secrets;
- provider responses are untrusted input;
- timeouts/retries are bounded;
- sensitive payload minimization applies;
- logs redact tokens/credentials and unnecessary personal data.

## Database security

- separate migrator, API runtime and worker capabilities;
- runtime roles are least-privilege and never receive `BYPASSRLS`;
- application-owned objects live under governed schema ownership;
- production database network exposure must be tightened to the strongest controls supported by the active plan before sensitive production use;
- ad-hoc runtime DDL is forbidden;
- production credentials are distinct from lower environments.

## Secret management

Never commit or document secret values. Secret-like examples must be clearly non-functional placeholders.

Required practices:

- separate credentials by environment/workload;
- rotate on exposure or suspected compromise;
- remove leaked values from active use even if Git history is rewritten;
- prefer short-lived/scoped credentials where supported;
- inventory secret names/owners without storing values;
- prevent secret values from reaching client bundles or build artifacts.

## Dependency and code security

Target automated gates:

- dependency vulnerability scanning;
- secret scanning;
- SAST/static security analysis as tooling matures;
- lockfile/reproducible dependency validation;
- review of privileged/security-sensitive CODEOWNERS paths.

## Sensitive data / LGPD baseline

- collect only data required for defined business purpose;
- classify personal, financial, credential and document data;
- avoid sensitive values in logs/analytics/test fixtures;
- define retention/deletion policies before production use;
- production data is not cloned to lower environments without sanitization;
- audit and access controls must support investigation without unnecessarily duplicating sensitive payloads.

## Completion gate

This policy is not implementation evidence. NEX-81 remains incomplete until API/Web/Worker controls are implemented and executable security/secret checks actually run in the validated toolchain/CI.
