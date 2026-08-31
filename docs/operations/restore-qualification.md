# Production Restore Qualification

Jira: NEX-79 / NEX-93

This document complements `docs/operations/disaster-recovery.md` with the executable qualification for the current Free-only Production profile.

## Current recovery contract

- Neon project: `raspy-river-76339604`.
- Canonical Production: `production` / `br-silent-feather-a5ku7uyi`.
- PostgreSQL: 18.
- History retention: 21,600 seconds (6 hours).
- Free branch limit: 10 simultaneous branches.
- Runtime role: `nexora_app`.
- Migration role: `nexora_migrator` with controlled `SET ROLE nexora_owner`.

The 6-hour horizon is an accepted Free-tier constraint. A longer restore window must never be claimed unless the active provider configuration and project policy change.

## Qualification objectives

- Historical recovery point: 5 minutes before the exercise by default.
- Allowed automated exercise range: 1-300 minutes before execution, leaving a safety margin inside the 360-minute history window.
- Database-ready RTO target: <= 10 minutes.
- Recovery usability: the restored target must pass ledger, role, Audit, RLS and API readiness checks.

The exercise records measured values; these targets are not provider SLAs.

## Automated PITR exercise

Workflow: `.github/workflows/neon-production-restore-qualification.yml`.

The workflow does not rewind or repoint canonical Production. It:

1. validates Production root/default identity, history retention and branch capacity;
2. creates an isolated branch from a historical Production timestamp using Neon PITR branching;
3. provisions an isolated read-write compute for the recovery branch;
4. obtains direct connection URIs and enforces `sslmode=verify-full`;
5. measures time until the recovered database is queryable;
6. verifies TLSv1.2/TLSv1.3, Drizzle ledger, minimum-privilege roles, Wave 0024 Audit schema/immutability and runtime RLS;
7. compares the recovered schema with current Production for the controlled no-schema-change exercise;
8. starts the API locally against the recovered database;
9. verifies `/health/live`, `/health/ready`, correlation/security headers and fail-closed unauthenticated access;
10. validates exact recovery-branch ID/name/parent before cleanup;
11. deletes only that temporary recovery branch and proves absence.

The workflow executes once when first merged and is also reusable through `workflow_dispatch`, which requires `QUALIFY-PRODUCTION-RESTORE`.

## Evidence required

NEX-93 can only close when a real run records:

- source timestamp;
- recovery branch identity;
- tested recovery-point lag;
- measured database-ready RTO;
- migration ledger result;
- role/grant posture result;
- Audit immutability result;
- RLS result;
- API readiness and negative-auth smoke result;
- cleanup/absence result;
- GitHub Actions run ID/date.

## Incident recovery rule

For a real incident, first recover into an isolated branch and validate it. Repointing a Production compute, replacing canonical Production, or modifying a Production connection target is a separate high-impact action requiring explicit operational approval and an updated Production Version Matrix.

## Destructive database changes

Before destructive DDL:

- prefer expand/migrate/contract;
- make application changes backward-compatible before contraction;
- identify tables, constraints, triggers, policies and Audit impact;
- require versioned Drizzle migration artifacts and green CI/database gates;
- define forward-fix and recovery path;
- verify current history window and free branch capacity;
- create a pre-change recovery point when risk warrants it;
- retain that recovery point until post-change runtime qualification;
- update the Production Version Matrix after every Production schema promotion.
