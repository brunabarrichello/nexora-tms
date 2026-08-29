# Nexora TMS — Multi-Tenant Isolation Model v1

**Status:** Wave 0 design baseline  
**Jira:** NEX-20 / NEX-71 / NEX-72 / NEX-73

## Core rule

Tenant isolation is a system invariant. Every tenant-scoped operation resolves and enforces tenant context independently of resource identifiers supplied by the client.

## Main concepts

### Tenant / organization

The top-level customer/business isolation boundary for SaaS data and authorization.

### Membership

Links a user to a tenant and is required before a human identity can operate in that tenant.

### Business unit / organizational scope

Optional sub-boundary inside a tenant for branch/unit-specific access and operational policies. It never replaces the top-level tenant boundary.

## Data rules

- `tenant_id` is mandatory on every business entity that is tenant-scoped;
- `organization_id` is required when an entity belongs to a specific organization representation within the model;
- tenant-scoped foreign keys/unique relationships must prevent cross-tenant association at the database level where practical;
- indexes include tenant dimensions when required by access patterns and integrity;
- client-provided resource IDs are resolved under the authenticated tenant;
- shared/global reference data must be explicitly classified as non-tenant-scoped rather than accidentally omitting `tenant_id`.

## TenantContext

API request processing establishes a central immutable tenant context containing only validated server-side information such as:

```text
user identity
membership identity
active tenant identity
roles/permissions
organizational scope
correlation identity
```

Domain/application code receives this context through an approved abstraction; deep services must not parse ad-hoc headers or trust browser-provided tenant identifiers.

## API propagation

1. authenticate identity;
2. resolve requested/default tenant against active memberships;
3. build TenantContext;
4. authorize operation;
5. resolve target resource inside tenant scope;
6. execute use case;
7. audit sensitive operation with tenant/correlation context.

## Jobs and events

Tenant-scoped asynchronous work includes validated tenant context in its durable envelope.

Minimum fields include:

- tenant ID;
- job/event ID;
- correlation ID;
- idempotency identifier where applicable;
- aggregate/resource reference when safe;
- schema/version.

Consumers must not infer tenant solely from a resource ID or external payload.

## PostgreSQL defense in depth

RLS is used on critical tenant-scoped tables where compatible with the access/migration model.

Baseline:

- default deny when tenant context is absent/invalid;
- runtime roles do not receive `BYPASSRLS`;
- migrations/admin operations use separate capabilities;
- application authorization remains mandatory even when RLS is active;
- policies are versioned/tested with migrations.

## Cross-tenant platform operations

True platform-level or controlled cross-tenant operations require a narrow explicit service/administrative capability, audit evidence and code review. They must not be implemented by casually omitting tenant predicates or disabling RLS in normal runtime paths.

## Initial conceptual model

```text
tenants / organizations
memberships
business_units (when required)
tenant_settings
feature_flags / tenant_feature_assignments
```

Business bounded contexts reference the tenant boundary rather than duplicating tenant ownership logic independently.

## Negative isolation tests

Before NEX-20 can close, automated tests must prove that Tenant A cannot access Tenant B through:

- direct known resource ID;
- lists/search/filtering;
- foreign-key/relationship mutations;
- bulk commands;
- reports/read models;
- jobs/events;
- documents/object storage;
- alternate endpoints or indirect associations.

Tests must validate application-level enforcement and database-level defense where RLS/constraints apply.

## Audit

Sensitive tenant-scoped actions record tenant context, actor/service identity, operation, target reference, result and correlation ID while minimizing duplicated sensitive payload.

## Completion gate

This document defines the required isolation model. NEX-71/72/73 remain incomplete until schema, TenantContext propagation, constraints/RLS and automated negative isolation tests are implemented and executed.
