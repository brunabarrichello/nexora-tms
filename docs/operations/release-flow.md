# Runbook — Release Management, Promotion and Rollback

Jira: NEX-89 / NEX-92 / NEX-88 / NEX-93

## Status

Production Readiness baseline (NEX-88) is **Done**. The current synchronous Production release is qualified on immutable SHA:

`ed52490e1872d645ae06ab402fe646a497333b7b`

NEX-89 and NEX-92 are the active P0 governance phase.

## Versioning policy

Nexora TMS uses Semantic Versioning for named releases:

`MAJOR.MINOR.PATCH`

- MAJOR: incompatible product/platform contract change.
- MINOR: backward-compatible functional capability.
- PATCH: backward-compatible correction, hardening or operational fix.

The first formal release target is `v0.1.0`.

A version name is not sufficient to identify a release. Production always requires an exact immutable Git SHA and a populated Production Version Matrix.

## Canonical release identity

Every Production candidate must record:

- release/tag or approved immutable release identifier;
- exact Git source SHA;
- Web SHA;
- API SHA;
- Worker SHA or explicit `N/A` with tracked reason;
- migration/schema version and Drizzle ledger state;
- source environment/promotion path;
- release owner/operator role;
- linked Jira items, PRs, workflow runs and deployments;
- rollback target and recovery strategy.

The canonical matrix is `docs/operations/production-version-matrix.md` and Jira NEX-92.

## Standard promotion flow

```text
feature
→ pull request
→ main
→ release candidate
→ development qualification
→ staging qualification
→ acceptance gates
→ Production Version Matrix
→ explicit production approval
→ production promotion
→ post-promotion qualification
```

The current `v0.1.0` baseline predates the final form of this canonical flow, so its matrix records the actual path used. Future releases must follow the canonical flow unless an emergency exception is documented.

## Required gates before production promotion

Stop promotion unless all applicable gates are green:

1. required CI executed successfully;
2. release SHA is immutable and unambiguous;
3. Version Matrix is populated for the candidate;
4. migrations are versioned and ledger expectations are known;
5. database migration/audit/RLS/tenant-isolation gates are green when schema changes apply;
6. API health/readiness is green;
7. authentication and tenant runtime gates are green for auth-sensitive changes;
8. Web/API compatibility smoke is green;
9. security findings proportional to the release risk are resolved or explicitly accepted;
10. rollback/forward-fix strategy is documented;
11. required DR evidence is current for destructive/high-risk database changes;
12. production approval is explicit.

NEX-88 is not reopened for every release. Its completed baseline is a prerequisite. Release-specific Go/No-Go evidence lives with NEX-89/NEX-92 and the release record.

## Promotion mechanics

Production must deploy the exact approved source revision. Do not infer release identity from a redeploy action alone.

For Railway, a redeploy may reuse an old source snapshot. Therefore verify the actual deployment `commitHash` and source branch after every production promotion.

For Vercel, verify the deployment metadata contains the expected Git SHA and target `production`.

For Neon migrations, use the protected production migration workflow and require an exact release SHA plus the approved Free-tier risk acknowledgement while the Free-only policy remains active.

## Rollback policy

Application rollback and database recovery are separate decisions.

### Application rollback

1. identify the last known-good qualified SHA from the Version Matrix/history;
2. deploy that exact immutable revision;
3. verify the runtime deployment reports the expected commit hash;
4. rerun health, auth, tenant isolation and critical Web/API smoke;
5. update Jira/Version Matrix with the rollback event.

Do not treat an unverified platform "redeploy" as rollback evidence.

### Database recovery

Prefer forward-fix and expand/contract migrations. Do not automatically execute destructive down migrations.

For high-risk DDL:

- create an identifiable pre-change checkpoint/restore point when the platform capability allows;
- preserve migration ledger evidence;
- define forward-fix and recovery paths before change execution;
- use Neon Free history/restore within its available window when applicable;
- follow `docs/operations/disaster-recovery.md` and NEX-79/NEX-93 for formal DR qualification.

## Roles and approvals

Use operational roles rather than hard-coded personal names in the runbook:

- Release owner: assignee/operator responsible for the release record.
- Database owner: operator with authorized Neon administrative access.
- API owner: operator authorized for Railway Production.
- Web owner: operator authorized for Vercel Production.
- Approval owner: Jira/release owner responsible for the explicit Go decision.

The same person may hold multiple roles in the current project, but responsibilities remain logically separate.

## Release notes

Every formal release records:

- version and exact SHA;
- user-visible and platform changes;
- migrations/schema impact;
- known risks/accepted limitations;
- linked Jira items and PRs;
- deployment evidence;
- qualification results;
- rollback target;
- follow-up items.

## Hotfix / emergency release

Emergency changes still require traceability.

1. create or identify the incident/issue;
2. isolate the smallest safe fix;
3. run required CI and risk-proportional tests;
4. record the exact SHA;
5. populate/update the Version Matrix;
6. obtain explicit production approval;
7. deploy only the approved SHA;
8. run post-deploy health/auth/tenant/smoke gates;
9. document any bypassed normal gate and restore it after stabilization.

Emergency status never authorizes bypassing tenant isolation, secret handling or release identity requirements.

## Current qualified Production baseline — 31/08/2026

- Release target: `v0.1.0`.
- Formal Git tag: **pending publication** under NEX-89.
- Qualified immutable SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- API Production: Railway deployment `7d4ab1b0-08de-4892-bd61-32432c3c9a5a`, SUCCESS.
- Web Production: Vercel deployment `dpl_GoNhAWJJfpSNspqGayjJBKbgjXmt`, READY.
- Worker: not deployed; explicitly outside the synchronous baseline and tracked by NEX-91.
- Database: Neon canonical `production` branch `br-silent-feather-a5ku7uyi`.
- Schema: Drizzle ledger `25/25`.
- Production Readiness baseline: NEX-88 Done.
- Infrastructure policy: Neon Free + Railway Free with documented residual risks and compensating controls.

See `docs/operations/production-version-matrix.md` for the canonical matrix record.
