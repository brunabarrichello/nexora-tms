# Runbook — Release and Rollback Flow

Jira: NEX-21 / NEX-75

## Release principle

Production is promoted from a validated staging state. A successful build alone is not sufficient evidence for production release.

## Standard release

1. PR passes all executable quality/security checks.
2. Preview is reviewed when UI/API behavior benefits from it.
3. PR is squash-merged into `main`.
4. Staging deploy is created from the merged revision.
5. Staging database migrations are applied using the migrator credential.
6. Staging smoke/integration checks pass.
7. Release owner verifies known risks, migration impact and rollback readiness.
8. Production promotion is explicitly approved when protection features are available/required.
9. Production migrations are applied in the documented safe order.
10. Web/API/Worker production deployment is completed.
11. Health/readiness and critical smoke checks are verified.
12. Release revision, migration revision and evidence are recorded.

## Stop conditions

Stop promotion when any of the following is true:

- required CI did not execute;
- staging migration failed or produced unexpected schema diff;
- smoke/health checks fail;
- unresolved critical security finding exists;
- production secret/configuration is missing or reused incorrectly;
- destructive migration lacks recovery evidence;
- release revision cannot be identified unambiguously.

## Rollback strategy

Application rollback and database rollback are separate decisions.

### Application

Prefer redeploying the last known-good immutable revision when the database remains backward-compatible.

### Database

Prefer forward fixes and expand/contract. Do not automatically run destructive down migrations. For data loss/corruption incidents, follow the database backup/restore runbook and verify recovery in isolation first.

## Evidence

Record at minimum:

- Git commit / PR;
- environment;
- deployment revision;
- migration revision;
- operator/release owner;
- smoke/health result;
- known exceptions;
- rollback target/readiness.

## Emergency change

Emergency production changes still require traceability. If an ordinary gate is bypassed because of an incident, create the corresponding PR/issue/evidence immediately and restore normal controls after stabilization.
