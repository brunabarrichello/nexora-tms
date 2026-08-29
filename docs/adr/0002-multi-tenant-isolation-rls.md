# ADR-0002 — Multi-Tenant Isolation in Application + PostgreSQL RLS

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Nexora is a multi-tenant SaaS. Cross-organization data exposure is a critical security risk.

## Decision

Every tenant-scoped entity includes `tenant_id`. The application resolves a central `TenantContext` and enforces authorization in each use case. PostgreSQL Row-Level Security is used as defense in depth on critical tables where compatible with the access and migration model.

## Alternatives considered

- one database per tenant from MVP;
- one schema per tenant;
- application filters only, with no database defense layer.

## Consequences

**Positive:** operationally viable shared infrastructure with testable isolation.  
**Trade-off:** RLS increases migration and connection-context complexity.  
**Mitigation:** negative cross-tenant tests and separate database roles.
