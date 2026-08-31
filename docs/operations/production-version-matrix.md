# Production Version Matrix

Jira: NEX-92 / NEX-89 / NEX-88

This file is the repository-side canonical record of what is actually qualified in Production. Update it for every Production promotion, rollback or component change.

## Rules

- Never infer a Production version from `main` alone.
- Record exact immutable SHAs and deployment identifiers.
- Record a component outside the active topology explicitly as `N/A` with a tracked Jira item.
- Do not mark a Git tag or release as published until it actually exists in GitHub.
- Record schema state with the migration and ledger evidence applicable to the release.
- Record the promotion origin, qualification timestamp and accountable release role.
- Preserve history through Git.

## Current Production record

Qualification date: 31/08/2026.

Formal release publication: 31/08/2026 12:19:11 UTC.

Production Readiness baseline: NEX-88 — Done.

Infrastructure profile: Free-only (Neon Free + Railway Free).

Qualified topology: Web → API → Neon PostgreSQL.

Accountable release role: project owner / release owner; GitHub Actions performed the guarded publication.

### Release identity

- Release: `v0.1.0`.
- Formal Git tag: `v0.1.0` — published.
- GitHub Release: `Nexora TMS v0.1.0` — published, not draft, not prerelease.
- Release/source SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Tag target: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Qualified promotion origin: `release/production-ed52490e`.
- Current repository governance head at finalization time: `cfb98d566bc9fc04fbd4d80ca5e16c27386a7f03`.
- GitHub Release: <https://github.com/brunabarrichello/nexora-tms/releases/tag/v0.1.0>.
- Guarded publication workflow run: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33391156349> — success.

### API

- API application SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Platform: Railway Production.
- Environment: `production`.
- Source branch: `release/production-ed52490e`.
- Deployment: `7d4ab1b0-08de-4892-bd61-32432c3c9a5a`.
- Deployment status: `SUCCESS`.
- Health: `/health` passed.
- No later Railway Production deployment superseded this release during NEX-89/NEX-92 finalization.

### Web

- Qualified Web application-code baseline SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Platform: Vercel Production.
- Current Production deployment: `dpl_9WGZ76RJmzUmYUFP4CdHLLRAAQkf`.
- Current Production deployment Git SHA: `d9ebf45688e42c5041ca146b14988c7d43acfbc0`.
- Current Production deployment status: `READY`.
- Deployment source: `main` before NEX-89 auto-promotion hardening.
- Diff from the qualified release SHA `ed52490e...` to `d9ebf456...`: governance documentation only (`docs/operations/release-flow.md` and `docs/operations/production-version-matrix.md`); no Web or API application-code change.
- Web to API reachability: validated.
- Negative auth perimeter: expected HTTP 401 without a valid session.
- Automatic Vercel Production deployment from `main`: disabled by PR #114; branch/PR Preview deployments remain enabled.
- Verification after PR #114: subsequent branch activity produced only Preview deployments (`target: null`); no later `main` merge created a new Production deployment.

### Authentication and tenant runtime

- Positive runtime gate: `/api/v1/tenant/runtime-gate` returned HTTP 200.
- Gate coverage: OIDC, external identity, TenantContext, API to Neon connectivity and RLS end to end.

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

### CI, release governance and readiness

- Required check: `Build, typecheck and test`.
- Qualified release SHA CI run: `33383138478` — success.
- Release publication run: `33391156349` — success.
- Production Readiness: NEX-88 — Done.
- Release Management: NEX-89 — completion criteria satisfied by the `v0.1.0` publication and this final matrix reconciliation; Jira closure follows this matrix merge.
- Production Version Matrix: NEX-92 — completion criteria satisfied by this final matrix reconciliation; Jira closure follows this matrix merge.
- DR and restore qualification: NEX-79 / NEX-93 — next hardening phase.
- Security / observability / QA hardening: NEX-80 / NEX-81 / NEX-82 / NEX-84 / NEX-85 — next hardening phase.
- Outbox and Durable Jobs: NEX-90 — not part of the current synchronous topology.
- Worker operationalization: NEX-91 — future phase.

### Traceability

- NEX-88 — Production Readiness baseline.
- PR #113 — release governance and initial Version Matrix: <https://github.com/brunabarrichello/nexora-tms/pull/113>.
- PR #114 — disable automatic Vercel Production deployments from `main`: <https://github.com/brunabarrichello/nexora-tms/pull/114>.
- PR #115 — first formal release publication mechanism and release notes: <https://github.com/brunabarrichello/nexora-tms/pull/115>.
- PR #118 — safe missing-tag handling for idempotent release publication: <https://github.com/brunabarrichello/nexora-tms/pull/118>.
- Formal release: <https://github.com/brunabarrichello/nexora-tms/releases/tag/v0.1.0>.
- Release publication workflow: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33391156349>.
- Qualified Production migration: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33383417125>.
- Qualified release CI: <https://github.com/brunabarrichello/nexora-tms/actions/runs/33383138478>.

### Checkpoint lifecycle

- Pre-migration checkpoint: `production-pre-migration-33382150510`.
- State: removed after qualification.
- Cleanup run: `33387614557`.
- Post-delete absence verification: passed.

## Current qualification decision

`GO — Production baseline qualified and formally released as v0.1.0`

This is the technical and release-governance baseline of the current synchronous Web → API → Neon topology. It is not a claim that future asynchronous components, full DR exercises or later hardening items are already complete.

## Accepted Free-tier residual risks

- Neon history and restore window is limited to the Free plan capability.
- Neon branch protection and private or IP-restricted networking are not available in the adopted Free profile.
- Railway static outbound IP is not part of the Free profile.
- Public database endpoint exposure is compensated by TLS verification, secret handling, least-privilege roles, migration gates, audit, RLS and tenant isolation.

These are accepted project policy constraints, not evidence that paid-plan controls exist.

## Promotion history

### 31/08/2026 — Production database qualification

- SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Evidence: Neon run `33383417125`, ledger 25/25, audit, RLS and isolation passed.

### 31/08/2026 — API Production exact-SHA cutover

- SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Evidence: Railway deployment `7d4ab1b0-08de-4892-bd61-32432c3c9a5a`.

### 31/08/2026 — Web Production application baseline qualification

- Qualified application-code SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Initial evidence: Vercel deployment `dpl_GoNhAWJJfpSNspqGayjJBKbgjXmt` — READY.

### 31/08/2026 — Governance-only Vercel metadata divergence

- Current Vercel Production Git SHA: `d9ebf45688e42c5041ca146b14988c7d43acfbc0`.
- Current Vercel Production deployment: `dpl_9WGZ76RJmzUmYUFP4CdHLLRAAQkf` — READY.
- Application-code delta from release SHA: none; compare contained only release-governance documentation.
- Corrective action: PR #114 disabled Git-triggered Production deployments from `main` while preserving Preview deployments.
- Post-hardening result: no subsequent `main` merge created a Vercel Production deployment.

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

## Required update on every future Production change

Before approval:

1. Assign the release version or candidate.
2. Record the exact source SHA.
3. Populate component SHAs and deployments.
4. Record schema, migration and ledger state.
5. Record applicable health, auth, RLS, tenant and security gates.
6. Define rollback target and readiness.
7. Record promotion origin, timestamp and accountable release role.
8. Obtain explicit approval.

After promotion:

1. Replace candidate values with actual deployed identifiers.
2. Verify runtime commit hashes independently of source-branch assumptions.
3. Rerun post-promotion qualification.
4. Record timestamp, result and evidence links.
5. Verify Vercel and Railway did not auto-promote unintended commits.
6. Preserve the prior record in Git history.
