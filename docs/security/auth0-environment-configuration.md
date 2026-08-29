# Auth0 Environment Configuration — Nexora TMS

This runbook operationalizes ADR-0011 and the OIDC adapter merged in PR #19.

## Authority boundary

Auth0 authenticates identities. Nexora remains authoritative for:

- `external_identities` linkage;
- internal `users.status`;
- tenant membership;
- roles and permissions;
- selected tenant validation;
- PostgreSQL RLS context.

An Auth0 token or Auth0 Organization claim must never authorize a Nexora tenant by itself.

## Preferred Auth0 topology

Create one Auth0 tenant per lifecycle environment when the subscription permits it.

| Nexora environment | Suggested Auth0 tenant purpose    | Auth0 API identifier / `OIDC_AUDIENCE` | `OIDC_PROVIDER_KEY` | Algorithm |
| ------------------ | --------------------------------- | -------------------------------------- | ------------------- | --------- |
| development        | Nexora non-production development | `urn:nexora:tms:api:development`       | `auth0`             | `RS256`   |
| staging            | Nexora pre-production validation  | `urn:nexora:tms:api:staging`           | `auth0`             | `RS256`   |
| production         | Nexora production identities      | `urn:nexora:tms:api:production`        | `auth0`             | `RS256`   |

Auth0 tenant names/domains are globally assigned and must be recorded after creation; do not invent or reuse a production domain for a lower environment.

If the current Auth0 plan temporarily limits tenant count, development and staging may share an explicitly non-production tenant as an exception, but they must use distinct Auth0 Applications and distinct API audiences. Production must remain isolated.

## Auth0 resources per environment

For each environment create:

1. an Auth0 tenant for that lifecycle environment;
2. an Auth0 API named `Nexora TMS API - <environment>`;
3. API signing algorithm `RS256`;
4. API Identifier exactly equal to the environment audience from the matrix above;
5. a web Application for the Nexora web frontend when frontend login integration begins;
6. only the required Connections for that environment.

Auth0 Organizations may be enabled later for B2B federation, branding or enterprise SSO, but Nexora membership/RBAC remains authoritative.

## API runtime variables

After each Auth0 tenant/API exists, configure the API service with the following values.

### Development

```text
OIDC_PROVIDER_KEY=auth0
OIDC_ISSUER_URL=https://<development-auth0-domain>/
OIDC_JWKS_URL=https://<development-auth0-domain>/.well-known/jwks.json
OIDC_AUDIENCE=urn:nexora:tms:api:development
OIDC_ALLOWED_ALGORITHMS=RS256
```

### Staging

```text
OIDC_PROVIDER_KEY=auth0
OIDC_ISSUER_URL=https://<staging-auth0-domain>/
OIDC_JWKS_URL=https://<staging-auth0-domain>/.well-known/jwks.json
OIDC_AUDIENCE=urn:nexora:tms:api:staging
OIDC_ALLOWED_ALGORITHMS=RS256
```

### Production

```text
OIDC_PROVIDER_KEY=auth0
OIDC_ISSUER_URL=https://<production-auth0-domain>/
OIDC_JWKS_URL=https://<production-auth0-domain>/.well-known/jwks.json
OIDC_AUDIENCE=urn:nexora:tms:api:production
OIDC_ALLOWED_ALGORITHMS=RS256
```

`OIDC_ISSUER_URL` is an exact OIDC issuer identifier. Preserve the trailing slash advertised by Auth0. `OIDC_JWKS_URL` does not contain credentials and points to the tenant's public signing keys.

## Railway state

Current Nexora Railway project:

- project: `nexora-tms`;
- API service: `nexora-tms-api`;
- currently available Railway environment: `production`.

Do not set production OIDC variables until a dedicated production Auth0 tenant and API have been created and lower-environment validation has passed.

Development and staging runtime variables belong in their corresponding runtime environments once those environments exist on Railway (or on the platform selected to host those API instances). Do not copy a production Auth0 issuer/audience into non-production.

## External identity provisioning

An Auth0-authenticated user is not automatically a Nexora user. Before protected tenant routes can succeed, create or provision the internal relationship:

```text
users.id <-> external_identities.user_id
external_identities.provider = auth0
external_identities.subject = <Auth0 access-token sub>
```

Only an internal user with `users.status = active` is eligible to become `AuthenticatedPrincipal`.

## Validation checklist per environment

1. Fetch `https://<auth0-domain>/.well-known/openid-configuration` and verify the advertised `issuer` and `jwks_uri`.
2. Confirm the issuer exactly matches `OIDC_ISSUER_URL`, including trailing slash.
3. Confirm the API Identifier matches `OIDC_AUDIENCE` exactly.
4. Obtain a user access token for the Nexora API audience.
5. Confirm the API accepts a valid token from the same environment.
6. Confirm the API rejects the same token when issuer or audience is changed.
7. Confirm an unmapped `sub` is rejected.
8. Link the identity to an active Nexora user and confirm authentication succeeds.
9. Confirm a suspended internal user is rejected even when the Auth0 token is valid.
10. Confirm TenantContext membership and cross-tenant RLS tests remain green.

## Production gate

Production activation requires all of the following:

- dedicated production Auth0 tenant/API exists;
- production issuer/audience/JWKS recorded from Auth0, not guessed;
- development and staging validation completed;
- `external_identities` provisioning process defined;
- Railway production variables reviewed before write;
- production deployment explicitly authorized;
- post-deploy authentication smoke test and RLS isolation test completed.
