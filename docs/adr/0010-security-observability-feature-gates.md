# ADR-0010 — Security and Observability Are Feature Gates

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Treating security, testing and observability as end-of-MVP hardening creates structural risk in a multi-tenant SaaS.

## Decision

Every tenant-scoped feature includes, where applicable:

- RBAC/authorization;
- tenant isolation;
- input validation;
- structured logging and correlation;
- audit for sensitive events;
- relevant unit/integration/E2E tests;
- protection against secrets/sensitive data in logs;
- metrics/alerts when operationally critical.

These are part of Definition of Done, not a later hardening phase.

## Alternatives considered

- security hardening after MVP;
- a separate future security sprint;
- add tests only after functional modules are complete.

## Consequences

**Positive:** security and operability regressions are detected early and the baseline remains sustainable.  
**Trade-off:** each Story has a stricter completion gate.  
**Mitigation:** reusable cross-cutting packages, templates and automated quality gates.

## ADR governance

Create a new ADR when a decision changes module ownership/boundaries, database/ORM/runtime/platform, multi-tenant/IAM strategy, broker/cache/datastore, external API structure, security/retention/audit policy, or introduces a microservice.

Accepted decisions are never silently rewritten to change historical meaning; a new ADR supersedes the old one.
