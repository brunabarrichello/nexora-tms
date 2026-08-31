# Nexora TMS — Disaster Recovery and Failover Runbook

Jira: NEX-79 / NEX-93 / NEX-88

## 1. Objective

Define a repeatable recovery process for severe failures affecting database, API, Web, Worker, DNS, cloud region or privileged infrastructure credentials.

This runbook is a **pre-production gate**. It must not be interpreted as evidence that a recovery capability exists until the corresponding drill has been executed, timed and approved under NEX-93.

NEX-79 covers the initial backup/restore policy and destructive-change checklist. NEX-93 is the formal Restore Qualification item that requires objective restore/DR evidence, measured RTO/RPO and approval before production readiness can be completed.

## 2. Free-tier Production recovery policy

The project owner has selected a **Free-tier-only infrastructure policy** for the current Nexora profile.

Current engineering targets for drills are:

- **RTO target:** 60 minutes for critical API/database recovery;
- **RPO target:** 15 minutes for incidents recoverable inside the provider history window;
- **provider recovery horizon:** the objectively observed Neon Free history/Instant Restore window, currently expected to be at least 6 hours;
- **migration rollback control:** a retained Neon checkpoint branch must be created from canonical Production immediately before every Production schema migration;
- **configuration RPO:** zero unversioned infrastructure/application configuration changes;
- **credential containment:** begin revocation/rotation within 15 minutes of confirmed compromise.

These are engineering targets and controls, not provider guarantees.

The Free profile deliberately accepts these residual limitations:

- short provider restore/history horizon;
- no paid Neon branch protection;
- no Neon IP Allow/private networking;
- no Railway Static Outbound IP;
- public database endpoint protected by TLS and credentials rather than a provider network allowlist;
- a retained Neon checkpoint is not an independent off-provider backup and cannot protect against total provider/project loss.

NEX-93 must record the values actually demonstrated by the restore qualification exercise and any remaining risk exception.

## 3. Recovery principles

1. Preserve evidence before destructive remediation when security is involved.
2. Contain writes if corruption could spread.
3. Prefer provider-supported point-in-time recovery/branch restore over ad-hoc data repair.
4. Restore into an isolated target first when practical.
5. Validate schema/migration ledger before reopening writes.
6. Validate tenant RLS and authentication after every database restore.
7. Never use a deploy returning HTTP 200 as the only recovery criterion.
8. Record actual RTO/RPO from every exercise.
9. Validate API, Web and Worker compatibility with the restored schema when those components are part of the qualified release.
10. Link every drill result and remediation gap to NEX-93 or a child/follow-up Jira item.
11. Never run Production DDL without a retained pre-migration checkpoint branch and enough Free-tier branch capacity to create it.
12. Require TLS for Production database sessions and preserve minimum-privilege runtime/migrator roles.

## 4. Required inventory before a drill

Record and verify:

- Production database project/branch and PostgreSQL version;
- actual restore/history retention available on the active Free plan;
- current Neon branch count and the 10-branch Free project limit;
- latest retained `production-pre-migration-*` checkpoint, when applicable;
- whether provider-level branch/network protection exists or is unavailable under the current plan;
- API, Web and Worker deployment regions/providers;
- DNS provider and TTLs;
- secret stores and emergency credential owners;
- GitHub default-branch protection and Production workflow controls;
- latest successful migration ledger;
- Production Version Matrix candidate/current state from NEX-92;
- monitoring/alert routes and incident contacts;
- rollback targets for application components.

Do not assume a read replica, cross-region database replica, automatic failover, independent backup, protected database branch, IP allowlist or a backup retention period unless it is objectively verified in the active provider configuration.

## 5. Disaster scenarios

### Total database outage

Containment: stop or limit writes and confirm provider incident scope.

Recovery: recover the database service or restore to an approved database target using whatever provider recovery capability is actually available.

Validation: migrations, RLS, tenant isolation, critical CRUD and application compatibility.

A retained branch inside the same Neon project is not considered protection against total Neon project/provider loss.

### Logical data corruption

Containment: freeze affected writes and capture the suspected timestamp/scope.

Recovery: use Neon Instant Restore/history if the corruption point is within the current Free window. For corruption introduced by the latest controlled Production schema release, the retained pre-migration checkpoint is an additional recovery source.

Validation: row counts, invariants, tenant ownership, audit trail and application smoke.

### Failed Production migration

Containment: stop application promotion and do not repoint Railway Production.

Recovery options, in order of suitability:

1. forward-fix when the failed migration is safely repairable;
2. use the retained `production-pre-migration-<run-id>` branch as the known pre-DDL state for validation/recovery planning;
3. use provider Instant Restore/history while the required point remains in the Free recovery horizon.

Never silently run reverse DDL against Production without a reviewed rollback plan.

### Cloud-region outage

Containment: declare a regional incident and prevent uncontrolled retries or conflicting writes.

Recovery: activate a documented alternate deployment/region only when one actually exists. Under the current Free profile, no cross-region Neon failover capability should be claimed unless it has been independently provisioned and tested.

Validation: health, dependencies, latency, DNS, authentication, database connectivity and Worker processing when applicable.

### API outage

Containment: stop a bad rollout when correlated with the incident.

Recovery: roll back to the last known-good artifact or redeploy a known-good commit.

Validation: `/health`, authentication, tenant gate and critical APIs.

### Web outage

Containment: stop the faulty Web rollout or traffic shift.

Recovery: rollback or redeploy the known-good Web build.

Validation: login flow, navigation and Web-to-API connectivity.

### Worker / asynchronous processing outage

Containment: stop unsafe consumers when duplicate processing, poison jobs or schema incompatibility is suspected.

Recovery: restore the known-good Worker revision, validate database compatibility and resume processing in a controlled manner.

Validation: health/observability, Outbox/Durable Jobs state, idempotency, retry/dead-letter behavior and absence of cross-tenant processing.

This scenario becomes a required executable drill once NEX-90 and NEX-91 are implemented.

### DNS loss or misconfiguration

Containment: preserve current records and restrict edits.

Recovery: restore versioned/known-good records or activate documented provider failover.

Validation: independent DNS resolution, TLS and endpoint reachability.

### Privileged credential compromise

Containment: revoke or disable the credential and freeze risky automation.

Recovery: rotate secrets/tokens/keys, audit usage and redeploy consumers as required.

Validation: old credential rejected, new credential works and usage audit reviewed.

## 6. Database restore qualification drill — NEX-93

Minimum qualification sequence:

1. Record the active Neon plan, current history window, branch count and canonical Production branch ID.
2. Select a known timestamp inside the available Free history window and record the expected recovery point.
3. Record the release/version candidate being qualified through NEX-92.
4. Create an isolated recovery target using provider-supported restore/PITR capability when available.
5. For a controlled migration scenario, also identify the retained `production-pre-migration-*` checkpoint and prove it represents the pre-migration state.
6. Keep original Production untouched during validation.
7. Verify PostgreSQL version and database identity.
8. Compare the Drizzle migration ledger with the exact repository/release revision being qualified.
9. Run schema baseline and grant checks.
10. Connect with the real runtime role, not an owner/superuser.
11. Prove the database session uses TLS.
12. Validate tenant A cannot read/write tenant B data.
13. Run critical domain read/write smoke tests appropriate to the restored wave/release.
14. Validate API compatibility against the restored target.
15. Validate Worker compatibility and asynchronous state when NEX-90/NEX-91 are part of the release.
16. Record restore start/end, recovered timestamp and measured RTO/RPO.
17. Capture objective evidence without storing secrets or raw credentials.
18. Create Jira follow-up items for every failed criterion or risk exception.
19. Destroy temporary recovery targets only after evidence is captured and approved; retained Production migration checkpoints follow the explicit checkpoint cleanup policy.

## 7. API rollback drill

1. Identify current and previous known-good commit/deployment.
2. Confirm database compatibility with the rollback version.
3. Roll back only the affected environment.
4. Validate health, OIDC audience, identity linkage, tenant selection and one protected API flow.
5. Check logs/metrics for recurring failures.
6. Record measured RTO.

A rollback must not silently roll database migrations backward. Database rollback requires a separate data/schema plan.

## 8. Web and Worker rollback drill

For each component included in the qualified Production topology:

1. identify current and previous known-good immutable revision;
2. verify schema/API compatibility;
3. perform rollback in the controlled environment;
4. verify health/readiness and critical behavior;
5. for Worker, verify idempotency and that no job is duplicated/lost by the restart or rollback path;
6. record measured RTO and evidence.

## 9. DNS/region failover drill

A true failover test is valid only after a secondary runnable target exists. Until then, execute a tabletop exercise and mark regional failover **not verified**.

When an alternate target exists:

1. verify it is built from an approved commit/release;
2. verify secrets and environment-specific OIDC audience;
3. verify database connectivity and tenant isolation;
4. verify Worker/asynchronous processing topology when applicable;
5. shift a controlled portion of traffic or use a test hostname;
6. validate externally;
7. restore the primary routing path;
8. record DNS propagation and total RTO.

## 10. Credential-compromise drill

Test at least one non-production credential per quarter:

1. inventory every consumer;
2. rotate/revoke;
3. prove the old value fails;
4. update consumers through the approved secret store;
5. redeploy/restart only where required;
6. prove the new value succeeds;
7. review logs for use after revocation;
8. document blast radius and elapsed containment time.

Never place the credential value itself in the drill report.

## 11. Required evidence package

NEX-93 is only complete when the evidence package records at minimum:

- drill date/time and responsible operator;
- active Free-tier provider constraints at drill time;
- source release/version matrix context;
- backup/PITR/checkpoint source and recovered point;
- measured RTO and RPO;
- migration/schema/ledger validation;
- grants, TLS and RLS validation;
- negative cross-tenant isolation result;
- API/Web/Worker smoke results as applicable;
- failover/failback or explicit unavailable status;
- monitoring/observability evidence;
- rollback targets and results;
- findings, severity, owners and Jira links;
- explicit qualification result: pass, conditional pass or fail.

## 12. Exit criteria

A DR capability is considered verified only when:

- the drill has objective timestamps/evidence;
- recovery stayed inside the approved engineering target or a remediation/risk-acceptance item exists;
- runtime-role access, TLS and RLS isolation passed;
- authentication/environment audience passed;
- migration/schema compatibility passed;
- the retained pre-migration checkpoint mechanism was demonstrated for a migration scenario;
- monitoring detected or confirmed recovery;
- rollback/failback path was exercised or explicitly documented as unavailable;
- findings have owners and priority;
- NEX-93 has an explicit approval outcome;
- NEX-88 references the current Restore Qualification result before a Production Go decision.

## 13. Production readiness blockers under the Free profile

Treat these as blockers until resolved or explicitly risk-accepted through the Production readiness process:

- no verified restore procedure;
- NEX-93 has not produced objective restore evidence;
- current Neon history window is below the documented Free baseline expected by repository gates;
- no free branch slot exists for the mandatory pre-migration checkpoint;
- Production DDL is attempted without a retained pre-migration checkpoint;
- TLS cannot be proven for Production database sessions;
- canonical runtime/migrator roles violate minimum-privilege requirements;
- migration ledger and repository journal disagree;
- RLS or negative tenant-isolation checks fail;
- no known-good application deployment rollback;
- no tested secret-revocation procedure;
- claimed regional failover without an actually provisioned alternate target;
- required Worker/Outbox recovery path is unqualified after NEX-90/NEX-91 enter the release topology;
- Production release/version cannot be identified unambiguously through NEX-92.

The following are **known accepted Free-tier limitations and are not blockers by themselves** under the current architecture decision:

- lack of paid Neon branch protection;
- lack of Neon IP Allow/private networking;
- lack of Railway Static Outbound IP;
- provider recovery horizon shorter than a paid-plan retention target.

They must remain visible as residual risks in NEX-88/NEX-93 and must not be described as equivalent to paid security/DR controls.

## 14. Current qualification status — 2026-08-31

The project has adopted the Free-tier Production policy, but formal Restore Qualification required by NEX-93 is still **pending**. Therefore this runbook is the approved procedure baseline, not evidence of a completed Production DR qualification.
