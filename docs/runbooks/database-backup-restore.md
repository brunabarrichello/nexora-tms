# Runbook — Database Backup and Restore Baseline

Jira: NEX-22 / NEX-79

This runbook defines the validation required before Nexora TMS is considered production-ready. It does not assume that a provider feature is sufficient merely because it is enabled; recovery must be exercised.

## Objectives

- establish the recovery mechanism available in Neon;
- define RPO/RTO targets before production;
- prove that schema and required data can be recovered;
- ensure restoration does not accidentally overwrite the active production branch;
- retain an auditable record of recovery tests.

## Recovery principles

1. Prefer restoration into an isolated branch/project for verification before replacing or modifying production.
2. Never test destructive recovery directly against the active production branch.
3. Recovery access is restricted to authorized operators.
4. Application credentials are not reused as recovery/admin credentials.
5. Recovery tests must include application-level integrity checks, not only PostgreSQL connectivity.

## Validation procedure

- [ ] Record project, source branch and recovery point.
- [ ] Confirm the intended recovery window is available.
- [ ] Restore or branch from the intended recovery point into isolation.
- [ ] Confirm PostgreSQL starts and the expected database/schema exists.
- [ ] Run migration/schema consistency checks.
- [ ] Verify critical tenant, identity and audit data once those schemas exist.
- [ ] Run negative tenant-isolation checks where applicable.
- [ ] Smoke-test API/Worker connectivity using non-production credentials.
- [ ] Measure elapsed recovery time.
- [ ] Compare recovered state with the expected recovery point.
- [ ] Record evidence, issues and remediation work.
- [ ] Remove disposable recovery resources after evidence is retained.

## Production incident use

Before promoting a recovered branch/state to production use:

- identify incident commander and database owner;
- freeze conflicting migrations/writes when required;
- document data-loss window relative to RPO;
- communicate the cutover plan;
- rotate credentials if compromise is suspected;
- verify health, authorization, tenant isolation and audit after cutover.

## Completion gate

NEX-79 cannot be closed until at least one recovery exercise has been completed and evidence recorded. Documentation alone is not considered restore validation.
