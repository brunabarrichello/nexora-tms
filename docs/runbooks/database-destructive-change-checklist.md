# Runbook — Destructive Database Change Checklist

Jira: NEX-22 / NEX-79

Use this checklist before any operation that drops data, removes a column/table/index, performs an incompatible type change, rewrites a large table, tightens a constraint that can reject existing rows, or irreversibly transforms stored data.

## Before implementation

- [ ] Business and technical impact is documented.
- [ ] A non-destructive alternative was considered.
- [ ] Backward/forward compatibility window is defined.
- [ ] Application rollout order is defined.
- [ ] Data preservation/export needs are identified.
- [ ] Recovery path is documented.
- [ ] Required retention/LGPD implications are reviewed.

## Migration design

- [ ] Prefer expand/contract over same-release destructive changes.
- [ ] Separate data backfill from schema tightening when practical.
- [ ] Avoid long blocking operations during production traffic.
- [ ] Index creation/removal strategy considers lock impact.
- [ ] Constraints are introduced/validated in a low-risk sequence.
- [ ] Tenant-scoped changes preserve tenant keys and isolation guarantees.
- [ ] RLS policies and grants remain valid after the change.

## Validation

- [ ] Migration is tested on an isolated Neon branch.
- [ ] Migration from a clean database succeeds.
- [ ] Migration from a representative prior schema succeeds.
- [ ] Application compatibility is verified before destructive cleanup.
- [ ] Negative cross-tenant tests pass when relevant.
- [ ] Schema diff matches the intended result only.

## Before production

- [ ] Staging has completed the same migration path.
- [ ] Backup/PITR availability is verified.
- [ ] Rollback or forward-fix owner is identified.
- [ ] Monitoring signals and stop conditions are defined.
- [ ] Release window and expected lock/runtime impact are understood.

## After production

- [ ] Health/readiness remain normal.
- [ ] Error rates and database metrics remain within expected bounds.
- [ ] Data integrity checks pass.
- [ ] Audit evidence is retained.
- [ ] Deprecated compatibility code is removed only after the agreed window.

A destructive change is not complete merely because the SQL succeeded; it is complete when application compatibility, data integrity and recovery expectations have been verified.
