# Nexora TMS — Canonical Neon Production Topology

Jira: NEX-88 / NEX-93

## Decision

The canonical Neon Production database is the project's **root and default branch named `production`**.

The project will operate using **Free-tier provider plans only** unless this architecture decision is explicitly changed later. Production therefore uses compensating controls rather than paid Neon branch protection/IP Allow and Railway static outbound IPs.

## Canonical topology

```text
production  [root, default, Free-tier constrained]
├─ staging
├─ development
├─ production-pre-migration-<run-id>  [retained rollback checkpoint when present]
└─ temporary preview/test branches as capacity permits
```

Current canonical Production branch ID: `br-silent-feather-a5ku7uyi`.

The bootstrap-created child is preserved as `production-bootstrap-legacy-33356656275` until a deliberate cleanup decision is recorded.

## Free-tier constraints accepted

The active Neon Free plan provides a short Instant Restore/history window and a 10-branch project limit. It does not provide the paid Production controls previously targeted by this project, such as platform-enforced protected branches and IP Allow/private networking.

Railway Free also does not provide Static Outbound IPs. Therefore the application reaches Neon through its public endpoint.

These limitations are **known residual risks**, not equivalent controls. They are accepted for the current Nexora development/early-production profile because the project owner explicitly chose Free-tier-only infrastructure.

The architecture must not describe this posture as equivalent to Scale/Pro or as a fully hardened mission-critical Production environment.

## Compensating controls

The Free-tier Production profile requires all of the following:

- Neon `production` remains the root/default source of truth;
- GitHub `main` remains protected by the repository ruleset and required CI;
- Production-changing workflows use the GitHub `production` environment and explicit manual confirmations;
- release migrations are pinned to an exact 40-character SHA contained in Git `main` history;
- database sessions used by qualification/migration must prove TLS is active;
- `nexora_owner`, `nexora_migrator`, `nexora_app` and `nexora_worker` retain minimum-privilege posture;
- `nexora_app` and `nexora_worker` must never receive owner/superuser/BYPASSRLS privileges;
- RLS and tenant-isolation smoke tests remain mandatory after Production migrations;
- migration ledger count must match the versioned Drizzle journal;
- one Neon branch slot must be available before a Production migration;
- immediately before schema migration, the workflow creates and retains `production-pre-migration-<run-id>` from canonical Production;
- the checkpoint remains until database + Railway/API Production qualification succeeds;
- old checkpoints and stale PR branches are removed deliberately so the project remains below the 10-branch Free limit;
- Railway Production must use the `nexora_app` runtime credential, never owner/migrator credentials;
- Production credentials remain in provider/GitHub secret stores and are never committed to the repository.

## Free baseline workflow

`.github/workflows/neon-production-free-baseline.yml` is the manual, read-only qualification gate.

It requires exact confirmation:

`QUALIFY-PRODUCTION-FREE`

It validates:

1. canonical `production` exists;
2. `production` is root and default;
3. the observed history window is at least the Free-tier baseline currently expected by the repository;
4. branch usage does not exceed the Free project limit;
5. admin and runtime sessions use TLS;
6. the four canonical Nexora database roles retain minimum privilege;
7. no migrations, Railway variable changes, or API deployments are performed.

Its summary intentionally reports whether branch protection, public blocking and IP allowlist controls are present instead of falsely requiring paid capabilities.

## Production migration workflow

`.github/workflows/neon-production-migrate.yml` is the only approved repository path for Production schema promotion.

It requires:

- `MIGRATE-PRODUCTION`;
- `ACCEPT-FREE-TIER-RISKS`;
- exact `release_sha` contained in Git `main` history;
- canonical root/default Production;
- at least the expected Free-tier restore/history window;
- one free Neon branch slot for the rollback checkpoint;
- TLS and canonical role posture.

Before applying any versioned schema migration, the workflow creates a retained checkpoint branch from Production. It then applies the pinned Drizzle migration chain and validates:

- migration ledger;
- Wave 0024 audit schema and immutability;
- runtime RLS;
- cross-tenant isolation.

The checkpoint is **not** automatically deleted. It is a compensating rollback control for the short Free-tier history horizon and is removed only after release qualification or a later deliberate cleanup.

## Disaster recovery policy under Free tier

Provider restore/history is constrained by the active Free plan. The project therefore uses two complementary mechanisms:

1. Neon Instant Restore/history for incidents inside the provider's current Free window;
2. retained pre-migration checkpoint branches for controlled Production schema releases.

A checkpoint branch is not a substitute for an independent backup and does not protect against total provider/project loss. NEX-93 must explicitly test and document the actual recovery capability and residual gaps.

Engineering targets remain goals for drills, not provider guarantees:

- RTO target: <= 60 minutes;
- RPO target: <= 15 minutes for incidents recoverable inside the available history window;
- migration rollback checkpoint: mandatory before Production DDL;
- configuration RPO: zero unversioned application/infrastructure changes.

## Railway Free Production rule

Railway Production remains separate from database qualification.

After Neon Production migration and RLS/smoke pass:

1. obtain the canonical `nexora_app` Production connection string without exposing it in chat/logs;
2. set Railway Production `DATABASE_URL` only to canonical Neon `production`;
3. deploy the same pinned application release SHA;
4. verify `/health`;
5. verify authentication/environment audience behavior;
6. verify tenant context and database access;
7. verify critical domain APIs and Web-to-API contracts.

Dynamic Railway outbound networking is accepted under the Free profile because Neon IP Allow cannot be used. TLS and database credentials are therefore mandatory controls.

## Promotion sequence

```text
Git feature/PR/main
→ release candidate
→ development qualification
→ staging acceptance
→ Neon Production Free Baseline
→ retained pre-migration checkpoint
→ pinned Production migration
→ ledger + audit + RLS/tenant-isolation smoke
→ Railway Production DATABASE_URL -> canonical nexora_app connection
→ deploy same release SHA
→ /health + auth + tenant + DB + Web↔API qualification
→ retain checkpoint until qualification evidence is complete
```

A successful branch operation, workflow, deployment, or HTTP 200 is not by itself a qualified Production release.

## Future upgrade

Scale/Pro capabilities may be reconsidered later, but they are **not blockers** under the current Free-tier-only architecture decision. Any future paid-plan adoption must be treated as a new architecture/governance change rather than silently reintroduced as a prerequisite.
