# Architecture Decision Records

Architecture Decision Records (ADRs) document significant technical decisions for Nexora TMS.

## Status values

Use one of:

- Proposed
- Accepted
- Superseded
- Deprecated
- Rejected

## Naming

Use sequential names:

`NNNN-short-decision-title.md`

Example:

`0001-application-architecture-style.md`

## Process

1. Copy `0000-template.md`.
2. Describe context, decision drivers, options, decision, and consequences.
3. Open the ADR through the normal pull-request process.
4. Reference related Jira work or GitHub issues when available.
5. If a decision changes later, create a new ADR and mark the prior ADR as superseded rather than rewriting history.

## Wave 0 candidates

Initial ADRs are expected to cover at least:

- application architecture style;
- monorepo/workspace strategy;
- frontend technology;
- backend technology;
- API style and versioning;
- multi-tenant isolation model;
- PostgreSQL access and migration model;
- authentication and authorization;
- asynchronous jobs/events;
- observability and audit;
- deployment and environment topology.
