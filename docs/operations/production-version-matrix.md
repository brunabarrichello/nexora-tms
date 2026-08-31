# Production Version Matrix

Jira: NEX-92 / NEX-89 / NEX-88

This file is the repository-side canonical record of what is actually qualified in Production. Update it for every Production promotion, rollback or component change.

## Rules

- Never infer a Production version from `main` alone.
- Record exact immutable SHAs and deployment identifiers.
- Record a component outside the active topology explicitly as `N/A` with a tracked Jira item.
- Do not mark a Git tag or release as published until it actually exists in GitHub.
- Record schema state with the migration and ledger evidence applicable to the release.
- Preserve history through Git.

## Current Production record

Qualification date: 31/08/2026.

Production Readiness baseline: NEX-88 — Done.

Infrastructure profile: Free-only (Neon Free + Railway Free).

### Release identity

- Release target: `v0.1.0`.
- Formal Git tag: `PENDING`.
- Tag status: not published yet; tracked by NEX-89.
- Release/source SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Release source branch: `release/production-ed52490e`.

### API

- API SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Platform: Railway Production.
- Environment: `production`.
- Deployment: `7d4ab1b0-08de-4892-bd61-32432c3c9a5a`.
- Deployment status: `SUCCESS`.
- Health: `/health` passed.

### Web

- Web SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Platform: Vercel Production.
- Deployment: `dpl_GoNhAWJJfpSNspqGayjJBKbgjXmt`.
- Deployment status: `READY`.
- Web to API reachability: validated.
- Negative auth perimeter: expected HTTP 401 without a valid session.

### Authentication and tenant runtime

- Positive runtime gate: `/api/v1/tenant/runtime-gate` returned HTTP 200.
- Gate coverage: OIDC, external identity, TenantContext, API to Neon connectivity and RLS end to end.

### Worker

- Worker SHA: `N/A`.
- Worker deployment: `N/A`.
- Reason: Worker is not part of the qualified synchronous topology.
- Tracking item: NEX-91.

### Database

- Neon project: `nexora-tms` / `raspy-river-76339604`.
- Neon Production branch: `br-silent-feather-a5ku7uyi`.
- Branch role: canonical root/default `production`.
- Database: `neondb`.
- Runtime DB role: `nexora_app`.
- Migration role: `nexora_migrator`.
- TLS: `sslmode=verify-full`.
- Transport qualification: TLSv1.2/TLSv1.3 validated.
- Drizzle ledger: `25/25`.
- Audit and immutability: passed.
- RLS and tenant isolation: passed.
- Migration workflow: `Neon Production Migrate`.
- Migration qualification run: `33383417125` — success.

### CI and readiness

- Production release CI: `Build, typecheck and test`.
- Release SHA CI run: `33383138478` — success.
- Production Readiness: NEX-88 — Done.
- Release governance: NEX-89 — Active.
- Version Matrix governance: NEX-92 — Active.
- DR and restore qualification: NEX-79 / NEX-93 — future hardening phase.
- Outbox and Durable Jobs: NEX-90 — not part of the current synchronous topology.
- Worker operationalization: NEX-91 — future phase.

### Checkpoint lifecycle

- Pre-migration checkpoint: `production-pre-migration-33382150510`.
- State: removed after qualification.
- Cleanup run: `33387614557`.
- Post-delete absence verification: passed.

## Current qualification decision

`GO — Production baseline qualified`

This is a technical baseline qualification of the current synchronous Web → API → Neon topology. It is not a claim that future asynchronous components, full DR exercises or later hardening items are already complete.

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

### 31/08/2026 — Web Production verification

- SHA: `ed52490e1872d645ae06ab402fe646a497333b7b`.
- Result: passed.
- Evidence: Vercel deployment `dpl_GoNhAWJJfpSNspqGayjJBKbgjXmt` — READY.

### 31/08/2026 — Auth, Tenant and RLS runtime qualification

- SHA: same qualified release SHA.
- Result: passed.
- Evidence: `/api/v1/tenant/runtime-gate` returned HTTP 200.

### 31/08/2026 — Pre-migration checkpoint cleanup

- Result: passed.
- Evidence: cleanup run `33387614557`; absence verified.

## Required update on every future Production change

Before approval:

1. Assign the release version or candidate.
2. Record the exact source SHA.
3. Populate component SHAs and deployments.
4. Record schema, migration and ledger state.
5. Record applicable health, auth, RLS, tenant and security gates.
6. Define rollback target and readiness.
7. Obtain explicit approval.

After promotion:

1. Replace candidate values with actual deployed identifiers.
2. Verify runtime commit hashes.
3. Rerun post-promotion qualification.
4. Record timestamp, result and evidence.
5. Preserve the prior record in Git history.
