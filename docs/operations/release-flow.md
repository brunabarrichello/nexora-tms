# Runbook — Release and Rollback Flow

Jira: NEX-21 / NEX-75 / NEX-89 / NEX-92 / NEX-88

## Release principle

Production is promoted only from a validated staging state. A successful build, merge or deployment alone is not sufficient evidence for a production release.

The canonical production release chain is:

```text
validated staging
→ release candidate identified
→ release/version matrix recorded
→ production readiness Go/No-Go
→ controlled production promotion
→ post-promotion qualification
```

## Release identity

Every release candidate must have an unambiguous identity before production approval:

- release/tag or approved immutable release identifier;
- source `main` commit SHA;
- Web SHA/version;
- API SHA/version;
- Worker SHA/version;
- migration/schema version and Drizzle ledger state;
- source environment for the promotion;
- release owner;
- linked Jira items and pull requests.

NEX-92 is the canonical Production Version Matrix work item. Until that matrix is established and filled for a release, production promotion remains blocked.

## Standard release

1. PR passes all executable quality/security checks.
2. Preview is reviewed when UI/API behavior benefits from it.
3. PR is squash-merged into `main`.
4. Development/shared-environment qualification completes when applicable.
5. Staging deploy is created from the merged immutable revision.
6. Staging database migrations are applied using the migrator credential.
7. Staging smoke/integration, RLS/isolation and relevant domain gates pass.
8. Release owner verifies known risks, migration impact, dependency compatibility and rollback readiness.
9. Release notes are prepared and linked to Jira/PR/migration evidence.
10. NEX-92 Production Version Matrix is populated for the candidate.
11. NEX-93 Restore Qualification evidence is current enough for the release risk profile when database recovery is relevant.
12. NEX-88 Production Readiness checklist reaches an explicit Go decision.
13. Production promotion is explicitly approved.
14. Production migrations are applied in the documented safe order.
15. Web/API/Worker production deployment is completed only for components qualified by the matrix.
16. Health/readiness, authentication, critical API/Web smoke and tenant isolation checks are verified.
17. Production Version Matrix is updated with the actually promoted revisions, timestamp and responsible operator.
18. Release evidence and any exceptions are archived in Jira/Confluence/GitHub as appropriate.

## Stop conditions

Stop promotion when any of the following is true:

- required CI did not execute or is not green;
- staging migration failed or produced unexpected schema diff;
- smoke/health/RLS/isolation checks fail;
- unresolved critical security finding exists;
- production secret/configuration is missing or reused incorrectly;
- destructive migration lacks recovery evidence;
- release revision cannot be identified unambiguously;
- Web/API/Worker/schema versions are not captured in NEX-92;
- Worker is required by the release but NEX-91 qualification is incomplete;
- Outbox/Durable Jobs are required by the release but NEX-90 is incomplete;
- restore/DR evidence required by the change risk is missing;
- NEX-88 has not produced an explicit Go decision.

## Promotion model

The expected environment path is:

```text
development → staging → production
```

Promotion must preserve traceability to the exact source SHA and migration/schema state. Rebuilding an unidentified revision for production is not an acceptable promotion mechanism.

Production remains logically separate from shared development/staging migration automation unless an explicitly approved production workflow exists with equivalent or stronger gates.

## Rollback strategy

Application rollback and database rollback are separate decisions.

### Application

Prefer redeploying the last known-good immutable revision when the database remains backward-compatible. The rollback target must be present in the release/version evidence.

### Database

Prefer forward fixes and expand/contract. Do not automatically run destructive down migrations. For data loss/corruption incidents, follow the database backup/restore runbook and verify recovery in isolation first.

A rollback is not complete until health, authentication, tenant isolation and critical business smoke checks pass against the rollback state.

## Production Version Matrix — required fields

Record at minimum for each qualified production promotion:

| Field                     | Required                         |
| ------------------------- | -------------------------------- |
| Release/tag               | yes                              |
| Source `main` SHA         | yes                              |
| Web SHA/version           | yes                              |
| API SHA/version           | yes                              |
| Worker SHA/version        | yes, or explicit N/A with reason |
| Migration/schema version  | yes                              |
| Drizzle ledger state      | yes when database applies        |
| Source environment        | yes                              |
| Promotion timestamp       | yes                              |
| Release owner/operator    | yes                              |
| Jira/PR evidence          | yes                              |
| Smoke/health/RLS result   | yes                              |
| Rollback target/readiness | yes                              |
| NEX-88 Go/No-Go result    | yes                              |

## Current production qualification status — 2026-08-30

No production release is considered formally qualified by this runbook yet.

- Web production version: not qualified in NEX-92;
- API production version: not qualified in NEX-92;
- Worker production version: not formally deployed/qualified under NEX-91;
- schema/migration production version: not qualified by the production gate;
- release/tag: not yet established through NEX-89;
- production Go/No-Go: pending NEX-88.

The existence of an endpoint, deployment or successful staging migration must not be interpreted as a qualified production release.

## Evidence

Record at minimum:

- Git commit / PR;
- release/tag;
- environment;
- deployment revision for each component;
- migration revision / schema version;
- operator/release owner;
- smoke/health/RLS/isolation result;
- known exceptions;
- rollback target/readiness;
- links to NEX-88, NEX-89, NEX-92 and NEX-93 evidence when applicable.

## Emergency change

Emergency production changes still require traceability. If an ordinary gate is bypassed because of an incident, create the corresponding PR/issue/evidence immediately, record the exception and risk acceptance, and restore normal controls after stabilization.
