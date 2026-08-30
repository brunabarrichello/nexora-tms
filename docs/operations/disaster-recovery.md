# Nexora TMS — Disaster Recovery and Failover Runbook

## 1. Objective

Define a repeatable recovery process for severe failures affecting database, API, Web, DNS, cloud region or privileged infrastructure credentials.

This runbook is a **pre-production gate**. It must not be interpreted as evidence that a recovery capability exists until the corresponding drill has been executed and timed.

## 2. Provisional targets

Until production capacity planning establishes stricter values, use these engineering targets for drills:

- **RTO target:** 60 minutes for critical API/database recovery;
- **RPO target:** 15 minutes for transactional data;
- **configuration RPO:** zero unversioned infrastructure/application configuration changes;
- **credential containment:** begin revocation/rotation within 15 minutes of confirmed compromise.

If the selected infrastructure plan cannot demonstrate these targets, production readiness remains blocked or the targets must be explicitly renegotiated and documented.

## 3. Recovery principles

1. Preserve evidence before destructive remediation when security is involved.
2. Contain writes if corruption could spread.
3. Prefer provider-supported point-in-time recovery/branch restore over ad-hoc data repair.
4. Restore into an isolated target first when practical.
5. Validate schema/migration ledger before reopening writes.
6. Validate tenant RLS and authentication after every database restore.
7. Never use a deploy returning HTTP 200 as the only recovery criterion.
8. Record actual RTO/RPO from every exercise.

## 4. Required inventory before a drill

Record and verify:

- production database project/branch and PostgreSQL version;
- actual restore/history retention available on the subscribed plan;
- protected/critical database branches;
- API and Web deployment regions/providers;
- DNS provider and TTLs;
- secret stores and emergency credential owners;
- GitHub default-branch protection and release workflow;
- latest successful migration ledger;
- monitoring/alert routes and incident contacts.

Do not assume a read replica, cross-region database replica, automatic failover or a backup retention period unless it is objectively verified in the active provider configuration.

## 5. Scenario matrix

| Scenario | Immediate containment | Recovery path | Mandatory validation |
| --- | --- | --- | --- |
| Total database outage | stop/limit writes; confirm provider incident | recover service or restore/fail over to approved database target | migrations, RLS, tenant isolation, critical CRUD |
| Logical data corruption | freeze affected writes; capture timestamp/scope | restore isolated point before corruption, validate, then controlled cutover/repair | row counts, invariants, tenant ownership, audit trail |
| Cloud-region outage | declare regional incident | activate documented alternate deployment/region when available | health, dependencies, latency, DNS, auth |
| API outage | stop bad rollout if correlated | rollback to last known-good artifact or redeploy known-good commit | `/health`, auth, tenant gate, critical APIs |
| Web outage | rollback/redeploy known-good Web build | shift traffic only after smoke validation | login flow, navigation, server/API connectivity |
| DNS loss/misconfiguration | preserve current records; restrict edits | restore versioned/known-good records or provider failover | resolution from independent resolvers, TLS, endpoints |
| Privileged credential compromise | revoke/disable credential, freeze risky automation | rotate secrets/tokens/keys, audit usage, redeploy consumers | old credential rejected, new credential works, audit reviewed |

## 6. Database restore drill

Minimum quarterly pre-production exercise:

1. Select a known timestamp and record expected recovery point.
2. Create an isolated recovery target using provider-supported restore/PITR capability.
3. Keep the original environment untouched during validation.
4. Verify PostgreSQL version and database identity.
5. Compare the Drizzle migration ledger with repository `main`.
6. Run schema baseline checks.
7. Connect with the real runtime role, not an owner/superuser.
8. Validate tenant A cannot read/write tenant B data.
9. Run critical Cadastros/Cargas/Documents read-write smoke tests appropriate to the restored wave.
10. Record restore start/end, recovered timestamp and measured RPO.
11. Destroy the temporary recovery target only after evidence is captured.

## 7. API rollback drill

1. Identify current and previous known-good commit/deployment.
2. Confirm database compatibility with the rollback version.
3. Roll back only the affected environment.
4. Validate health, OIDC audience, identity linkage, tenant selection and one protected API flow.
5. Check logs/metrics for recurring failures.
6. Record measured RTO.

A rollback must not silently roll database migrations backward. Database rollback requires a separate data/schema plan.

## 8. DNS/region failover drill

A true failover test is valid only after a secondary runnable target exists. Until then, execute a tabletop exercise and mark regional failover **not verified**.

When an alternate target exists:

1. verify it is built from an approved commit;
2. verify secrets and environment-specific OIDC audience;
3. verify database connectivity and tenant isolation;
4. shift a controlled portion of traffic or use a test hostname;
5. validate externally;
6. restore the primary routing path;
7. record DNS propagation and total RTO.

## 9. Credential-compromise drill

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

## 10. Exit criteria

A DR capability is considered verified only when:

- the drill has objective timestamps/evidence;
- recovery stayed inside approved RTO/RPO or a remediation item exists;
- runtime-role access and RLS isolation passed;
- authentication/environment audience passed;
- migration/schema compatibility passed;
- monitoring detected or confirmed recovery;
- rollback/failback path was exercised or explicitly documented as unavailable;
- findings have owners and priority.

## 11. Production readiness blockers

Treat these as blockers until resolved or risk-accepted:

- no verified restore procedure;
- retention shorter than the required business RPO window;
- no protection for critical database branches;
- no known-good deployment rollback;
- no independent DNS recovery path;
- no tested secret-revocation procedure;
- claimed regional failover without an actually provisioned alternate target.
