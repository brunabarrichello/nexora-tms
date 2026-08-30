# ADR-0014 — Driver and Asset Qualification Boundary

- **Status:** Accepted
- **Scope:** Wave 0017 — drivers, vehicles, implements and operational capacity qualification

## Context

Wave 0017 must make drivers and capacity assets operationally eligible for later Matching and Trips without creating a second document-management system before Wave 0018. The existing canonical roots are already `drivers`, `capacity_assets` and `capacity_assignments`.

The model also needs current availability, explicit unavailability, operational/compliance blocks, capabilities, maintenance, insurance, inspections and position history while preserving tenant isolation and auditability.

## Decision

### Canonical roots remain unchanged

- `drivers` remains the driver root.
- `capacity_assets` remains the vehicle/implement root.
- `capacity_assignments` remains the temporal driver × vehicle × carrier relationship.
- No `driver_vehicle_links`, parallel `vehicles` root or duplicate driver root is introduced.

### Qualification tables are extensions, not aggregate replacements

Wave 0017 introduces driver and asset extension tables for qualifications, availability, blocks, capabilities, maintenance, insurance, inspections, ratings and observed positions.

Current-state singleton extensions (`driver_availability`, `capacity_asset_availability`, `capacity_asset_capabilities`) use tenant-scoped uniqueness. Historical facts such as ratings and asset positions are append-oriented.

### Document boundary with Wave 0018

`driver_documents` and `capacity_asset_documents` in Wave 0017 are qualification registers. They store document type, identifying metadata, validity, validation state and operational status.

They do **not** store file bytes, object-storage keys, version chains or generic document content. Wave 0018 owns the reusable `documents` / versions / validations core and will connect these qualification registers to canonical document records. This prevents a temporary mini-DMS from becoming a competing document root.

### Catalog normalization is additive

`capacity_assets.vehicle_type_id` and `capacity_assets.body_type_id` are introduced as nullable tenant-aware references to the Wave 0015 catalogs. The existing textual `vehicle_type` and `body_type` fields remain during compatibility migration. They are not destructively removed in Wave 0017.

### Runtime privilege model

Mutable qualification/configuration rows permit `SELECT`, `INSERT` and `UPDATE` to `nexora_app`, with physical `DELETE` withheld. Business deactivation, completion, cancellation and release use explicit status/lifecycle fields.

`driver_ratings` and `capacity_asset_locations` are append-oriented for the application runtime: `SELECT` + `INSERT`, without `UPDATE` or `DELETE`.

## Multi-tenant and integrity invariants

1. Every Wave 0017 table is tenant-scoped and protected by RLS.
2. Driver/asset relationships use `(tenant_id, id)` composite FKs.
3. Cross-tenant vehicle/body catalog assignment is rejected by composite FKs.
4. API operations execute inside `TenantDatabaseService` tenant transactions.
5. Document types must have a compatible subject scope (`driver` or `asset`, with `other` explicitly allowed).
6. Maintenance plans referenced by maintenance records must belong to the same asset at service level.
7. Maintenance items must belong to a maintenance record owned by the same asset.
8. Monetary values require an explicit currency reference.
9. Expiry/end dates cannot precede issue/start dates.
10. Position latitude/longitude and rating/temperature/quantity ranges are constrained in both validation and PostgreSQL where applicable.

## Consequences

### Positive

- Matching receives deterministic availability, capabilities and block inputs.
- Trips can later consume qualified assignments without redesigning driver/asset roots.
- Document management remains cleanly separated for Wave 0018.
- Historical position/rating facts cannot be silently rewritten by the normal application runtime.
- Existing free-text asset classifications remain backward compatible while relational catalog adoption begins.

### Trade-offs

- Wave 0018 must add canonical document links after the generic document core exists.
- Some legacy asset classification text remains temporarily duplicated with new catalog IDs.
- Qualification APIs return extension records independently from the existing driver/asset root endpoints; projection/read-model composition can be added later without changing persistence.

## Validation

Wave 0017 is incomplete until CI, full Drizzle replay, RLS/grant checks, cross-tenant negative tests, append-only privilege tests and the existing TenantContext/Matching/Negotiation regression gates are green in the PR.
