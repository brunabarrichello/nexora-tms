# Nexora TMS Architecture

This directory contains the canonical architecture documentation for Nexora TMS.

## Wave 0 scope

Before feature implementation, the project must establish and review:

- system context and container boundaries;
- application and service boundaries;
- frontend and backend responsibilities;
- multi-tenant isolation model;
- identity, authentication, and authorization model;
- PostgreSQL data ownership and migration strategy;
- asynchronous processing and integration boundaries;
- observability, audit, and security baselines;
- deployment topology and environment strategy;
- resilience, backup, and recovery expectations.

## Expected artifacts

The initial architecture package should include:

1. C4 System Context.
2. C4 Container diagram.
3. Initial component/module map.
4. Data architecture and tenancy model.
5. Security architecture.
6. Integration architecture.
7. Deployment architecture.
8. Architecture Decision Records under `docs/adr/`.

## Rule

Architecture documentation describes the current approved target state. Important decisions and their rationale belong in ADRs so that historical decisions remain traceable.
