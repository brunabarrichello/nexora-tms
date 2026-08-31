# Nexora TMS — Canonical Neon Production Topology

Jira: NEX-88 / NEX-93

## Decision

The canonical Neon Production database must be the project's **root and default branch named `production`**.

This aligns the Nexora topology with Neon's production guidance and ensures Production can be protected, used as the source of truth for downstream environments, and participate correctly in snapshot/restore workflows.

## Required topology

```text
production  [root, default, protected]
├─ staging / sanitized staging strategy
├─ development / lower-environment strategy
└─ temporary preview/test branches as applicable
```

Lower environments must never be substituted for Production.

## Current normalization

The first protected bootstrap run created `production` as a child of the original root `main`. That run successfully proved:

- GitHub protected-environment execution;
- branch provisioning through the approved workflow;
- database connectivity;
- existence of `nexora_owner`, `nexora_migrator`, `nexora_app`, and `nexora_worker`;
- minimum-privilege role posture.

Before Production receives migrations or application traffic, the topology must be normalized:

1. preserve the bootstrap-created child under a traceable legacy name;
2. rename the original root/default Neon branch from `main` to `production`;
3. keep that same root branch ID as the default branch;
4. verify that canonical `production` has no parent;
5. delete no data during normalization;
6. leave migrations, Railway, and API deployment unchanged.

The one-time workflow `.github/workflows/neon-production-topology.yml` performs this normalization only with confirmation `NORMALIZE-PRODUCTION-ROOT`.

## Pre-migration platform gates

The Production migration workflow must refuse to run unless all conditions are objectively true:

- canonical branch name is `production`;
- branch is root (`parent_id` absent);
- branch is default;
- branch is protected;
- history window is at least 7 days;
- network perimeter is restricted through IP Allow or private networking;
- the release SHA is an exact commit contained in Git `main` history.

## Plan policy

Neon Free is not approved for Nexora Production. Current plan capabilities imply:

- **Free:** unsuitable for production; 6-hour history, no protected branches;
- **Launch:** supports protected branches and up to 7-day history, but does not provide IP Allow/private networking;
- **Scale:** supports protected branches, up to 30-day history, IP Allow, private networking, longer monitoring retention, metrics/log export and production-oriented support/SLA capabilities.

Because Nexora requires both protected Production and an explicit network perimeter, **Scale is the target Production plan** unless a formally approved alternative architecture provides equivalent network restriction.

## Recovery policy

Baseline before Production migration:

- history/PITR window: minimum 7 days;
- preferred target: 30 days when running on Scale;
- engineering RPO target: <= 15 minutes;
- engineering RTO target: <= 60 minutes;
- NEX-93 must still execute and evidence a real restore qualification before final Go-Live.

## Promotion rule

Database topology and application promotion remain separate gates:

```text
Git feature/PR/main
→ release candidate
→ development qualification
→ staging acceptance
→ protected Production migration
→ Railway Production configuration
→ API release
→ health/auth/tenant/database/Web↔API qualification
```

A successful branch operation or HTTP 200 is not, by itself, a qualified Production release.
