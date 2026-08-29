# @nexora/database

Foundation database schema for Nexora TMS.

## Scope

This package owns the cross-cutting persistence contract required before Core TMS modules:

- tenants;
- organizations;
- business units;
- tenant settings;
- local users and external identity references;
- tenant-level memberships;
- permissions and tenant roles;
- membership role assignments;
- organization scopes;
- business-unit scopes;
- tenant-aware foreign-key constraints;
- PostgreSQL RLS policies.

It intentionally does **not** contain loads, freight, trips, documents, finance, billing or other business-domain tables yet.

## Isolation contract

Tenant-scoped tables carry `tenant_id`. Cross-table associations use composite foreign keys with `tenant_id` where the referenced relation is tenant-scoped, preventing a valid identifier from another tenant from being attached accidentally.

A membership links one user to one tenant. Organization and business-unit access are separate many-to-many scope assignments; the membership itself is not pinned to one organization.

RLS reads trusted server-side session settings:

- `app.user_id` — authenticated Nexora-local user;
- `app.tenant_id` — active validated tenant.

The absence of a tenant setting does not match tenant-scoped rows. RLS is defense in depth; API authorization and TenantContext enforcement remain mandatory.

`memberships` has a narrow self-select path keyed by `app.user_id` so the application can resolve a user's available memberships before an active tenant is selected. Membership mutations still require an active tenant context.

## Migration state

The TypeScript schema is versioned here. Generated migrations are not yet claimed as executed; generation/check and disposable Neon validation remain required before merge or deployment.
