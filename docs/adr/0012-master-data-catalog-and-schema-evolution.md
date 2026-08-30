# ADR-0012 — Canonical Master Data Catalog and Schema Evolution

- **Status:** Proposed
- **Scope:** Nexora TMS database evolution after migration 0014

## Context

Nexora already has a non-trivial PostgreSQL/Drizzle model covering tenancy, identity/IAM, business parties, drivers/capacity, transport requests, commercial terms, freight negotiation, capacity reservation and transport contracts.

The roadmap now advances through Cadastros → Cargas → Matching → Negociação → Viagens. Creating each module independently would create a high risk of duplicate concepts (`loads` versus `transport_requests`, `vehicles` versus `capacity_assets`, separate customer/carrier roots versus `business_parties`), inconsistent tenant isolation and repeated migrations.

## Decision

Adopt the following files as the canonical data-model specification once this ADR is accepted:

- `docs/data/master-data-catalog-v1.md` — current physical baseline, naming, type, tenancy, lifecycle, audit and migration rules;
- `docs/data/master-data-catalog-target-v1.md` — complementary target tables and roadmap waves.

The executable Drizzle schema and versioned SQL migrations remain the current-state source of truth. The catalog is the target-state contract and must be updated in the same PR whenever a schema decision changes that contract.

### Canonical aggregate decisions

- Customers, carriers, shippers, consignees, partners and suppliers remain roles/extensions of `business_parties` rather than separate master roots.
- Vehicles and implements remain `capacity_assets`; specialized extensions are preferred over duplicate root tables.
- `capacity_assignments` remains the driver × vehicle × carrier temporal relationship.
- `transport_requests` remains the freight/load request root; `transport_request_stops` remains its multi-stop model.
- `freight_proposals` models proposal/counterproposal chains.
- Acceptance is represented by proposal event + capacity reservation + transport contract rather than a competing acceptance aggregate.
- Trips are introduced as a new downstream execution aggregate only after the preceding contract chain is stable.

### Mandatory database invariants

1. Tenant-owned rows have `tenant_id`.
2. Tenant-owned cross-table references use tenant-aware composite FKs where the parent is tenant-owned.
3. RLS uses transaction/session context (`app.tenant_id`, and `app.user_id` where required).
4. Soft delete is limited to mutable master/configuration data that must disappear from normal UX while preserving history; business cancellation uses explicit workflow state.
5. Audit/event/history tables are append-only and are not soft deleted.
6. Money and physical quantities use exact `numeric`, never floating point.
7. Migration history through `0014` is immutable. New work starts at `0015+` and follows dependency waves in the catalog.
8. New tenant-owned tables are incomplete without RLS/grants and negative cross-tenant tests.

## Consequences

### Positive

- Prevents duplicate domain roots and naming drift.
- Makes database reviews objective because PK/FK, lifecycle, tenancy and audit expectations are known before implementation.
- Supports incremental normalization without destructive migrations.
- Preserves PostgreSQL integrity while leaving room for later pricing, finance, risk, automation and analytics modules.
- Gives Matching explainable persistence and gives Trips a stable upstream contract.

### Trade-offs

- The target catalog is deliberately broader than the currently active roadmap wave.
- Not every catalogued future table should be created immediately.
- Some existing free-text classifications require staged normalization rather than a one-release replacement.
- Strong tenant-aware FKs produce more verbose schema definitions but prevent cross-tenant relational corruption.

## Implementation sequence

1. Accept this ADR and catalog in review.
2. Implement `0015` catalog foundations and safe consistency fixes.
3. Implement `0016` Cadastros enrichment.
4. Continue `0017`–`0024` only as the corresponding roadmap module becomes active.
5. For every wave: generate/review Drizzle + explicit SQL, replay migrations from clean schema, run tenant-isolation tests, then promote development → staging under existing release gates.

## Non-goals

This ADR does not authorize creating every Future table now, bypassing pending Auth0/TenantContext/RBAC roadmap decisions, weakening RLS, or modifying existing migration files.
