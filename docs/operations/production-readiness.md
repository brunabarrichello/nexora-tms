# Nexora TMS — Production Readiness and Version Qualification

Jira: NEX-88 / NEX-89 / NEX-90 / NEX-91 / NEX-92 / NEX-93 / NEX-86

## Purpose

Provide the operational gate that prevents staging success, a live endpoint or an isolated deployment from being mistaken for a formally qualified production release.

This document reconciles the current implementation state with Jira and Confluence. It is a checklist and evidence contract; it does not itself declare production ready.

## Current reconciled state — 2026-08-30

| Scope                         | State                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| Wave 0022 — Trips Core        | ✅ completed and promoted through development/staging      |
| Wave 0023 — Trips Execution   | ✅ completed and promoted through development/staging      |
| Wave 0024 — Audit             | ✅ completed and promoted through development/staging      |
| Wave 0024 — global            | 🟡 partial: Outbox/Durable Jobs still pending under NEX-90 |
| Worker runtime                | ⏳ formal deployment/qualification pending NEX-91          |
| Release Management            | ⏳ pending NEX-89                                          |
| Production Version Matrix     | ⏳ pending NEX-92                                          |
| Restore Qualification         | ⏳ pending NEX-93                                          |
| Production Readiness Go/No-Go | ⏳ pending NEX-88                                          |

Production must remain **not formally qualified** until the applicable gates below have objective evidence.

## Wave 0024 closure rule

The Audit slice is complete, but Wave 0024 is globally partial until NEX-90 delivers the reliable asynchronous infrastructure expected by the roadmap:

- transactional outbox;
- durable persistent jobs;
- idempotent processing;
- retries/backoff;
- dead-letter handling;
- safe concurrency/leases or equivalent;
- tenant-aware RLS/grants;
- observability and auditability;
- failure, retry, duplication and isolation tests.

Do not mark Wave 0024 globally complete from Audit evidence alone.

## Production topology qualification

A Go decision must explicitly identify each participating component.

### Web

Required evidence:

- immutable SHA/version;
- successful production-target build;
- environment-specific configuration verified;
- Web→API connectivity;
- authentication/login critical path;
- critical navigation smoke;
- rollback target.

### API

Required evidence:

- immutable SHA/version;
- production-target configuration and secret inventory verified;
- health/readiness;
- OIDC/authentication behavior;
- authorization/server-side tenant gates;
- database runtime role and least privilege;
- RLS/isolation negative tests;
- critical API smoke;
- rollback target.

### Worker

Required when asynchronous processing is part of the release:

- immutable SHA/version;
- formal runtime/service from NEX-91;
- environment-specific secrets;
- health/observability;
- least-privilege database role;
- safe concurrency/restart policy;
- integration with NEX-90;
- idempotency/retry/dead-letter smoke;
- rollback target.

### Database

Required evidence:

- target production database/branch identified;
- migration/schema version identified;
- Drizzle ledger consistent with release source;
- safe migration order;
- grants/ownership/RLS verified;
- negative cross-tenant read/write checks;
- production smoke after migration;
- restore/recovery evidence appropriate to migration risk.

## Security readiness

Go is blocked when any applicable item below is unresolved:

- production secrets missing, duplicated from another environment or stored outside the approved secret manager;
- OIDC audience/issuer/environment separation invalid;
- privileged runtime database credentials used instead of least-privilege roles;
- critical authorization or RLS isolation failure;
- unresolved critical/high security finding without explicit risk acceptance;
- audit logging required by the change cannot be verified;
- credential rotation/revocation path is unknown for critical credentials.

## Observability readiness

Required minimum evidence:

- health/readiness endpoint or equivalent for API/Worker;
- structured logs with environment/component context;
- request/correlation identifiers where applicable;
- error and failure visibility;
- migration/deployment logs;
- alerts/escalation path for critical failures;
- ability to distinguish Web, API, Worker and database failures;
- Outbox/job metrics once NEX-90/NEX-91 are active.

## Production Version Matrix — NEX-92

The following fields are mandatory for a qualified promotion. Values below intentionally remain unqualified until objective promotion evidence exists.

| Field                           | Qualified production value          |
| ------------------------------- | ----------------------------------- |
| Release/tag                     | **not qualified**                   |
| Source `main` SHA               | **not qualified**                   |
| Web SHA/version                 | **not qualified**                   |
| API SHA/version                 | **not qualified**                   |
| Worker SHA/version              | **not formally deployed/qualified** |
| Migration/schema version        | **not qualified for production**    |
| Drizzle ledger state            | **not qualified for production**    |
| Source environment              | **pending**                         |
| Promotion timestamp             | **pending**                         |
| Release owner/operator          | **pending**                         |
| Production smoke result         | **pending**                         |
| RLS/isolation result            | **pending**                         |
| Restore qualification reference | **pending NEX-93**                  |
| Go/No-Go result                 | **pending NEX-88**                  |
| Rollback target/readiness       | **pending**                         |

An existing endpoint, deploy or main-branch SHA is not a substitute for this matrix.

## Restore Qualification — NEX-93

Before production Go/No-Go, verify that the current release risk is covered by practical recovery evidence. The detailed procedure is in `docs/operations/disaster-recovery.md`.

Required outcome:

- real restore/PITR exercise in a controlled target;
- measured RTO/RPO;
- schema/ledger/grants/RLS validation;
- negative tenant isolation;
- application smoke;
- Worker/async compatibility when applicable;
- evidence package and explicit pass/conditional pass/fail.

NEX-79 remains the initial backup/restore policy and destructive-migration checklist; it does not replace NEX-93.

## Release Management — NEX-89

The detailed release and rollback path is in `docs/operations/release-flow.md`.

A production candidate requires:

- version/release identity;
- release notes;
- Jira/PR/commit/migration traceability;
- promotion source and target;
- rollback target;
- Production Version Matrix;
- Production Readiness Go decision.

## Go / No-Go checklist — NEX-88

A release is **Go** only when every applicable item has evidence or an explicitly approved exception:

- [ ] staging state is validated and source revision is immutable;
- [ ] required CI/security/domain gates are green;
- [ ] Web/API/Worker component versions are identified;
- [ ] database migration/schema/ledger version is identified;
- [ ] production secrets/configuration are verified;
- [ ] authentication/authorization requirements pass;
- [ ] RLS and negative tenant isolation pass;
- [ ] critical business smoke tests pass;
- [ ] observability/health/alerts are operational;
- [ ] NEX-90 is complete if asynchronous reliability is required by the release;
- [ ] NEX-91 is complete if Worker is required by the release;
- [ ] release notes and rollback target are prepared under NEX-89;
- [ ] NEX-92 Production Version Matrix is complete;
- [ ] NEX-93 recovery evidence is accepted for the release risk;
- [ ] known exceptions have owner, severity, expiry/review and explicit acceptance;
- [ ] release owner records explicit Go decision.

Any failed mandatory item results in **No-Go**.

## Post-promotion qualification

Immediately after controlled production promotion:

1. verify the exact promoted Web/API/Worker revisions;
2. verify database migration/schema and ledger state;
3. run health/readiness checks;
4. run authentication and critical protected API smoke;
5. run negative RLS/isolation checks using the intended safe qualification method;
6. verify Web critical path;
7. verify Worker/async processing when applicable;
8. inspect logs/metrics for regression signals;
9. finalize NEX-92 with the actually promoted values;
10. record result/evidence in NEX-88 and release notes.

If qualification fails, execute the documented rollback/containment path rather than representing the promotion as successful.

## Source-of-truth contract

- **GitHub:** implementation, migrations, configuration and versioned runbooks.
- **Jira:** delivery status, acceptance criteria, owners, dependencies and production approval work items.
- **Confluence:** canonical roadmap, architecture/governance and durable operational summaries.
- **Runtime platforms:** actual deployed/configured state and operational evidence.

A discrepancy between these sources is itself a governance defect and must be reconciled before a production Go decision.
