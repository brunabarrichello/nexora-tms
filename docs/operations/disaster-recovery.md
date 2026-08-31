# Nexora TMS — Disaster Recovery and Failover Runbook

Jira: NEX-79 / NEX-93 / NEX-88

## 1. Objective

Define a repeatable recovery process for severe failures affecting database, API, Web, Worker, DNS, cloud region or privileged infrastructure credentials.

NEX-79 owns the initial backup/restore policy, destructive-change checklist and rollback posture. NEX-93 owns the practical Restore Qualification with objective evidence and measured RTO/RPO.

The current Production profile is intentionally Free-only. This runbook records the controls that compensate for Free-tier limitations; it must not imply that paid backup, protected-branch, private-network or cross-region capabilities exist.

## 2. Free-tier Production recovery policy

Current engineering targets:

- **RTO target:** 60 minutes for critical API/database recovery;
- **RPO target:** 15 minutes for incidents recoverable inside the provider history window;
- **provider recovery horizon:** Neon Free history/Instant Restore, objectively observed at 21,600 seconds (6 hours);
- **migration rollback control:** create an identifiable pre-migration checkpoint before risky Production DDL when branch capacity permits;
- **configuration RPO:** zero unversioned infrastructure/application configuration changes;
- **credential containment:** begin revocation/rotation within 15 minutes of confirmed compromise.

These are engineering targets and controls, not provider guarantees.

Accepted Free-profile residual limitations:

- short provider restore/history horizon;
- no paid Neon branch protection;
- no Neon IP Allow/private networking requirement in the adopted profile;
- no Railway Static Outbound IP;
- public database endpoint protected by TLS verification, credentials, minimum privilege and RLS;
- a Neon branch/checkpoint is not an independent off-provider backup and does not protect against total Neon project/provider loss;
- no cross-region database failover is claimed until an alternate target is actually provisioned and tested.

## 3. Recovery principles

1. Preserve evidence before destructive remediation when security is involved.
2. Contain writes if corruption could spread.
3. Prefer provider-supported point-in-time recovery/branch restore over ad-hoc data repair.
4. Restore into an isolated target before repointing Production.
5. Validate migration ledger and executable schema invariants before reopening writes.
6. Validate minimum-privilege roles, TLS, Audit immutability and tenant RLS after restore.
7. Validate the application against the restored database, not only database connectivity.
8. Never use HTTP 200 alone as a recovery criterion.
9. Record actual RTO/RPO from every exercise.
10. Keep Production untouched during qualification unless the approved incident procedure explicitly requires cutover.
11. Link every failed criterion or residual risk to a tracked Jira item.
12. Destroy temporary recovery targets only after evidence has been captured and exact target identity has been verified.

## 4. Required inventory before a drill

Record and verify:

- Production database project/branch and PostgreSQL version;
- active history/restore retention;
- current Neon branch count and Free project limit;
- retained pre-migration checkpoint when applicable;
- platform protections available or unavailable under the current plan;
- API, Web and Worker deployment providers/regions;
- DNS provider and TTLs;
- secret stores and emergency credential owners;
- GitHub branch protection and Production workflow controls;
- latest successful migration ledger;
- Production Version Matrix state;
- monitoring/log routes and incident contacts;
- known-good rollback targets.

Do not assume a read replica, cross-region replica, automatic failover, independent backup, protected database branch, IP allowlist or retention period unless it is objectively verified in the active provider configuration.

## 5. Destructive migration and expand/contract checklist — NEX-79

Before any destructive or high-risk Production schema change:

1. Confirm the exact release SHA and migration journal expected by the change.
2. Confirm canonical Production branch identity and enough Free-tier branch capacity for the required checkpoint/recovery branch.
3. Create or identify the pre-change recovery point before DDL.
4. Prefer **expand/contract** over an immediate destructive mutation:
   - expand: add backward-compatible structures first;
   - migrate/backfill: move data while old and new application revisions can coexist where practical;
   - switch: promote application reads/writes only after compatibility gates pass;
   - contract: remove obsolete structures only after the rollback window and dependency verification close.
5. Avoid destructive reverse DDL as the default rollback mechanism.
6. For a failed migration, prefer a safe forward-fix when possible; otherwise recover from the retained checkpoint/history point under a reviewed rollback plan.
7. Run ledger, grants, Audit, RLS/tenant-isolation and application smoke gates before promotion.
8. Preserve the checkpoint until the application/runtime qualification is complete.
9. Delete a temporary checkpoint only after explicit lifecycle approval and exact ID/name/parent verification.
10. Record the decision, evidence and responsible operator in Jira/GitHub.

A migration is blocked when the recovery point cannot be created, the ledger is inconsistent, TLS/minimum privilege fails, Audit/RLS fails, or no compatible application rollback target exists.

## 6. Disaster scenarios

### Total database outage

Contain writes and confirm provider incident scope. Recover the service or restore to an approved target using provider capabilities that actually exist. Validate ledger, roles, TLS, RLS, tenant isolation, critical data invariants and application compatibility before cutover.

A branch inside the same Neon project is not protection against complete provider/project loss.

### Logical data corruption

Freeze affected writes and record the suspected timestamp/scope. Use Neon history/PITR if the desired point remains inside the Free window. Validate row-level invariants, tenant ownership, audit history and application behavior on an isolated recovery branch.

### Failed Production migration

Stop promotion. Do not silently reverse Production DDL. Prefer a reviewed forward-fix, the retained pre-change checkpoint or provider history/PITR according to the failure mode.

### Cloud-region outage

Declare a regional incident and prevent conflicting writes. Activate an alternate region only when one is actually provisioned and qualified. Under the current Free profile, cross-region Neon failover remains **not verified / not provisioned**.

### API outage

Roll back or redeploy the last known-good immutable application revision after confirming database compatibility. Validate health, OIDC, TenantContext and protected API behavior.

### Web outage

Roll back or redeploy the known-good Web revision. Validate navigation, login flow and Web-to-API connectivity.

### Worker / asynchronous processing outage

This becomes an executable DR requirement after NEX-90/NEX-91 introduce the asynchronous topology. Then validate idempotency, retry/dead-letter behavior, schema compatibility and cross-tenant isolation before resuming consumers.

### DNS loss or misconfiguration

Preserve the current record set, restrict edits, restore known-good records and validate independent DNS resolution, TLS and endpoint reachability.

### Privileged credential compromise

Revoke/disable the affected credential, freeze risky automation, rotate secret consumers and prove the old credential is rejected and the replacement succeeds. Never place secret values in the evidence package.

## 7. Database restore qualification drill — NEX-93

The repeatable workflow is `.github/workflows/neon-production-restore-qualification.yml`, backed by `scripts/neon/qualify-production-restore.sh`.

Mandatory sequence:

1. Validate the canonical Production branch and Free history/branch capacity.
2. Select a timestamp inside the current history window.
3. Create an isolated historical child branch from canonical Production.
4. Keep canonical Production untouched.
5. Resolve direct database connections with `sslmode=verify-full`.
6. Measure time until the restored database becomes queryable and prove TLSv1.2/TLSv1.3 plus cipher.
7. Compare the restored Drizzle ledger with the repository journal.
8. Validate canonical minimum-privilege roles.
9. Execute Wave 0024 Audit schema and immutability gates.
10. Execute runtime tenant/RLS isolation using `nexora_app`.
11. Attempt provider schema comparison. HTTP 200 with a non-empty diff is a failure. A provider HTTP 413 is recorded as a response-size limitation and does **not** replace the mandatory exact ledger plus executable schema/Audit/RLS gates.
12. Build and start the API against the restored database.
13. Validate `/health/live`, DB-backed `/health/ready`, correlation/security headers and fail-closed HTTP 401 for an unauthenticated protected route.
14. Record recovered timestamp, tested recovery-point lag and database-ready RTO.
15. Delete only the exact temporary restore branch after checking branch ID, name and parent.
16. Verify the branch is absent after cleanup.

## 8. API/Web/Worker rollback drills

For each component that is part of the active qualified topology:

1. identify current and previous known-good immutable revisions;
2. verify database/API/schema compatibility;
3. roll back only the affected environment;
4. validate health/readiness, authentication and critical behavior;
5. inspect logs for recurring failure;
6. record measured RTO and evidence.

Database rollback is a separate data/schema decision and must never be implied by an application rollback.

Worker rollback becomes mandatory when NEX-90/NEX-91 are part of Production.

## 9. DNS/region failover drill

A true failover test is valid only after a secondary runnable target exists. Until then, regional failover remains documented as unavailable rather than falsely qualified.

When an alternate target exists, validate release identity, environment-specific secrets/OIDC, database connectivity, tenant isolation and asynchronous topology before shifting controlled traffic, then validate failback and measured propagation/RTO.

## 10. Credential-compromise drill

For a controlled non-production credential:

1. inventory all consumers;
2. rotate/revoke;
3. prove the old value fails;
4. update the approved secret stores;
5. restart only required consumers;
6. prove the new value succeeds;
7. review post-revocation usage;
8. record blast radius and elapsed containment time.

## 11. Required evidence package

Every qualification must record:

- drill date/time and responsible operator/automation;
- active provider-plan constraints;
- source release/version context;
- backup/PITR/checkpoint source and recovered point;
- measured RTO and tested recovery-point lag/RPO;
- ledger and executable schema validation;
- roles/grants, TLS and RLS result;
- negative tenant-isolation result;
- application smoke result;
- failover/failback result or explicit unavailable/not-applicable status;
- cleanup result;
- findings, severity, owners and Jira links;
- explicit PASS / conditional PASS / FAIL outcome.

## 12. Production Restore Qualification — 31/08/2026

**Result: PASS for the current synchronous Web → API → Neon Free Production topology.**

Authoritative successful exercise:

- workflow: `Neon Production Restore Qualification`;
- run: `33396554407`;
- job: `99502337881`;
- repository governance SHA: `a4f00d95a92860b3434884d98a932c8a2ee1f6ca`;
- canonical source branch: `production` / `br-silent-feather-a5ku7uyi`;
- observed Free history window: **21,600 seconds (6 hours)**;
- branch capacity before drill: **5/10**;
- historical source timestamp: **2026-08-31T13:17:12.000Z**;
- tested recovery-point lag: **300 seconds (5 minutes)**;
- database-ready RTO: **2 seconds**;
- Drizzle ledger: **25/25**;
- minimum-privilege roles: **PASS**;
- TLS verification: **PASS**;
- Wave 0024 Audit schema/immutability: **PASS**;
- runtime tenant RLS/isolation: **PASS**;
- API liveness/readiness: **PASS**;
- correlation/security headers: **PASS**;
- protected-route negative authentication: **HTTP 401 — PASS**;
- temporary restore branch cleanup: **PASS**;
- post-run search for `dr-pitr`: no residual branch found;
- canonical Production was not reset, repointed or deleted.

The preceding run `33395933346` demonstrated the same database restore fundamentals and a 2-second database-ready RTO but stopped before application smoke because Neon `compare_schema` returned HTTP 413. That provider response-size limitation was corrected in PR #122 without weakening ledger, Audit, RLS or API gates.

### Schema-comparison qualification note

Neon `compare_schema` returns HTTP 413 for this schema size. Therefore this exercise does **not** claim byte-for-byte provider diff equality. Restore compatibility is qualified through the exact **25/25 migration ledger**, executable Wave 0024 schema/Audit/immutability checks, runtime RLS isolation and successful API startup/readiness against the restored database.

### RTO/RPO interpretation

The 2-second value is the measured **database-ready RTO inside the controlled Neon PITR exercise**, not a guarantee for a complete business incident involving DNS, users, application cutover or external providers.

The 300-second value is the **tested recovery-point lag** chosen for this exercise. The project engineering RPO target remains 15 minutes for incidents recoverable inside the 6-hour provider history window.

## 13. Current blockers and residual risks

The following remain blockers for future changes when applicable:

- no recoverable point available inside provider history;
- no free branch slot for a required recovery/checkpoint branch;
- migration ledger/repository journal disagreement;
- TLS or minimum-privilege role failure;
- Audit/RLS/tenant-isolation failure;
- application smoke failure against the restored target;
- no known-good rollback target for the changed application;
- unqualified Worker/Outbox recovery after NEX-90/NEX-91 enter Production.

Known accepted Free-tier limitations, not blockers by themselves:

- 6-hour history window rather than paid retention;
- no paid Neon protected branch;
- no Neon private/IP-restricted networking requirement in this adopted profile;
- no Railway static outbound IP;
- no independently provisioned cross-region failover.

## 14. Current qualification status

NEX-79 initial backup/restore and destructive-change baseline is implemented, including the expand/contract and rollback checklist above.

NEX-93 practical Restore Qualification is **PASS** based on run `33396554407`. Future Production changes must re-run an appropriate restore/rollback qualification whenever schema, data topology, provider capabilities or active components materially change.
