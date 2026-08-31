# Production Version Matrix

Jira: NEX-92 / NEX-89 / NEX-88 / NEX-79 / NEX-93

This file is the repository-side canonical record of what is actually qualified in Production. Update it for every Production promotion, rollback, component change or material Production qualification.

## Rules

- Never infer a Production version from `main` alone.
- Record exact immutable SHAs and deployment identifiers.
- Record a component outside the active topology explicitly as `N/A` with a tracked Jira item.
- Do not mark a Git tag or release as published until it actually exists in GitHub.
- Record schema state with the migration and ledger evidence applicable to the release.
- Record the promotion origin, qualification timestamp and accountable release role.
- Distinguish application runtime SHAs from later governance/hardening repository commits.
- Preserve history through Git.

## Current Production record

Qualification date: 31/08/2026.

Formal release publication: 31/08/2026 12:19:11 UTC.

Restore Qualification: 31/08/2026 13:22 UTC.

Production Readiness baseline: NEX-88 — Done.

Infrastructure profile: Free-only (Neon Free + Railway Free).

Qualified topology: Web → API → Neon PostgreSQL.

Accountable release role: project owner / release owner; GitHub Actions performed guarded publication and qualification workflows.

### Release identity

- Release: `v0.1.0`.
- Formal Git tag: `v0.1.0` — published.
- GitHub Release: `Nexora TMS v0.1.0` — published, not draft, not prerelease.
- Release/source SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Tag target: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Qualified promotion origin: `release/production-ed52490e`.
- Repository governance head at original release finalization: `cfb98d566bc9fc04fbd4d80ca5e16c27386a7f03`.
- Repository governance head used for successful DR qualification: `a4f00d95a92860b3434884d98a932c8a2ee1f6ca`.
- GitHub Release: <https://github.com/brunabarrichello/nexora-tms/releases/tag/v0.1.0>.
- Guarded publication workflow run: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33391156349> — success.

The later repository governance/hardening SHAs do **not** replace the pinned Production application release SHA unless a new Production promotion is explicitly approved and executed.

### API

- API application SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Platform: Railway Production.
- Environment: `production`.
- Source branch: `release/production-ed52490e`.
- Deployment: `7d4ab1b0-08de-4892-bd61-32432c3c9a5a`.
- Deployment status: `SUCCESS`.
- Health: `/health` passed.
- No later Railway Production deployment was introduced by the repository-only DR/hardening reconciliation.

### Web

- Qualified Web application-code baseline SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Platform: Vercel Production.
- Current recorded Production deployment: `dpl_9WGZ76RJmzUmYUFP4CdHLLRAAQkf`.
- Current recorded Production deployment Git SHA: `d9ebf45688e42c5041ca146b14988c7d43acfbc0`.
- Current recorded Production deployment status: `READY`.
- Deployment source: `main` before NEX-89 auto-promotion hardening.
- Diff from the qualified release SHA `ed52490e...` to `d9ebf456...`: governance documentation only; no Web or API application-code change.
- Web-to-API reachability: validated.
- Negative auth perimeter: expected HTTP 401 without a valid session.
- Automatic Vercel Production deployment from `main`: disabled by PR #114; branch/PR Preview deployments remain enabled.
- Free-tier Preview deployment quota exhaustion observed during later PR activity does not change the recorded Production deployment.

### Authentication and tenant runtime

- Positive Production runtime gate: `/api/v1/tenant/runtime-gate` returned HTTP 200.
- Gate coverage: OIDC, external identity, TenantContext, API-to-Neon connectivity and RLS end to end.

### Worker

- Worker SHA: `N/A`.
- Worker deployment: `N/A`.
- Reason: Worker is not part of the qualified synchronous topology.
- Tracking item: NEX-91.

### Database and schema

- Neon project: `nexora-tms` / `raspy-river-76339604`.
- Neon Production branch: `br-silent-feather-a5ku7uyi`.
- Branch role: canonical root/default `production`.
- Database: `neondb`.
- Runtime DB role: `nexora_app`.
- Migration role: `nexora_migrator`.
- TLS: `sslmode=verify-full`.
- Transport qualification: TLSv1.2/TLSv1.3 validated.
- Drizzle migration/schema ledger: `25/25`.
- Audit and immutability: passed.
- RLS and tenant isolation: passed.
- Migration workflow: `Neon Production Migrate`.
- Migration qualification run: `33383417125` — success.
- Migration evidence: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33383417125>.

### Restore / DR qualification

- Jira: NEX-79 / NEX-93.
- Workflow: `Neon Production Restore Qualification`.
- Successful run: `33396554407`.
- Job: `99502337881`.
- Source branch: canonical `production` / `br-silent-feather-a5ku7uyi`.
- Active Free history window observed: **21,600 seconds (6 hours)**.
- Branch capacity before drill: **5/10**.
- Historical source timestamp: **2026-08-31T13:17:12.000Z**.
- Tested recovery-point lag: **300 seconds (5 minutes)**.
- Database-ready RTO: **2 seconds**.
- Restored ledger: **25/25**.
- Minimum-privilege roles: PASS.
- TLS verification: PASS.
- Wave 0024 Audit schema/immutability: PASS.
- Runtime tenant RLS/isolation: PASS.
- API liveness/readiness against restored DB: PASS.
- Correlation/security headers: PASS.
- Protected-route negative auth: HTTP 401 — PASS.
- Temporary restore branch cleanup: PASS.
- Post-run Neon search for `dr-pitr`: no residual branch found.
- Canonical Production was not reset, repointed or deleted.

Neon `compare_schema` returned HTTP 413 because the provider response exceeded the endpoint size limit. The qualification therefore does **not** claim byte-for-byte provider schema-diff equality. Exact migration ledger plus executable schema/Audit/RLS checks and successful API compatibility against the restored DB are the authoritative gates.

The measured 2-second RTO is the database-ready time inside the controlled PITR exercise, not a guarantee for a full business incident involving external providers, DNS or operator cutover. The 300-second value is the exercised restore lag; the engineering RPO target remains 15 minutes inside the 6-hour Free history window.

### CI, release governance and readiness

- Required check: `Build, typecheck and test`.
- Qualified release SHA CI run: `33383138478` — success.
- Release publication run: `33391156349` — success.
- PR #121 required CI: `33395048908` — success.
- PR #121 post-merge CI: `33395933222` — success.
- PR #122 required CI: `33396432314` — success.
- PR #122 post-merge CI: `33396554367` — success.
- Production Readiness: NEX-88 — Done.
- Release Management: NEX-89 — completed through the formal `v0.1.0` publication flow.
- Production Version Matrix: NEX-92 — completed and maintained by this document.
- DR/restore: NEX-79 / NEX-93 — acceptance scope satisfied by the successful controlled PITR exercise; Jira reconciliation follows the documentation merge.
- CI quality gates: NEX-85 — acceptance scope satisfied by active `main-protection` and required CI; Jira reconciliation follows the documentation merge.
- Observability/security/E2E hardening: NEX-80 / NEX-81 / NEX-82 / NEX-84 remain active with tracked executable gaps.
- Outbox and Durable Jobs: NEX-90 — not part of the current synchronous topology.
- Worker operationalization: NEX-91 — future phase.

### Traceability

- NEX-88 — Production Readiness baseline.
- PR #113 — release governance and initial Version Matrix: <https://github.com/brunabarrichello/nexora-tms/pull/113>.
- PR #114 — disable automatic Vercel Production deployments from `main`: <https://github.com/brunabarrichello/nexora-tms/pull/114>.
- PR #115 — formal release publication mechanism and release notes: <https://github.com/brunabarrichello/nexora-tms/pull/115>.
- PR #118 — safe missing-tag handling for idempotent release publication: <https://github.com/brunabarrichello/nexora-tms/pull/118>.
- PR #121 — DR + API operational hardening baseline: <https://github.com/brunabarrichello/nexora-tms/pull/121>.
- PR #122 — bounded handling of Neon `compare_schema` HTTP 413: <https://github.com/brunabarrichello/nexora-tms/pull/122>.
- Formal release: <https://github.com/brunabarrichello/nexora-tms/releases/tag/v0.1.0>.
- Release publication workflow: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33391156349>.
- Qualified Production migration: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33383417125>.
- Qualified Production restore: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33396554407>.
- Qualified release CI: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33383138478>.

### Checkpoint lifecycle

- Pre-migration checkpoint: `production-pre-migration-33382150510`.
- State: removed after end-to-end qualification and explicit authorization.
- Cleanup run: `33387614557`.
- Post-delete absence verification: passed.

## Current qualification decision

`GO — Production baseline qualified and formally released as v0.1.0; controlled Production PITR/restore qualification PASS`

This is the technical, release-governance and restore baseline of the current synchronous Web → API → Neon topology. It is not a claim that future asynchronous components, cross-region failover, centralized metrics/alerts or all later hardening items are already complete.

## Accepted Free-tier residual risks

- Neon history and restore window is limited to the Free plan capability (currently observed at 6 hours).
- Neon branch protection and private/IP-restricted networking are not available/required in the adopted Free profile.
- Railway static outbound IP is not part of the Free profile.
- No independent cross-region database failover is provisioned.
- A Neon in-project PITR branch is not an off-provider backup.
- Public database endpoint exposure is compensated by TLS verification, secret handling, least-privilege roles, migration gates, Audit, RLS and tenant isolation.

These are accepted project policy constraints, not evidence that paid-plan controls exist.

## Promotion and qualification history

### 31/08/2026 — Production database qualification

- SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Evidence: Neon run `33383417125`, ledger 25/25, Audit, RLS and isolation passed.

### 31/08/2026 — API Production exact-SHA cutover

- SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Evidence: Railway deployment `7d4ab1b0-08de-4892-bd61-32432c3c9a5a`.

### 31/08/2026 — Web Production application baseline qualification

- Qualified application-code SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Initial evidence: Vercel deployment `dpl_GoNhAWJJfpSNspqGayjJBKbgjXmt` — READY.

### 31/08/2026 — Governance-only Vercel metadata divergence

- Recorded Vercel Production Git SHA: `d9ebf45688e42c5041ca146b14988c7d43acfbc0`.
- Recorded Vercel Production deployment: `dpl_9WGZ76RJmzUmYUFP4CdHLLRAAQkf` — READY.
- Application-code delta from release SHA: none; compare contained only release-governance documentation.
- Corrective action: PR #114 disabled Git-triggered Production deployments from `main` while preserving Preview deployments.

### 31/08/2026 — Auth, Tenant and RLS runtime qualification

- SHA: same qualified release SHA.
- Result: passed.
- Evidence: `/api/v1/tenant/runtime-gate` returned HTTP 200.

### 31/08/2026 — Pre-migration checkpoint cleanup

- Result: passed.
- Evidence: cleanup run `33387614557`; absence verified.

### 31/08/2026 — Formal `v0.1.0` publication

- Tag: `v0.1.0`.
- Tag target: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Release: `Nexora TMS v0.1.0`.
- Result: passed.
- Evidence: publication run `33391156349`; independent Git ref and GitHub Release verification passed.

### 31/08/2026 — Production Restore Qualification

- Repository qualification SHA: `a4f00d95a92860b3434884d98a932c8a2ee1f6ca`.
- Runtime release SHA remained `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Evidence: restore run `33396554407`, job `99502337881`.
- Recovery point exercised: 5 minutes behind run time.
- Database-ready RTO: 2 seconds.
- Ledger 25/25, roles/TLS/Audit/RLS/API smoke and cleanup passed.

## Required update on every future Production change

Before approval:

1. Assign the release version or candidate.
2. Record the exact source SHA.
3. Populate component SHAs and deployments.
4. Record schema, migration and ledger state.
5. Record applicable health, auth, RLS, tenant, DR and security gates.
6. Define rollback target and readiness.
7. Record promotion origin, timestamp and accountable release role.
8. Obtain explicit approval.

After promotion:

1. Replace candidate values with actual deployed identifiers.
2. Verify runtime commit hashes independently of source-branch assumptions.
3. Rerun post-promotion qualification.
4. Re-run restore/rollback qualification when schema, data topology, provider capabilities or active components materially change.
5. Record timestamp, result and evidence links.
6. Verify Vercel and Railway did not auto-promote unintended commits.
7. Preserve the prior record in Git history.
