# ADR-0016 — RBAC with Contextual Organization and Resource Scopes

- **Status:** Accepted
- **Supersedes:** none
- **Extends:** ADR-0002 and ADR-0005

## Context

Nexora already owns tenant membership, roles, permissions, organization scopes and business-unit scopes. Tenant RLS is the mandatory data boundary, but tenant membership alone is not sufficient business authorization for sensitive operations.

A fully generic ABAC engine would add policy-language complexity, hidden evaluation paths and difficult auditability before the domain requires that level of flexibility.

## Decision

Keep RBAC as the primary authorization model and add explicit contextual attributes only where the business rule requires them.

Authorization is evaluated in this order:

1. trusted OIDC identity;
2. active tenant membership;
3. tenant RLS boundary;
4. required permission from Nexora-owned role assignments;
5. organization/business-unit scope when the resource is scoped;
6. explicit resource/domain attributes for the specific use case;
7. deny by default when any required context is absent or ambiguous.

The browser never supplies authoritative permissions. Controllers may carry resource identifiers, but services resolve tenant, organization, unit and domain attributes from trusted persistence before authorizing a mutation.

## Contextual attributes allowed in v1

- tenant identifier;
- membership status;
- organization identifier;
- business-unit identifier;
- resource ownership/scope;
- lifecycle state when a transition has stricter permissions;
- operational role/capability when explicitly modeled by a bounded context.

No free-form policy expressions stored in JSON are allowed in v1.

## Enforcement boundary

Create a dedicated authorization service/guard layer that resolves effective permissions and scopes from `membership_roles`, `role_permissions`, `membership_organization_scopes` and `membership_business_unit_scopes`.

RLS remains mandatory and is not replaced by application authorization. Application authorization narrows access further; it must never broaden the database tenant boundary.

## Audit requirements

Every denied privileged action must be observable without leaking sensitive resource data. Material permission/role/scope changes must be auditable with actor, tenant, target, timestamp and correlation identifier.

## Testing requirements

For every protected capability, test at least:

- allowed role + correct tenant + correct scope;
- missing permission;
- wrong organization scope;
- wrong business-unit scope;
- cross-tenant resource;
- inactive membership;
- missing/invalid context;
- privilege change taking effect without relying on browser state.

## Consequences

**Positive:** preserves the existing RBAC model, supports multi-organization users and fine-grained transport operations without policy-engine overreach.

**Trade-off:** domain-specific checks remain explicit code and tests.

**Future trigger for a policy engine:** only reconsider generalized ABAC when multiple bounded contexts require equivalent dynamic rules that cannot be expressed safely through typed permissions and scopes.
