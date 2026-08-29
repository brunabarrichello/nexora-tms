# ADR-0007 — REST + OpenAPI as the Initial External API

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

The MVP needs simple, auditable and interoperable contracts for the Web application and future integrations.

## Decision

Expose a versioned HTTP REST API under `/api/v1`, documented through OpenAPI. Public DTOs never expose domain entities or ORM models directly.

## Alternatives considered

- GraphQL from the first release;
- public RPC-style endpoints;
- REST without a formal specification.

## Consequences

**Positive:** broad interoperability, generated documentation and contract testing.  
**Trade-off:** some dashboards may need dedicated query endpoints/read models.  
**Mitigation:** use-case-oriented queries and purpose-built read models when justified.
