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

## 5. Disaster scenarios

### Total database outage

Containment: stop or limit writes and confirm provider incident scope.

Recovery: recover the database service or restore/fail over to an approved database target.

Validation: migrations, RLS, tenant isolation and critical CRUD.

### Logical data corruption

Containment: freeze affected writes and capture the suspected timestamp/scope.

Recovery: restore an isolated point before corruption, validate it, then perform controlled cutover or repair.

Validation: row counts, invariants, tenant ownership and audit trail.

### Cloud-region outage

Containment: declare a regional incident and prevent uncontrolled retries or conflicting writes.

Recovery: activate the documented alternate deployment/region when one actually exists.

Validation: health, dependencies, latency, DNS and authentication.

### API outage

Containment: stop a bad rollout when correlated with the incident.

Recovery: roll back to the last known-good artifact or redeploy a known-good commit.

Validation: `/health`, authentication, tenant gate and critical APIs.

### Web outage

Containment: stop the faulty Web rollout or traffic shift.

Recovery: rollback or redeploy the known-good Web build.

Validation: login flow, navigation and Web-to-API connectivity.

### DNS loss or misconfiguration

Containment: preserve current records and restrict edits.

Recovery: restore versioned/known-good records or activate documented provider failover.

Validation: independent DNS resolution, TLS and endpoint reachability.

### Privileged credential compromise

Containment: revoke or disable the credential and freeze risky automation.

Recovery: rotate secrets/tokens/keys, audit usage and redeploy consumers as required.

Validation: old credential rejected, new credential works and usage audit reviewed.

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
