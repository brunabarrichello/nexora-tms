# Nexora TMS — Canonical Neon Production Topology

Jira: NEX-88 / NEX-93

## Decision

The canonical Neon Production database is the project's **root and default branch named `production`**.

This aligns the Nexora topology with Neon's production guidance and ensures Production can be protected, used as the source of truth for downstream environments, and participate correctly in snapshot/restore workflows.

## Required topology

```text
production  [root, default, protected]
├─ staging / sanitized staging strategy
├─ development / lower-environment strategy
└─ temporary preview/test branches as applicable
```

Lower environments must never be substituted for Production.

## Normalization status

The one-time topology normalization is complete.

Current canonical state:

- `production` is the root/default branch;
- canonical branch ID: `br-silent-feather-a5ku7uyi`;
- the bootstrap-created child was preserved as `production-bootstrap-legacy-33356656275`;
- the preserved legacy child had no recorded writes at normalization;
- `development` and `staging` remain children of the same canonical Production root;
- no Production migrations, Railway database-variable changes, or API promotion were part of normalization.

The historical workflow `.github/workflows/neon-production-topology.yml` remains manual-only and exists as an audited record of the normalization mechanism. It must not be used as a substitute for the current hardening and migration gates.

## Pre-migration platform gates

The Production migration workflow must refuse to run unless all conditions are objectively true:

- canonical branch name is `production`;
- branch is root (`parent_id` absent);
- branch is default;
- branch is protected;
- history window is at least 7 days;
- an explicit IP Allow perimeter exists;
- IP Allow is scoped to protected branches only;
- the release SHA is an exact commit contained in Git `main` history.

## Plan policy

Neon Free is not approved for Nexora Production. The target Production posture is:

- **Neon Scale** for protected branches, a 30-day Instant Restore target, IP Allow/private networking capabilities, and production-oriented platform controls;
- **Railway Pro** when Railway Static Outbound IP is used as the application egress control feeding the Neon IP allowlist.

The baseline remains:

- history/PITR window: minimum 7 days;
- preferred Production target: 30 days;
- engineering RPO target: <= 15 minutes;
- engineering RTO target: <= 60 minutes;
- NEX-93 must execute and evidence a real restore qualification before final Go-Live.

## Production hardening workflow

`.github/workflows/neon-production-hardening.yml` is the protected, manual post-upgrade gate.

It requires:

- GitHub environment `production`;
- exact confirmation `HARDEN-PRODUCTION`;
- one or more Railway Production Static Outbound IPv4 addresses;
- each permanent egress entry must be an individual IPv4 address or `/32` CIDR.

It then:

1. verifies canonical `production` is root/default;
2. sets the Production restore target to 30 days;
3. configures the supplied Railway static egress addresses as the permanent Neon allowlist;
4. scopes IP Allow to protected branches only, leaving lower unprotected branches available for their separate CI strategy;
5. marks canonical `production` as protected;
6. re-reads and verifies retention, topology, branch protection, and the exact permanent allowlist;
7. applies no database migration;
8. changes no Railway `DATABASE_URL`;
9. deploys no API.

The workflow is intentionally safe to keep versioned before the billing upgrade: execution will not qualify until the target Neon capabilities are actually available.

## Migration access through the protected perimeter

The permanent Production allowlist is intended to contain Railway Production Static Outbound IPv4 `/32` entries. Broad GitHub Actions address ranges are not approved.

`Neon Production Migrate` runs from a GitHub-hosted runner, so the migration workflow uses a narrowly scoped temporary exception:

1. verify Production is root/default/protected and the permanent perimeter already exists;
2. determine the current runner's public IPv4;
3. add only that single IPv4 as a temporary `/32` through the Neon management API when it is not already present;
4. perform the pinned migration, migration-ledger check, audit invariants, and runtime RLS/tenant-isolation checks;
5. in an `always()` cleanup step, re-read the current allowlist and remove only the temporary runner `/32` that this run added;
6. preserve all permanent Railway entries and `protected_branches_only=true`.

If a workflow is externally force-cancelled before cleanup can execute, rerun `Neon Production Hardening` with the approved Railway static IP set before any subsequent Production operation. That workflow reconciles the permanent allowlist exactly.

This design keeps the application perimeter stable while allowing a short, auditable migration window without broad network exposure.

## Production promotion sequence

The exact Phase 1 order is:

```text
Git feature/PR/main
→ release candidate
→ development qualification
→ staging acceptance
→ Neon Scale available
→ Railway Pro Static Outbound IP allocated (no DB cutover yet)
→ Neon Production Hardening
→ verify 30-day history + root/default/protected + permanent IP Allow
→ protected Neon Production Migrate with pinned release SHA
→ migration ledger + audit invariants + RLS/tenant-isolation smoke
→ obtain canonical Production runtime connection for nexora_app
→ configure Railway Production DATABASE_URL
→ deploy the same pinned application release
→ /health + auth + tenant + DB + Web↔API qualification
```

Allocating Railway static egress is a network prerequisite only; it does **not** authorize pointing the application at Production before database qualification succeeds.

## Promotion rule

Database topology, database qualification, and application promotion are separate gates. A successful branch operation, deploy event, or HTTP 200 is not by itself a qualified Production release.
