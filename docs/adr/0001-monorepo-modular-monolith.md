# ADR-0001 — Monorepo + Modular Monolith

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Nexora needs rapid product development, strong transactional consistency and domain evolution without the operational cost of premature microservices.

## Decision

Adopt a single monorepo with `apps/web`, `apps/api` and `apps/worker`. The backend starts as a modular monolith split into explicit bounded contexts.

## Alternatives considered

- microservices from day one;
- separate repositories per deployable;
- monolith without formal boundaries.

## Consequences

**Positive:** simpler transactions, lower operational overhead, safer refactoring and controlled contract sharing.  
**Trade-off:** strong architectural discipline is required to prevent cross-module coupling.  
**Mitigation:** architecture tests, module ownership and no circular dependencies.
