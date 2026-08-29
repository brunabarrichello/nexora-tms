# Nexora TMS — IAM Model v1

**Status:** Wave 0 design baseline  
**Jira:** NEX-19 / NEX-68 / NEX-69 / NEX-70

## Responsibility split

A managed identity provider authenticates the human identity. Nexora remains the authority for tenant membership, roles, permissions, scopes, account state inside an organization and business authorization.

The domain depends on an identity-provider port/adapter, never directly on a vendor SDK.

## Core concepts

### User

A Nexora-local identity reference representing the person/account known to the application. It is not the password store.

### External identity

Maps the local user to an identity-provider subject and provider. External provider identifiers are references, not tenant authorization.

### Membership

Links a user to one tenant/organization and controls active/suspended/invited state plus assigned roles/scopes.

A user may have multiple memberships, but each request executes under one explicit tenant context.

### Role

Named set of business permissions. Roles are tenant-governed unless explicitly defined as platform/system roles.

### Permission

Stable capability identifier such as a resource/action pair. Permission resolution is server-side and deny-by-default.

### Organizational scope

Optional narrower boundary inside a tenant, such as branch/business unit or operational region. A role alone does not imply unrestricted tenant-wide scope when a narrower assignment exists.

### Session metadata

Nexora may persist security/audit metadata required to correlate application state with the managed IdP session, but password/recovery secrets remain with the provider.

## Authorization evaluation

For each protected operation:

```text
authenticated identity
  -> local user active?
  -> active membership for selected tenant?
  -> required role/permission?
  -> organizational scope permits target?
  -> resource policy permits operation?
  -> tenant/resource resolved server-side?
  -> allow
```

Any failed step denies access.

## Tenant selection

- tenant context is derived from an authenticated membership and server-side resolution;
- a client-supplied tenant/organization UUID is merely a selector/input and must be validated against memberships;
- changing tenant context changes authorization scope for the request/session flow;
- background service identities use explicit service capabilities rather than impersonating a human role implicitly.

## Login/logout/recovery ownership

The managed IdP owns credential verification, login challenge, password/passkey recovery and provider-level MFA flows.

Nexora owns post-authentication checks:

- local user state;
- membership state;
- tenant selection;
- permission resolution;
- audit/correlation;
- application logout/session invalidation integration.

## Administrative security

- prepare MFA from Foundation; require it for administrative accounts where provider capability supports it;
- privileged membership/role/permission changes are audited;
- no self-escalation through writable role/tenant fields;
- administrative endpoints are protected by explicit permissions/scopes, not by UI hiding.

## Initial conceptual entities

```text
users
external_identities
organizations / tenants
memberships
roles
permissions
role_permissions
membership_roles
membership_scopes (when required)
session_security_metadata (only if required by chosen adapter)
```

Exact physical tables and fields are implemented through versioned migrations after the monorepo/database package is executable.

## Required tests

Before NEX-19 can close, automate at minimum:

- unauthenticated protected request denied;
- authenticated user without membership denied;
- suspended membership denied;
- missing permission denied;
- required permission allowed;
- forged tenant/role/client state does not grant access;
- logout/session revocation behavior;
- recovery/provider flow integration;
- privileged role/membership changes audited.

## Completion gate

This file defines the contract but does not implement IAM. NEX-68/69/70 remain incomplete until schema, adapter, RBAC and login/logout/recovery flows exist as executable tested code.
