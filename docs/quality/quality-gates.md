# Nexora TMS — Quality Gates

**Jira:** NEX-24 / NEX-85

## Pull request gate

A PR is eligible for merge only when all applicable blocking checks have actually executed and passed.

Target checks:

1. toolchain / lockfile integrity;
2. formatting and lint;
3. TypeScript typecheck;
4. unit tests;
5. architecture tests;
6. contract tests;
7. integration tests;
8. build;
9. migration validation when database artifacts changed;
10. dependency vulnerability checks;
11. secret/credential scanning;
12. required review/thread resolution where the GitHub plan supports enforcement.

A workflow that fails before receiving a runner is **not** a passing or failing application-quality result; it is an infrastructure blocker.

## Change-based requirements

### Domain/business behavior

Requires unit tests and, when crossing boundaries, integration/contract coverage.

### Tenant-scoped behavior

Requires negative cross-tenant tests in addition to normal positive scenarios.

### Authorization/IAM

Requires deny-path tests, role/permission tests and session/membership-state tests.

### Database/migration

Requires isolated migration validation, clean-schema reproducibility and destructive-change review when applicable.

### External API/event contract

Requires contract compatibility/versioning validation.

### Worker/async behavior

Requires idempotency, retry/failure and tenant/correlation-context coverage.

### Security-sensitive code

Requires explicit threat/abuse consideration and applicable security regression tests.

## Merge blockers

Block merge for:

- failed required executable check;
- required check that did not execute;
- unresolved critical/high security defect;
- known cross-tenant data exposure;
- broken authorization deny path;
- migration that cannot be reproduced or safely promoted;
- committed secret/credential;
- build/typecheck failure;
- critical test intentionally removed without replacement/risk decision.

## Severity policy for defects

### Blocker / Critical

Examples: tenant data leak, authentication bypass, destructive data loss, secret exposure, production-unrecoverable migration, critical workflow unavailable.

Rule: blocks merge/release. Immediate issue and remediation/containment required.

### High

Major business/security function wrong with meaningful impact or no safe workaround.

Rule: normally blocks release; exception requires explicit documented risk acceptance.

### Medium

Material defect with bounded impact/workaround.

Rule: may merge only when unrelated to changed critical path and tracked with owner/priority.

### Low

Minor usability/cosmetic/non-critical technical defect.

Rule: can be deferred when tracked appropriately.

## Release gate

Before production promotion:

- staging deploy/migrations succeeded;
- critical smoke tests passed;
- no unresolved Blocker/Critical issue;
- required security/dependency checks executed;
- production config/secrets are present and environment-specific;
- rollback/recovery path is understood;
- release and migration revisions are traceable.

## Emergency changes

Emergency fixes may use an accelerated process but never an untraceable one. Skipped gates must be documented with reason, risk, approver/owner and a follow-up to restore normal validation.

## Evidence rule

Documentation, configuration files and intended checks are not equivalent to execution evidence. A gate is satisfied only when the corresponding validation has actually run against the relevant revision/environment.
