# Production Version Matrix

Jira: NEX-92 / NEX-89 / NEX-88

This file is the repository-side canonical record of what is actually qualified in Production. It must be updated for every Production promotion, rollback or component change.

## Rules

- Never infer a Production version from `main` alone.
- Record exact immutable SHAs and deployment identifiers.
- A component not present in the active topology must be recorded explicitly as `N/A` with a tracked Jira item.
- Do not mark a Git tag/release as published until it actually exists in GitHub.
- Schema state must include the migration/ledger evidence applicable to the release.
- Every change preserves history through Git.

## Current Production record

**Qualification date:** 31/08/2026  
**Production Readiness baseline:** NEX-88 — Done  
**Infrastructure profile:** Free-only (Neon Free + Railway Free)

| Field | Qualified Production value | Status / evidence |
| --- | --- | --- |
| Release target | `v0.1.0` | Target defined; formal Git tag/release pending NEX-89 |
| Formal Git tag | `PENDING` | Must not be represented as published before GitHub tag exists |
| Release/source SHA | `ed52490e1872d645ae06ab402fe646a497333b7b` | Exact SHA qualified by Production migration/runtime gates |
| Release source branch | `release/production-ed52490e` | Railway source binding used for exact-SHA deployment |
| API SHA | `ed52490e1872d645ae06ab402fe646a497333b7b` | Same as qualified release SHA |
| API platform | Railway Production | Environment `production` |
| API deployment | `7d4ab1b0-08de-4892-bd61-32432c3c9a5a` | `SUCCESS` |
| API health | `/health` passed | Railway deployment healthcheck |
| Web SHA | `ed52490e1872d645ae06ab402fe646a497333b7b` | Vercel deployment metadata verified |
| Web platform | Vercel Production | Target `production` |
| Web deployment | `dpl_GoNhAWJJfpSNspqGayjJBKbgjXmt` | `READY` |
| Web→API | validated | Production Web reached Production API; auth perimeter returned expected 401 without valid session |
| Auth positive gate | `/api/v1/tenant/runtime-gate` = HTTP 200 | OIDC + external identity + TenantContext + API→Neon + RLS E2E |
| Worker SHA | `N/A` | Worker is not in the qualified synchronous topology; tracked by NEX-91 |
| Worker deployment | `N/A` | NEX-91 |
| Neon project | `nexora-tms` / `raspy-river-76339604` | Production database project |
| Neon Production branch | `br-silent-feather-a5ku7uyi` | Canonical root/default `production` |
| Database | `neondb` | Runtime role uses canonical Production database |
| Runtime DB role | `nexora_app` | Minimum-privilege runtime role |
| Migration role | `nexora_migrator` | Minimum-privilege migration role |
| TLS | `sslmode=verify-full` | TLSv1.2/TLSv1.3 validated |
| Drizzle ledger | `25/25` | Production migration qualification run `33383417125` |
| Audit / immutability | passed | Wave 0024 Production qualification |
| RLS / tenant isolation | passed | Database and runtime end-to-end gates |
| Migration workflow | `Neon Production Migrate` | Run `33383417125` = success |
| Production release CI | `Build, typecheck and test` | Release SHA CI run `33383138478` = success |
| Checkpoint state | removed after qualification | `production-pre-migration-33382150510` removed after authenticated runtime gates and explicit authorization |
| Jira readiness | NEX-88 | Done — Production baseline qualified |
| Release governance | NEX-89 | Active |
| Version Matrix governance | NEX-92 | Active |
| DR / restore qualification | NEX-79 / NEX-93 | Future hardening phase |
| Outbox / Durable Jobs | NEX-90 | Not part of current synchronous topology |
| Worker operationalization | NEX-91 | Future phase |

## Current qualification decision

`GO — Production baseline qualified`

This is a technical baseline qualification of the current synchronous Web → API → Neon topology. It is not a claim that future asynchronous components, full DR exercises or later hardening items are already complete.

## Accepted Free-tier residual risks

- Neon history/restore window is limited to the Free plan capability.
- Neon branch protection and private/IP-restricted networking are not available in the adopted Free profile.
- Railway static outbound IP is not part of the Free profile.
- Public database endpoint exposure is compensated by TLS verification, secret handling, least-privilege roles, migration gates, audit, RLS and tenant isolation.

These are accepted project policy constraints, not evidence that paid-plan controls exist.

## Promotion history

| Date | Action | Release / SHA | Result | Evidence |
| --- | --- | --- | --- | --- |
| 31/08/2026 | Production database qualification | `ed52490e1872d645ae06ab402fe646a497333b7b` | Passed | Neon run `33383417125`, ledger 25/25, audit/RLS/isolation passed |
| 31/08/2026 | API Production exact-SHA cutover | `ed52490e1872d645ae06ab402fe646a497333b7b` | Passed | Railway deployment `7d4ab1b0-08de-4892-bd61-32432c3c9a5a` |
| 31/08/2026 | Web Production verification | `ed52490e1872d645ae06ab402fe646a497333b7b` | Passed | Vercel deployment `dpl_GoNhAWJJfpSNspqGayjJBKbgjXmt` READY |
| 31/08/2026 | Auth/Tenant/RLS runtime qualification | same SHA | Passed | `/api/v1/tenant/runtime-gate` HTTP 200 |
| 31/08/2026 | Pre-migration checkpoint cleanup | N/A | Passed | Cleanup run `33387614557`; absence verified |

## Required update on every future Production change

Before approval:

1. assign release version/candidate;
2. record exact source SHA;
3. populate component SHAs/deployments;
4. record schema/migration/ledger state;
5. record applicable health/auth/RLS/tenant/security gates;
6. define rollback target/readiness;
7. obtain explicit approval.

After promotion:

1. replace candidate values with actual deployed identifiers;
2. verify runtime commit hashes;
3. rerun post-promotion qualification;
4. record timestamp/result/evidence;
5. preserve the prior record in Git history.
