# ADR-0011 — Auth0 as the Initial Managed IdP Implementation

- **Status:** Accepted
- **Date:** 2026-08-29
- **Extends:** ADR-0005
- **Jira:** NEX-17 / NEX-64

## Context

ADR-0005 established that Nexora uses a managed identity provider behind an adapter while Nexora remains authoritative for external-identity linkage, tenant membership, roles, permissions and business authorization.

PR #19 added a vendor-neutral OIDC/JWT adapter to the API. A concrete provider is now required for development, staging and eventual production deployment.

Nexora is a B2B multi-tenant SaaS and needs a provider that supports standards-based OIDC/JWT validation, public JWKS, MFA and a path to enterprise federation without coupling the Nexora domain to provider-specific authorization semantics.

## Decision

Use **Auth0** as the initial managed identity provider implementation.

The integration must remain behind the vendor-neutral OIDC adapter already present in `apps/api`:

- Auth0 proves identity and issues access tokens;
- Nexora validates token signature, exact issuer, audience and expiration;
- `(provider, subject)` maps to `external_identities` and an active internal `users` record;
- Nexora continues to own tenant selection, memberships, roles, permissions and PostgreSQL RLS context;
- Auth0 Organizations, if enabled later for B2B federation/branding, must never replace Nexora tenant authorization or be trusted as a tenant selector by itself;
- provider-specific SDKs must not enter domain or tenancy modules.

## Environment isolation

Preferred topology is one Auth0 tenant per lifecycle environment:

- development;
- staging;
- production.

Each environment uses a distinct Auth0 API audience. The canonical Auth0 issuer must be stored exactly, including its trailing slash.

If the active Auth0 subscription temporarily prevents three isolated tenants, development and staging may share one explicitly non-production Auth0 tenant only as a temporary exception, provided they keep distinct Applications/API audiences. Production must remain isolated.

## Cryptography

Use **RS256** for Nexora API access tokens. The API retrieves verification keys from the tenant JWKS endpoint and does not store an Auth0 signing private key.

## Consequences

**Positive**

- standards-based OIDC integration with no API dependency on an Auth0 SDK;
- asymmetric JWT verification and signing-key rotation through JWKS;
- clear path to MFA, enterprise SSO and B2B organization features;
- provider portability remains viable because Nexora authorization stays local.

**Trade-offs**

- Auth0 tenant/application/API resources must be managed per environment;
- external identities require explicit linkage to Nexora users;
- login/frontend integration will need environment-specific Auth0 client configuration.

## Security invariants

- never accept an unverified `sub` claim as a Nexora `userId`;
- never accept an Auth0 organization claim as sufficient tenant authorization;
- never weaken `TenantContextGuard` or PostgreSQL RLS because Auth0 authenticated the user;
- production Auth0 settings and Railway variables are changed only after the production tenant/API exist and have been validated in lower environments;
- use the exact issuer value advertised by Auth0/OpenID configuration; issuer comparison is exact.

## Validation

Before production activation:

1. development access token validates against development issuer/audience/JWKS;
2. staging access token validates against staging issuer/audience/JWKS;
3. tokens from the wrong environment are rejected by issuer and/or audience;
4. mapped active identity resolves to an internal user through `nexora_app`;
5. unknown or suspended identities are rejected;
6. TenantContext membership/RLS gates remain green after authentication.
