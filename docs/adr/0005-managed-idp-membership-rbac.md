# ADR-0005 — Managed IdP Adapter; Nexora Owns Membership and RBAC

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Authentication security includes password/session recovery, MFA and abuse controls, while tenant membership and business authorization belong to Nexora.

## Decision

Use a managed identity provider behind an adapter. The IdP proves identity; Nexora owns external-identity linkage, organizations, memberships, roles, permissions, tenant user status and authorization audit.

The domain must not depend directly on the provider SDK.

## Alternatives considered

- fully custom authentication;
- delegate business RBAC entirely to the IdP;
- couple controllers/services directly to provider SDKs.

## Consequences

**Positive:** stronger operational security and provider portability.  
**Trade-off:** external identity must be synchronized carefully with local membership.  
**Mitigation:** one adapter boundary, stable external references and session/membership tests.
