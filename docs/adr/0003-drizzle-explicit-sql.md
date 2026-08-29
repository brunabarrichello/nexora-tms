# ADR-0003 — Drizzle ORM + Versioned Explicit SQL

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

The platform needs ORM productivity without losing PostgreSQL capabilities such as RLS, advanced constraints, indexes and performance-oriented SQL.

## Decision

Use Drizzle ORM for typed schema/query work and versioned explicit SQL for PostgreSQL capabilities that should not be hidden behind ORM abstractions.

## Alternatives considered

- Prisma as the sole data layer;
- handwritten SQL for all persistence;
- an active-record style ORM with stronger domain/persistence coupling.

## Consequences

**Positive:** strong typing and transparent PostgreSQL control.  
**Trade-off:** contributors must understand PostgreSQL rather than relying only on ORM abstractions.  
**Mitigation:** mandatory migration review and clean-schema migration tests.
