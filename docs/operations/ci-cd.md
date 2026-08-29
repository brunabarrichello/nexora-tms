# Nexora TMS — CI/CD Baseline

**Status:** Wave 0 baseline in progress  
**Jira:** NEX-21 / NEX-74 / NEX-75 / NEX-76

## Environments

### Development

Purpose: local development and shared integration using synthetic data.

Target services:

- Neon `development`;
- Vercel Preview for branches/PRs;
- API/Worker locally or Railway development when required.

### Staging

Purpose: homologation, QA, integration testing and pre-production validation.

Target services:

- Neon `staging`;
- Vercel staging;
- Railway staging;
- synthetic or explicitly sanitized data only.

### Production

Purpose: protected real environment.

Target services:

- Neon production baseline;
- Vercel production;
- Railway production;
- environment-exclusive secrets and credentials;
- explicit promotion/release gate for sensitive changes.

## Branching and pull requests

- `main` is the only long-lived Git branch initially;
- work happens on short-lived `feature/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*` branches;
- prefer squash merge;
- require focused, reviewable PRs;
- resolve blocking review threads before merge;
- sensitive areas are covered by CODEOWNERS;
- do not introduce `develop` unless a concrete need is proven.

## Target `main` protection

When repository plan/settings support it, configure:

- pull request required before merge;
- required status checks;
- conversation/thread resolution;
- linear history / squash-oriented merge policy;
- no force push;
- no branch deletion;
- at least one approval for production-sensitive changes when an eligible reviewer exists.

### Current physical constraint

The repository is private and the GitHub API currently reports that repository Rulesets require a higher plan or a public repository. Branch-protection read access is also unavailable to the current integration. Therefore this document records the required target configuration but does not falsely claim those controls are active.

## CI pipeline target

Minimum order:

1. checkout/toolchain setup;
2. dependency install with frozen lockfile;
3. formatting/lint validation;
4. TypeScript typecheck;
5. unit tests;
6. architecture/contract tests;
7. integration tests;
8. build;
9. migration validation against an isolated database branch;
10. dependency vulnerability checks;
11. secret scanning / credential checks;
12. publish test/build evidence.

## Current runner constraint

The NEX-18 bootstrap validation workflow is syntactically accepted by GitHub, but observed runs failed before a runner was allocated (`runner_id = 0`, no steps executed). This is treated as an infrastructure/account execution blocker, not as passing or failing application validation.

No CI check is considered successful until its steps have actually executed.

## CD target flow

```text
PR
  -> Preview
  -> merge main
  -> staging deployment
  -> controlled staging migrations
  -> staging smoke/integration checks
  -> explicit promotion gate
  -> production migration
  -> production deployment
  -> smoke/health verification
  -> release evidence + rollback readiness
```

## Platform responsibilities

- Vercel: `apps/web`, previews and web promotion;
- Railway: `apps/api` and persistent `apps/worker`;
- Neon: PostgreSQL environments/branches and database recovery capabilities;
- GitHub Actions: CI, quality/security gates and release orchestration.

## Secrets and variables

- no real secrets in Git, Issues, PR bodies or documentation;
- separate values by development/staging/production;
- production credentials must not be reused in lower environments;
- database runtime, worker and migration credentials are separate;
- rotate exposed or suspected credentials immediately;
- document variable names and ownership without documenting secret values.

## Completion gate for NEX-21

NEX-21 is complete only when:

- environments are physically configured;
- CI steps execute successfully in the pinned toolchain;
- required merge gates are active where supported;
- staging and production deployment paths are reproducible;
- secrets are separated by environment;
- rollback and release evidence are validated.
