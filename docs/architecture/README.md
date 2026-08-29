# Nexora TMS Architecture

This directory contains the canonical architecture baseline versioned with the source code.

## Accepted Wave 0 baseline

- [`c4-v1.md`](./c4-v1.md) — system context, containers, trust boundaries, primary flows, deployment mapping and non-functional baseline. Jira: NEX-17 / NEX-62.
- [`module-boundaries-and-contracts-v1.md`](./module-boundaries-and-contracts-v1.md) — canonical stack, bounded contexts, ownership, dependency rules, API/event/job contracts and extraction criteria. Jira: NEX-17 / NEX-63.
- [`../adr/`](../adr/) — accepted foundational architecture decisions. Jira: NEX-17 / NEX-64.

## Wave 0 scope

Architecture must make the following explicit before Core TMS feature development:

- system context and container boundaries;
- application/module ownership;
- frontend/backend responsibilities;
- multi-tenant isolation;
- identity, authentication and authorization;
- PostgreSQL ownership and migration strategy;
- asynchronous processing and integration boundaries;
- observability, audit and security baselines;
- deployment topology and environment strategy;
- resilience, backup and recovery expectations.

## Rule

This documentation describes the current approved target state. A material change to an accepted architectural decision requires a new ADR that supersedes the previous decision; historical accepted decisions are not silently rewritten.
