# ADR-0013 — Master Data Enrichment and Controlled Extensibility

- **Status:** Accepted
- **Scope:** Wave 0016 — Cadastros Enriquecidos

## Context

Wave 0015 established the foundational global and tenant catalogs. Wave 0016 must enrich Cadastros without creating competing roots for concepts that already exist in Nexora TMS and without weakening the multi-tenant model.

The existing model already owns `organizations`, `business_units`, `business_parties`, business-party addresses and contacts, `drivers`, `capacity_assets` and `transport_requests`. Recreating customer, carrier, address, vehicle or freight-request roots would split the source of truth and make Matching, Negotiation and Trips inconsistent.

Wave 0016 also introduces tenant customization. That extensibility must not become an unbounded generic-table mechanism or replace relational modeling with JSONB.

## Decision

### Reuse canonical aggregates

Wave 0016 extends the existing roots rather than duplicating them:

- customer, carrier, shipper, consignee and supplier data remain roles/extensions of `business_parties`;
- existing business-party addresses and contacts remain the canonical directory records;
- drivers remain `drivers`;
- vehicles and implements remain `capacity_assets`;
- freight/load requests remain `transport_requests`.

### Locations are operational points

`locations` is introduced as the reusable operational-point abstraction for warehouses, yards, terminals, ports, airports, borders, customer points and support points.

A location can either:

- reference an existing business-party address through a tenant-aware FK; or
- represent a standalone operational point with normalized city/address data.

Coordinates are optional, but latitude and longitude are always supplied as a pair. Locations use activation/inactivation plus soft deletion so historical operational references can be retained.

### Organizational dimensions

`departments` and `cost_centers` are tenant-owned dimensions scoped to an organization and optionally a business unit. Their references use tenant-aware FKs so a row cannot attach to another tenant's organization or business unit.

### Currency is global reference data

`currencies` is a global ISO-oriented reference catalog. It is intentionally read-only to `nexora_app` and is reused by credit, Pricing and Finance domains. Tenant-owned monetary records reference it by FK instead of storing an unconstrained currency code.

### Typed tags instead of a generic polymorphic link

The shared `tags` catalog is reused, but entity assignment is represented by typed join tables:

- `business_party_tags`;
- `driver_tags`;
- `capacity_asset_tags`;
- `transport_request_tags`.

Assignments support activation/inactivation and are not physically deleted by the runtime role. This preserves referential integrity and prevents arbitrary entity/table references.

### Controlled custom fields

Custom fields use `custom_field_definitions` plus `custom_field_values`. The value table is intentionally polymorphic because arbitrary tenant-defined fields cannot have static relational columns, but the polymorphism is constrained by the application boundary.

The API permits only a static whitelist of supported entity types and verifies that the target entity exists inside the current tenant transaction before writing a value. Arbitrary table names from the request are never executed.

Supported entity types at this stage are:

- `business_party`;
- `driver`;
- `capacity_asset`;
- `transport_request`;
- `location`.

Supported custom-field data types are explicit and validated before persistence: string, number, boolean, date, datetime and JSON.

JSONB is therefore limited to extension/configuration payloads and does not replace relational domain modeling.

### Tenant configuration and sequences

`module_settings` and `feature_flags` are tenant-owned configuration records. `number_sequences` provides tenant-scoped atomic identifier allocation using an update-and-return operation inside the existing tenant database transaction.

### Runtime privileges

`nexora_app` receives:

- `SELECT` only on `currencies`;
- `SELECT`, `INSERT` and `UPDATE` on the 20 tenant-owned Wave 0016 tables;
- no physical `DELETE` privilege on those tenant-owned tables.

Every tenant-owned table has RLS using the standard `app.tenant_id` context.

## Consequences

### Positive

- Preserves one source of truth for customers, carriers, drivers, assets and freight requests.
- Gives later Cargas, Matching, Pricing and Trips normalized operational locations and reusable dimensions.
- Keeps tenant customization possible without allowing arbitrary-table polymorphism.
- Preserves history through lifecycle transitions rather than runtime physical deletion.
- Makes currency relational and reusable before Pricing and Finance are introduced.
- Keeps cross-tenant corruption blocked by both RLS and tenant-aware FKs.

### Trade-offs

- Custom-field values require application-level target existence validation because one FK cannot point to multiple relational tables.
- Location records intentionally duplicate selected address fields for standalone operational points; when linked to a business party, the canonical address is referenced instead.
- Feature/module configuration remains JSONB because its keys are intentionally tenant/module-specific, but business domain facts must continue to be modeled relationally.

## Validation

Wave 0016 is accepted only after all of the following pass on the same PR head:

- standard CI: lint, Prettier, typecheck, tests, build and Drizzle artifact checks;
- clean migration replay through `0016` on an isolated Neon branch;
- 65-table / 57-RLS / 17-migration baseline verification;
- runtime privilege verification for `nexora_app`;
- positive and negative RLS tests for `locations`;
- existing TenantContext, OIDC identity, Matching, Negotiation, Reservation and Contract regression gates;
- tenant-aware FK rejection tests;
- isolated Neon branch cleanup.

## Operational note

Direct shared-environment inspection/promotion through the current Neon connector is temporarily blocked by a connector argument-schema mismatch. This does not weaken the database validation requirement: isolated Neon branches created by GitHub Actions remain the authoritative real-database PR gate until the connector is corrected. Shared environment promotion must resume through the approved release flow when that external blocker is removed.
