# Nexora TMS — Critical Test Matrix

**Jira:** NEX-24 / NEX-84

This matrix defines required high-risk scenarios. It is a specification until executable tests are added to the validated monorepo.

| Area | Critical scenario | Required evidence |
| --- | --- | --- |
| Identity | unauthenticated access to protected resource | request denied without leaking internal detail |
| Identity | invalid/expired session | request denied; session/audit behavior correct |
| Membership | authenticated user without tenant membership | deny |
| RBAC | member without required permission | deny |
| RBAC | member with required permission | allow expected operation only |
| Tenancy | Tenant A requests known Tenant B resource ID | deny/not expose existence beyond contract |
| Tenancy | Tenant A list/search/filter | no Tenant B rows inferred or returned |
| Tenancy | cross-tenant relationship/foreign key | database/application reject invalid association |
| Jobs | tenant-scoped job executed under wrong tenant | reject/fail safely and audit |
| Events | duplicate event delivery | idempotent outcome |
| Events | unsupported event version | safe rejection/dead-letter path |
| API | invalid payload | validation error envelope; no stack/SQL leak |
| API | unexpected application error | safe error envelope + correlation ID |
| Database | migrate clean database from zero | success with expected schema |
| Database | migration against previous supported schema | success or explicit compatibility failure before production |
| Database | destructive change | expand/contract/recovery checklist satisfied |
| RLS | direct runtime-role access outside tenant context | deny where RLS applies |
| Documents | guessed object/document identifier from another tenant | deny signed URL/stream access |
| Secrets | secret-like value committed to test fixture/build | scanning gate fails |
| Health | API/Worker readiness with dependency unavailable | readiness reflects degraded/unready state correctly |
| Web/API | Web cannot be used as authorization authority | forged client state/header cannot grant permission |
| Audit | sensitive allowed/denied action | expected audit record without secrets/sensitive payload excess |

## Priority

The following are release-blocking once their features exist:

1. authentication/authorization bypass;
2. any cross-tenant read/write/inference path;
3. migration reproducibility and data integrity;
4. idempotency for critical financial/integration commands/events;
5. secret exposure;
6. recovery-critical behavior.

## Implementation status

NEX-84 remains incomplete until these scenarios exist as executable automated tests against the implemented IAM/multi-tenant/platform code. This document must not be used as evidence that those tests currently pass.
