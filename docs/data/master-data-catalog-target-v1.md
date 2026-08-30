# Nexora TMS — Target Schema Catalog v1

**Companion to:** `master-data-catalog-v1.md`  
**Rule:** Existing canonical tables are extended; they are not duplicated by generic TMS synonyms.  
**Implementation priority:** `0015`–`0024` support Cadastros → Cargas → Matching → Negociação → Viagens. Everything after that is architectural reservation until its roadmap wave.

## 1. Reusable physical column profiles

The profiles below are documentation shorthand. They do not imply PostgreSQL table inheritance.

### Profile `TENANT_MUTABLE`

```text
id                  uuid PK default gen_random_uuid()
tenant_id           uuid NOT NULL FK -> tenants(id)
created_by_user_id  uuid NULL/NOT NULL FK -> users(id) according to source of creation
updated_by_user_id  uuid NULL/NOT NULL FK -> users(id)
created_at          timestamptz NOT NULL default now()
updated_at          timestamptz NOT NULL default now()
deleted_at          timestamptz NULL              -- only when soft-delete class applies
deleted_by_user_id  uuid NULL FK -> users(id)      -- only with deleted_at
delete_reason       varchar(500) NULL              -- when deletion reason is useful
```

Every tenant-owned root with `id` also exposes `UNIQUE (tenant_id,id)`.

### Profile `TENANT_EVENT`

```text
id             uuid PK default gen_random_uuid()
tenant_id      uuid NOT NULL
actor_user_id  uuid NULL FK -> users(id)
created_at     timestamptz NOT NULL default now()
```

Event/history rows are append-only and never soft deleted.

### Profile `GLOBAL_LOOKUP`

```text
id          uuid PK default gen_random_uuid()
code        varchar(...) NOT NULL UNIQUE
name        varchar(...) NOT NULL
is_active   boolean NOT NULL default true
created_at  timestamptz NOT NULL default now()
updated_at  timestamptz NOT NULL default now()
```

Global lookups are read-only to the normal runtime role. Tenant customization must not mutate the global row.

### Profile `TENANT_LOOKUP`

```text
id          uuid PK default gen_random_uuid()
tenant_id   uuid NOT NULL FK -> tenants(id)
code        varchar(...) NOT NULL
name        varchar(...) NOT NULL
is_active   boolean NOT NULL default true
created_at  timestamptz NOT NULL default now()
updated_at  timestamptz NOT NULL default now()
UNIQUE (tenant_id,id)
UNIQUE (tenant_id,code)
```

## 2. Wave `0015` — foundational catalogs and reference data

These tables remove uncontrolled free-text classifications and establish stable keys for later modules.

| Table | Scope / fields beyond profile | PK/FK and cardinality | Indexes / constraints / lifecycle |
| --- | --- | --- | --- |
| `countries` | `GLOBAL_LOOKUP`; `code varchar(2)`, `iso3 varchar(3)`, `numeric_code varchar(3) NULL` | PK id; 1:N states | unique code/iso3; uppercase ISO checks; deactivate, never user-delete |
| `states` | `GLOBAL_LOOKUP`; `country_id uuid`, `code varchar(8)`, `name varchar(120)` | FK country; country 1:N states | unique `(country_id,code)`; index country/name |
| `cities` | `GLOBAL_LOOKUP`; `state_id uuid`, `ibge_code varchar(10) NULL`, `name varchar(160)`, `latitude numeric(9,6) NULL`, `longitude numeric(10,6) NULL` | FK state; state 1:N cities | unique IBGE when non-null; index state/name; lat/lon range checks |
| `units_of_measure` | `GLOBAL_LOOKUP`; `code varchar(16)`, `name varchar(80)`, `dimension varchar(32)` | no tenant FK | unique code; dimension check (`mass`,`volume`,`length`,`count`,`time`,`other`) |
| `vehicle_types` | `TENANT_LOOKUP`; `description varchar(300) NULL`, `default_max_weight_kg numeric(14,3) NULL` | tenant 1:N types; target FK from capacity/cargo | positive optional weight; partial/live unique if soft-delete later; deactivate rather than delete |
| `body_types` | `TENANT_LOOKUP`; `description varchar(300) NULL`, `is_closed boolean`, `supports_side_loading boolean`, `supports_rear_loading boolean` | tenant 1:N body types | tenant/code unique |
| `cargo_types` | `TENANT_LOOKUP`; `description varchar(300) NULL`, `requires_special_handling boolean` | tenant 1:N cargo types | tenant/code unique |
| `package_types` | `TENANT_LOOKUP`; `description varchar(300) NULL`, `stackable_default boolean NULL` | tenant 1:N package types | tenant/code unique |
| `document_types` | `TENANT_LOOKUP`; `subject_scope varchar(32)`, `has_expiry boolean`, `requires_validation boolean` | tenant 1:N doc types | scope check (`party`,`driver`,`asset`,`request`,`trip`,`financial`,`other`) |
| `tags` | `TENANT_LOOKUP`; `description varchar(300) NULL` | tenant 1:N tags; typed join tables below | code unique inside tenant; deactivate, no deletion if referenced |

### `0015` compatibility migrations

The existing `capacity_assets.vehicle_type/body_type` and `transport_request_cargo_profiles.cargo_type/vehicle_type/body_type` stay in place during this wave. New nullable FK columns may be introduced only after catalog rows can be mapped deterministically. Free-text columns are not dropped in the same migration.

Also in `0015`: validate existing `business_party_audit.actor_user_id`, then add `FK -> users(id) ON DELETE RESTRICT` if all rows are valid.

## 3. Wave `0016` — Cadastros enrichment

### 3.1 Organization and management dimensions

| Table | Specific fields | PK/FK / cardinality | Indexes / constraints / lifecycle |
| --- | --- | --- | --- |
| `departments` | `TENANT_MUTABLE`; `organization_id uuid`; `business_unit_id uuid NULL`; `code varchar(80)`; `name varchar(160)`; `is_active boolean` | tenant-aware FK org; optional tenant-aware unit; org 1:N departments | unique `(tenant_id,organization_id,code)`; index tenant/unit; soft-delete optional only after UI removal exists |
| `cost_centers` | `TENANT_MUTABLE`; org/unit IDs; `code varchar(80)`; `name varchar(160)`; `is_active boolean` | org 1:N cost centers; optional unit | unique tenant/org/code; tenant/unit index |
| `number_sequences` | `TENANT_MUTABLE`; `scope varchar(64)`; `prefix varchar(32) NULL`; `next_value bigint`; `padding smallint` | tenant 1:N sequences | unique tenant/scope; next_value > 0; padding 0..20; update under row lock |
| `module_settings` | `TENANT_MUTABLE`; `module varchar(64)`; `settings jsonb` | tenant 1:N module settings | unique tenant/module; GIN only if real JSON-path queries appear |
| `feature_flags` | `TENANT_MUTABLE`; `key varchar(120)`; `enabled boolean`; `configuration jsonb` | tenant 1:N flags | unique tenant/key |

### 3.2 First-class operational locations

#### `locations`

`TENANT_MUTABLE` +:

```text
party_id               uuid NULL
address_id             uuid NULL
code                   varchar(80) NOT NULL
name                   varchar(200) NOT NULL
type                   varchar(32) NOT NULL
city_id                uuid NULL FK -> cities(id)
postal_code            varchar(16) NULL
street                 varchar(200) NULL
number                 varchar(40) NULL
complement             varchar(160) NULL
district               varchar(120) NULL
latitude               numeric(9,6) NULL
longitude              numeric(10,6) NULL
operational_reference  varchar(500) NULL
is_active              boolean NOT NULL default true
```

- Optional `(tenant_id,party_id,address_id)` FK points to `business_party_addresses` when the location represents a party site.
- `UNIQUE (tenant_id,code)` over live rows.
- Index `(tenant_id,city_id,is_active)` and `(tenant_id,party_id,is_active)`.
- Check latitude/longitude ranges and require either an existing party address or enough standalone address data to identify the location.
- Party 1:N locations; city 1:N locations.
- Soft delete allowed; operational history keeps the referenced row.

### 3.3 Party grouping, requirements and service model

| Table | Specific fields | Relationships | Constraints / indexes |
| --- | --- | --- | --- |
| `business_party_groups` | tenant mutable; `code varchar(80)`, `name varchar(200)`, `group_type varchar(32)`, `is_active boolean` | tenant 1:N groups | unique tenant/code; type e.g. economic/commercial/operational |
| `business_party_group_members` | `tenant_id`, `group_id`, `party_id`, `starts_on date NULL`, `ends_on date NULL`, `created_at` | group N:M party | composite PK `(tenant_id,group_id,party_id)` or temporal surrogate if multiple periods required; end >= start |
| `business_party_requirements` | tenant mutable; `party_id`; `requirement_type varchar(64)`; `value_text varchar(1000) NULL`; `value_json jsonb NULL`; `is_mandatory boolean`; `valid_from date NULL`; `valid_until date NULL` | party 1:N requirements | index tenant/party/type; valid range; exactly one value representation when required |
| `business_party_document_requirements` | tenant mutable; `party_id`; `document_type_id`; `subject_scope`; `is_mandatory`; `lead_days integer default 30` | party N:M document types | unique tenant/party/doc/scope; lead_days >= 0 |
| `business_party_service_areas` | tenant mutable; `party_id`; `state_id uuid NULL`; `city_id uuid NULL`; `radius_km numeric(10,2) NULL`; `direction varchar(16)` | party 1:N service areas | at least state or city; radius > 0 if present; direction inbound/outbound/both |
| `business_party_billing_rules` | tenant mutable; `party_id`; `rule_type varchar(64)`; `configuration jsonb`; `valid_from date`; `valid_until date NULL` | party 1:N rules | valid date range; index party/type/live |
| `business_party_credit_limits` | tenant mutable; `party_id`; `currency_code varchar(3)`; `limit_amount numeric(18,2)`; `valid_from date`; `valid_until date NULL` | party 1:N historical limits | amount >= 0; currency check; no overlapping active range per currency where practical |

### 3.4 Tenant-owned commodity catalog

#### `commodities`

`TENANT_LOOKUP` + `description varchar(500) NULL`, `default_cargo_type_id uuid NULL`, `is_hazardous boolean`, `requires_temperature_control boolean`.

- Tenant-aware FK to `cargo_types`.
- Unique tenant/code.
- Referenced by transport request items.
- Deactivate rather than delete once used.

### 3.5 Tags and extensibility

Strongly typed tag joins are preferred over an unconstrained polymorphic FK:

```text
business_party_tags (tenant_id, party_id, tag_id) PK
 driver_tags         (tenant_id, driver_id, tag_id) PK
capacity_asset_tags  (tenant_id, asset_id, tag_id) PK
transport_request_tags (tenant_id, transport_request_id, tag_id) PK
```

Each join has tenant-aware FKs to both subject and `tags`, RLS, and an index `(tenant_id,tag_id)`.

#### `custom_field_definitions`

`TENANT_MUTABLE` + `entity_type varchar(64)`, `key varchar(120)`, `label varchar(160)`, `data_type varchar(32)`, `is_required boolean`, `validation jsonb`, `is_active boolean`.

- Unique `(tenant_id,entity_type,key)`.
- Data type check: `string|number|boolean|date|datetime|json`.

#### `custom_field_values`

```text
id                   uuid PK
tenant_id            uuid NOT NULL
definition_id        uuid NOT NULL
subject_id           uuid NOT NULL
value_json           jsonb NOT NULL
created_at           timestamptz NOT NULL
updated_at           timestamptz NOT NULL
UNIQUE (tenant_id,definition_id,subject_id)
```

The definition FK is tenant-aware. `subject_id` is a deliberate controlled-polymorphism exception because custom fields span modules; service code must resolve `entity_type` and confirm the subject belongs to the same tenant. This table is not used for core fields that deserve real relational columns.

## 4. Wave `0017` — driver and capacity qualification

### 4.1 Driver extensions

| Table | Specific fields | Relationships / cardinality | Constraints / indexes / lifecycle |
| --- | --- | --- | --- |
| `driver_documents` | tenant mutable; `driver_id`, `document_type_id`, `document_id` | driver 1:N document links | unique live driver/doc-type/doc as appropriate; typed FKs; no duplicate file bytes |
| `driver_courses` | tenant mutable; `driver_id`; `course_type varchar(80)`; `certificate_number varchar(120) NULL`; `issued_on date`; `expires_on date NULL`; `document_id uuid NULL` | driver 1:N courses | expiry >= issue; index expiry; soft delete only for erroneous record, not expiry |
| `driver_availability` | tenant mutable/current-state; `driver_id`; `status varchar(32)`; `available_from timestamptz`; `current_city_id uuid NULL`; `destination_city_id uuid NULL`; `max_distance_km numeric(10,2) NULL`; `notes varchar(500) NULL` | driver 1:0/1 current availability | unique tenant/driver; status check; distance >= 0; indexes city/status/available_from |
| `driver_bank_accounts` | tenant mutable; driver; bank code/branch/account fields; `account_type`; `holder_tax_id`; `is_default` | driver 1:N accounts | only one default live account per driver via partial unique; sensitive-field access restricted |
| `driver_pix_keys` | tenant mutable; driver; `key_type`; encrypted/tokenized `key_value`; `is_default` | driver 1:N keys | unique normalized key hash; one default; never expose raw secrets in audit |
| `driver_emergency_contacts` | tenant mutable; driver; name/relation/phone | driver 1:N | phone non-empty; soft-delete capable |
| `driver_blocks` | tenant mutable; driver; `reason_code`; `reason`; `starts_at`; `ends_at NULL`; `created_by_user_id` | driver 1:N blocks | period valid; partial unique can prevent duplicate active block by reason; history retained |
| `driver_ratings` | tenant event-like; driver; optional request/trip; `score numeric(3,2)`; `dimension varchar(64)`; note | driver 1:N ratings | score range; indexes tenant/driver/dimension/time; immutable after acceptance |

`driver_vehicle_links` from the initial concept is **not created** because `capacity_assignments` already owns the driver × vehicle × carrier temporal relationship.

### 4.2 Capacity asset extensions

| Table | Specific fields | Relationships | Constraints / indexes |
| --- | --- | --- | --- |
| `capacity_asset_capabilities` | `tenant_id`, `asset_id`; booleans `refrigerated`,`sealed`,`side_loading`,`rear_loading`,`dangerous_goods`,`food_grade`; `max_pallets integer NULL`; optional temperature min/max numeric | asset 1:0/1 capabilities | PK tenant/asset; positive pallets; temp min <= max |
| `capacity_asset_documents` | asset, document type, document | asset 1:N docs | typed tenant-aware FKs |
| `capacity_asset_insurances` | tenant mutable; asset; insurer party NULL; policy number; starts/ends; coverage amount/currency; document | asset 1:N policies | dates/amount valid; expiry index |
| `capacity_asset_maintenance` | tenant mutable; asset; `maintenance_type`; planned/performed timestamps; odometer numeric NULL; cost numeric(18,2) NULL; provider party NULL; status | asset 1:N maintenance | non-negative odometer/cost; indexes next/planned dates |
| `capacity_asset_maintenance_items` | tenant; maintenance_id; `item_type`; description; quantity numeric; amount numeric | maintenance 1:N items | quantity > 0; amount >= 0 |
| `capacity_asset_inspections` | tenant mutable; asset; inspector user NULL; performed_at; result; checklist jsonb; notes | asset 1:N inspections | result check; immutable after finalized status |
| `capacity_asset_availability` | tenant current-state; asset; status; available_from; current_city; notes | asset 1:0/1 | unique tenant/asset; indexes status/city/time |
| `capacity_asset_locations` | tenant event; asset; observed_at; lat numeric(9,6); lon numeric(10,6); source varchar(32); accuracy_m numeric NULL | asset 1:N positions | lat/lon/accuracy checks; index `(tenant_id,asset_id,observed_at desc)`; BRIN on observed_at at scale |
| `capacity_asset_costs` | tenant event/mutable-approved; asset; cost_type; incurred_on; amount/currency; request/trip optional; note | asset 1:N costs | amount >= 0; indexes asset/date/type |
| `capacity_asset_blocks` | asset; reason; period; actor | asset 1:N blocks | same temporal rule as driver blocks |

## 5. Wave `0018` — document core

The document model stores metadata and versions once, then uses typed association tables to preserve real FKs.

### `documents`

`TENANT_MUTABLE` without routine soft-delete of regulated history +:

```text
document_type_id     uuid NOT NULL
title                varchar(240) NOT NULL
status               varchar(32) NOT NULL
issued_on             date NULL
expires_on            date NULL
current_version_id    uuid NULL
metadata              jsonb NOT NULL default '{}'
```

- FK document type tenant-aware.
- Check expiry >= issue.
- Index tenant/type/status, tenant/expires_on.
- Status: `draft|pending_validation|valid|rejected|expired|revoked`.

### `document_versions`

`TENANT_EVENT` + `document_id uuid`, `version integer`, `storage_provider varchar(32)`, `storage_key varchar(1000)`, `file_name varchar(255)`, `content_type varchar(160)`, `size_bytes bigint`, `sha256 varchar(64)`, `uploaded_by_user_id uuid`.

- Document 1:N versions.
- Unique `(tenant_id,document_id,version)` and `(tenant_id,document_id,sha256)` when duplicate prevention is desired.
- `size_bytes > 0`; SHA-256 hex format.
- Append-only.

### `document_validations`

`TENANT_EVENT` + document/version; validator user; result; reason; provider/reference optional; validation payload JSON.

- Document/version 1:N validations.
- Result check `approved|rejected|needs_review`.
- Immutable.

### Typed links

```text
business_party_documents (tenant_id, party_id, document_id) PK
 driver_documents          (tenant_id, driver_id, document_id) PK or surrogate if document role fields are needed
capacity_asset_documents   (tenant_id, asset_id, document_id) PK
transport_request_documents(tenant_id, transport_request_id, document_id) PK
```

Each uses composite tenant-aware subject/document FKs. `trip_documents` is introduced with Trips.

## 6. Wave `0019` — Cargas normalization

### `transport_request_items`

`TENANT_MUTABLE` +:

```text
transport_request_id  uuid NOT NULL
sequence              integer NOT NULL
commodity_id          uuid NULL
description           varchar(500) NOT NULL
quantity              numeric(14,3) NOT NULL
unit_of_measure_id    uuid NOT NULL
weight_kg             numeric(14,3) NULL
cubage_m3             numeric(14,3) NULL
declared_value        numeric(18,2) NULL
currency_code         varchar(3) NULL
non_stackable         boolean NOT NULL default false
special_instructions  varchar(1000) NULL
```

- Request 1:N items; commodity 1:N items.
- Unique `(tenant_id,transport_request_id,sequence)`.
- Quantity > 0; weight/cubage/value non-negative; currency required iff declared value exists.
- Request/item and request/commodity indexes.
- No soft delete after request leaves draft; corrections become controlled version/event changes.

### `transport_request_packages`

`TENANT_MUTABLE` + request/item; package type; quantity integer; length/width/height numeric(10,3) nullable; unit weight numeric(14,3) nullable; palletized boolean.

- Request/item 1:N packages.
- Quantity > 0; dimensions all-null or all-positive.

### `transport_request_requirements`

`TENANT_MUTABLE` + request; `requirement_type varchar(64)`; optional `required_vehicle_type_id`, `required_body_type_id`; `is_mandatory`; `value_json jsonb`; notes.

- Request 1:N requirements.
- Index tenant/request/type.
- Used by Matching; do not bury match-critical flags only in notes.

### `transport_request_references`

`TENANT_MUTABLE` + request; `reference_type varchar(64)`; `reference_value varchar(200)`; optional party.

- Unique `(tenant_id,transport_request_id,reference_type,reference_value)`.
- Examples: customer order, purchase order, NF-e key, internal OS.

### `transport_request_status_history`

`TENANT_EVENT` + request; `from_status` nullable; `to_status`; reason.

- Request 1:N status transitions.
- Index request/created.
- Append-only.

### `transport_request_events`

`TENANT_EVENT` + request; `event_type varchar(64)`; optional stop; `occurred_at timestamptz`; `payload jsonb`.

- Request 1:N operational events.
- Index request/occurred.
- Does not replace explicit status history.

### `freight_lanes`

`TENANT_MUTABLE` + `code varchar(80)`, origin city/state/country and destination city/state/country, optional vehicle/body type, `is_active`.

- Tenant 1:N lanes.
- Unique normalized live lane key.
- Index origin/destination; later pricing/performance tables reference lane.

The existing `transport_request_cargo_profiles` remains the fast aggregate summary. Item/package totals must be reconciled to the profile through service invariants/tests before the request can reach `ready_for_quote`.

## 7. Wave `0020` — persisted Matching

### `matching_rules`

`TENANT_MUTABLE` + `code varchar(80)`, `name varchar(160)`, `dimension varchar(64)`, `weight numeric(7,4)`, `configuration jsonb`, `is_active boolean`, `version integer`.

- Unique `(tenant_id,code,version)`.
- Weight >= 0; version > 0.
- Historical runs store the rule version used.

### `matching_preferences`

`TENANT_MUTABLE` + optional party/customer; `configuration jsonb`; `valid_from`; `valid_until`.

- Customer 1:N preference versions.
- Valid date range; one active preferred config per scope.

### `matching_runs`

`TENANT_MUTABLE` but workflow/immutable-after-completion + `transport_request_id`, `status`, `started_at`, `completed_at`, `ruleset_version`, `candidate_count integer`, `triggered_by_user_id`.

- Request 1:N runs.
- Status `queued|running|completed|failed|cancelled`.
- Time consistency checks; index request/start and status/start.

### `matching_candidates`

`TENANT_MUTABLE` + run; capacity assignment; driver; vehicle; carrier; `rank integer`; `total_score numeric(9,6)`; `eligibility_status varchar(32)`; `estimated_distance_km numeric(12,3) NULL`; `estimated_freight numeric(14,2) NULL`.

- Run 1:N candidates.
- Unique `(tenant_id,matching_run_id,capacity_assignment_id)` and optional unique rank for eligible candidates.
- Score/rank/distance non-negative; tenant-aware FKs to all subjects.

### `matching_candidate_scores`

```text
id                 uuid PK
tenant_id          uuid NOT NULL
candidate_id       uuid NOT NULL
dimension          varchar(64) NOT NULL
raw_score          numeric(9,6) NOT NULL
weight             numeric(7,4) NOT NULL
weighted_score     numeric(9,6) NOT NULL
rule_code          varchar(80) NULL
explanation        varchar(1000) NULL
created_at         timestamptz NOT NULL
```

- Candidate 1:N score dimensions.
- Unique candidate/dimension/rule_code as applicable.
- Append-only after run completion.

### `matching_rule_results`

Candidate/rule execution detail: candidate, rule code/version, `passed boolean`, reason, payload JSON, created timestamp. Index candidate/rule.

### `matching_rejections`

Candidate, rejection code, reason, actor/system source, created timestamp. A rejected candidate may have N rejection reasons; immutable.

This structure makes Matching explainable and supports a future ML scorer without replacing the deterministic audit trail.

## 8. Wave `0021` — Negociação completion

Existing canonical entities remain `freight_proposals`, `freight_proposal_events`, `capacity_reservations`, `capacity_reservation_events`, `transport_contracts`, `transport_contract_events`.

Only missing collaboration/state support is added:

### `negotiation_threads`

`TENANT_MUTABLE` + request; `status varchar(32)`; opened/closed timestamps.

- Request 1:0/1 active thread.
- Status `open|closed|cancelled`.

### `negotiation_participants`

`tenant_id`, thread, participant type (`user|carrier_party|driver`), optional typed user/party/driver FK columns, joined/left timestamps.

- Surrogate id recommended because participation is temporal.
- Check exactly one typed subject column matches participant type.
- Index thread/active.

### `negotiation_messages`

`TENANT_EVENT` + thread; author participant; optional proposal; message text; channel (`internal|whatsapp|email|portal|api`); external message id nullable.

- Thread 1:N messages.
- Immutable; external id unique per channel/provider when present.

No `negotiation_acceptances` table is created: an accepted proposal + active reservation + resulting transport contract already provide the stronger canonical chain.

## 9. Wave `0022` — Viagens core

### `trips`

`TENANT_MUTABLE` +:

```text
code                 varchar(80) NOT NULL
status               varchar(32) NOT NULL
planned_start_at     timestamptz NOT NULL
planned_end_at       timestamptz NULL
actual_start_at      timestamptz NULL
actual_end_at        timestamptz NULL
origin_location_id   uuid NULL
destination_location_id uuid NULL
notes                varchar(1000) NULL
```

- Unique live `(tenant_id,code)`.
- Planned/actual ranges valid.
- Workflow status: `planned|ready|in_transit|completed|cancelled`.
- No soft delete for business cancellation.

### `trip_transport_requests`

`tenant_id`, `trip_id`, `transport_request_id`, `sequence integer`, `created_at`.

- PK `(tenant_id,trip_id,transport_request_id)`.
- Trip N:M transport requests, although most dedicated flows may be 1:1.
- Unique trip/sequence when sequence is used operationally.

### `trip_stops`

`TENANT_MUTABLE` + trip; sequence; stop type; location; optional source request/stop; planned arrival/departure; actual arrival/departure; status; instructions.

- Trip 1:N stops.
- Unique trip/sequence.
- Temporal checks and source-stop tenant-aware FK where present.

### `trip_drivers`

`TENANT_MUTABLE`/temporal + trip, driver, role (`primary|secondary|relief`), starts/ends.

- Trip N:M drivers over time.
- Prevent overlapping primary assignment within same trip when appropriate.

### `trip_assets`

Trip, asset, role (`tractor|vehicle|implement|support`), starts/ends.

- Trip N:M capacity assets.
- Tenant-aware FKs; period checks.

### `trip_status_history`

`TENANT_EVENT` + trip; from/to status; reason. Append-only, index trip/time.

## 10. Wave `0023` — Viagens execution

| Table | Core fields | Relationships / rules |
| --- | --- | --- |
| `trip_events` | trip; type; occurred_at; optional stop; payload JSON; actor | trip 1:N; immutable; index trip/occurred/type |
| `trip_checkins` | trip; stop; driver; type (`arrival|departure|manual`); occurred_at; lat/lon; proof document NULL | stop 1:N; geo checks; immutable |
| `trip_locations` | trip; asset NULL; driver NULL; observed_at; lat/lon; speed numeric; heading numeric; source | trip 1:N high-volume positions; at least asset or driver; BRIN/time + trip/time indexes at scale |
| `trip_checklists` | trip; stop NULL; checklist_type; status; performed_by; performed_at; result JSON | trip 1:N; finalized checklist immutable |
| `trip_expenses` | trip; expense_type; incurred_at; amount numeric(18,2); currency; paid_by party/user; document NULL | trip 1:N; amount >= 0 |
| `trip_tolls` | trip; stop/segment NULL; occurred_at; plaza/name; amount/currency; payment method | trip 1:N; amount >= 0 |
| `trip_fuel` | trip; asset; occurred_at; liters numeric(12,3); amount numeric(18,2); odometer numeric; station party/location NULL | trip 1:N; positive liters; non-negative values |
| `trip_proofs` | trip; stop/request; proof_type; document; captured_at; captured_by | trip/stop 1:N proofs; typed document FK |
| `trip_delivery_proofs` | trip; stop; request; receiver_name; receiver_document_hash NULL; delivered_at; document | delivery stop 1:0..N POD versions; immutable accepted proof |
| `trip_documents` | trip + document | N:M typed link; composite PK/FKs |

## 11. Wave `0024` — transversal audit and durable integration events

### `audit_events`

```text
id                 uuid PK
tenant_id          uuid NULL        -- null only for true platform-global actions
actor_user_id      uuid NULL
request_id         uuid NULL
correlation_id     uuid NULL
action             varchar(120) NOT NULL
entity_type        varchar(80) NOT NULL
entity_id          uuid NULL
before_data        jsonb NULL
after_data         jsonb NULL
ip_address         inet NULL
user_agent         varchar(500) NULL
metadata           jsonb NOT NULL default '{}'
created_at         timestamptz NOT NULL default now()
```

- Append-only; no update/delete grant to runtime.
- Index `(tenant_id,entity_type,entity_id,created_at desc)`, `(tenant_id,actor_user_id,created_at desc)`, correlation/request IDs.
- BRIN on created_at when volume warrants.
- Never store raw secrets, tokens, full bank credentials or sensitive document bytes in snapshots.

### `outbox_events`

Tenant; aggregate type/id; event type; payload JSON; occurred_at; available_at; processed_at nullable; attempts; last_error; idempotency key.

- Append-only payload; delivery-state columns are worker-managed.
- Unique idempotency key per tenant.
- Index pending rows `(processed_at,available_at)` as a partial index.

### `durable_jobs`

Tenant; job type; payload; status; run_at; attempt/max_attempts; locked_at/by; error; timestamps.

- Status/attempt consistency checks.
- Partial index runnable jobs.

## 12. Future — Routing and lane intelligence

These tables are catalogued now so Trips/Pricing do not later require a competing route model.

| Table | Core fields / relationships |
| --- | --- |
| `routes` | tenant mutable; code/name; origin/destination location/city; distance_km; duration_minutes; provider/reference; active |
| `route_segments` | route 1:N; sequence; origin/destination; distance/duration; road identifiers |
| `route_tolls` | route/segment; toll plaza/location; vehicle type; amount/currency; effective dates |
| `route_restrictions` | route/segment; restriction type; vehicle/body/weight/dimension criteria; valid dates |
| `route_risks` | route/segment; risk type/severity; source; valid dates; notes |
| `route_costs` | route; cost type; amount/currency; valid dates; source |
| `route_performance` | route/lane/date bucket; trips; avg transit; delay rate; cost/revenue metrics; projection/aggregate |
| `route_preferences` | tenant/customer/carrier optional; route preference/exclusion and validity |

`freight_lanes` is commercial origin-destination segmentation; `routes` are physical/operational path definitions. They are related but not synonyms.

## 13. Future — Pricing

| Table | Core fields / keys |
| --- | --- |
| `pricing_tables` | tenant; code/name; customer/party optional; currency; valid_from/until; status/version |
| `pricing_rules` | pricing table; rule type; priority; condition JSON; formula/config JSON; active |
| `pricing_components` | code/name; component type (`base_freight`,`toll`,`gris`,`ad_valorem`,`insurance`,`waiting`,`helper`,`pickup`,`delivery`,`urgency`,`other`) |
| `freight_rates` | table; component; min/max weight/volume/distance; amount/rate; unit |
| `freight_lane_rates` | table; freight_lane; vehicle/body type optional; amount; valid dates |
| `vehicle_rates` | table; vehicle type/body type; amount; charging unit |
| `additional_charges` | table/customer; charge code; amount/percentage; trigger config |
| `toll_rates` | route/segment/vehicle type; amount; effective dates |
| `fuel_surcharges` | table; reference index/value; percentage/amount; effective dates |
| `minimum_freight_rates` | jurisdiction/vehicle/cargo scope; source; rate; effective dates |
| `pricing_simulations` | tenant event/workflow; request; ruleset/table version; calculated totals; input snapshot |
| `pricing_history` | immutable pricing table/rule version snapshots |

All monetary fields use numeric + explicit currency; no floating point.

## 14. Future — Financial and profitability

The initial names from product discovery are preserved where they represent distinct accounting concepts.

### Receivables / billing

- `receivables`: tenant; customer party; request/trip/invoice optional; document number; issue/due dates; original/open amount `numeric(18,2)`; currency; status.
- `receivable_installments`: receivable 1:N; installment number; due date; amount; paid amount; status.
- `customer_invoices`: tenant; customer; number/series; issue date; total; currency; status; external fiscal reference.
- `billing_items`: invoice 1:N; request/trip; description; quantity; unit price; total; tax metadata.

### Payables / carrier-driver settlement

- `payables`: tenant; beneficiary party/driver; request/trip; issue/due dates; amount/currency/status.
- `payable_installments`: payable 1:N schedule.
- `carrier_payments`: carrier party; payable/payment transaction; amount/date.
- `driver_payments`: driver; payable/payment transaction; amount/date.

### Ledger/support

- `financial_transactions`: immutable tenant ledger event; account/category; direction; amount/currency; occurred_at; external reference.
- `payment_allocations`: payment transaction N:M receivable/payable item; allocated amount.
- `bank_accounts`: tenant-owned company/party account metadata; encrypted/tokenized sensitive fields.
- `payment_batches`: tenant; type; status; totals; submitted/processed timestamps.
- `pix_transactions`: batch/payment; provider IDs; end-to-end ID; amount/status/timestamps; no raw secret.
- `financial_adjustments`: subject; adjustment type; amount; reason; actor/time.
- `financial_categories`: tenant lookup, hierarchical optional parent.
- `financial_reconciliations`: bank/account/date period; status; totals/difference; evidence.
- `commissions`: beneficiary; request/trip; base amount; rate; amount; status.
- `commission_rules`: tenant; scope; condition; rate/formula; validity.

### Profitability projections

Rather than denormalized mutable truth, profitability rows are controlled projections/materializations:

- `load_profitability` (canonical subject = `transport_request_id`),
- `trip_profitability`,
- `customer_profitability`,
- `lane_profitability`,
- `carrier_profitability`.

Each stores period/as-of timestamp, revenue, direct costs, gross margin and margin percentage, with source version so it can be recomputed.

## 15. Future — Risk, compliance and insurance

| Table | Core model |
| --- | --- |
| `risk_providers` | tenant/global integration provider metadata, active |
| `risk_checks` | tenant; subject type + typed subject link strategy; provider; requested/completed timestamps; status |
| `risk_results` | risk check 1:N result facts; code/severity/value/evidence |
| `risk_rules` | tenant; code; subject scope; configuration; version; active |
| `risk_scores` | subject/check; score numeric; model/ruleset version; created_at |
| `risk_restrictions` | subject; restriction code; starts/ends; source check; active status |
| `blacklists` | tenant; code/name; scope; active |
| `blacklist_entries` | blacklist; typed subject; reason; starts/ends; actor |
| `compliance_checks` | subject; compliance type; result/status; checked_at; provider/actor |
| `compliance_rules` | tenant; code; scope; configuration; version |
| `compliance_evidence` | check; document/evidence metadata |
| `insurance_policies` | tenant; insured subject; insurer; policy; coverage; dates; amount/currency; document |
| `insurance_claims` | policy; request/trip/occurrence; opened/closed; amount/status; evidence |

Driver-specific risk checks use this generic compliance model rather than a competing `driver_risk_checks` fact table; a view may expose driver-focused queries.

## 16. Future — Occurrences

- `occurrence_types`: tenant lookup with code/name/category/default severity.
- `occurrence_categories`: tenant lookup, optional hierarchy.
- `occurrences`: tenant mutable/workflow; type; category; severity; status; request/trip/stop/driver/asset/party typed nullable FKs; occurred_at; description; owner user; timestamps.
- `occurrence_status_history`: immutable from/to status, actor, reason.
- `occurrence_actions`: corrective/preventive action, owner, due date, completion status/time.
- `occurrence_responsibles`: occurrence N:M user/party/driver with responsibility type.
- `occurrence_evidence`: occurrence + document/proof.
- `occurrence_documents`: typed occurrence-document link.
- `occurrence_costs`: occurrence; cost type; amount/currency; financial reference.
- `occurrence_communications`: occurrence + communication message reference.

Cancellation/closure is status-driven; occurrences are never silently soft-deleted after operational use.

## 17. Future — Communications, notifications and automation

### Communications

- `communication_channels`: tenant/global lookup (`email`,`sms`,`whatsapp`,`rcs`,`internal`,`webhook`).
- `communication_templates`: tenant; channel; code; locale; subject/body/config; version/status.
- `communications`: tenant; business context type/id; channel; template/version; status; created/scheduled/sent timestamps.
- `communication_recipients`: communication 1:N; recipient type; party/contact/driver/user or explicit normalized address; delivery preference.
- `communication_messages`: conversation/communication; direction; body/payload metadata; provider message id; timestamps.
- `communication_deliveries`: message 1:N provider attempts/status/timestamps.
- `communication_events`: immutable delivered/read/failed/provider callback events.
- `communication_failures`: normalized error category/code/message and retryability.
- `communication_preferences`: tenant subject; channel; opt-in/opt-out; quiet hours; legal basis where required.

WhatsApp-specific provider state is isolated in:

- `whatsapp_conversations`,
- `whatsapp_messages` only if provider semantics require fields beyond generic messages,
- `whatsapp_templates`,
- `whatsapp_webhook_events`.

Do not duplicate generic message facts unnecessarily.

### Notifications

- `notifications`: tenant; user/member recipient; type; title/body; entity context; read/dismissed timestamps.
- `notification_types`: tenant/global lookup.
- `notification_preferences`: user/member × type/channel settings.
- `notification_deliveries`: notification × channel delivery outcome.

### Automation

- `automation_rules`: tenant; code/name; trigger type; active/version.
- `automation_triggers`: rule trigger configuration.
- `automation_conditions`: rule 1:N ordered conditions/operator/value.
- `automation_actions`: rule 1:N ordered actions/configuration.
- `automation_executions`: rule execution status, started/completed, trigger context, correlation id.
- `automation_execution_logs`: immutable per-step details/errors.

## 18. Future — Integrations and webhooks

- `integrations`: tenant; provider/type; status; display name.
- `integration_accounts`: integration 1:N external accounts/tenants; external id; metadata.
- `integration_credentials`: secret reference metadata only; secrets remain in secret manager, not plain DB columns.
- `integration_settings`: integration/account settings JSON and version.
- `integration_events`: immutable inbound/outbound event envelope.
- `integration_jobs`: integration work queue/status/retry metadata when not handled by generic durable jobs.
- `integration_logs`: sanitized operational log/reference.
- `webhooks`: tenant integration endpoint registration metadata.
- `webhook_subscriptions`: webhook N:M event type/config.
- `webhook_events`: canonical event payload/hash/idempotency record.
- `webhook_deliveries`: event × destination attempts, status, latency, response class.
- `webhook_failures`: normalized final failure/dead-letter details.

## 19. Future — Management / MBA analytics

Operational truth stays normalized. KPI and management tables are projections or definitions:

- `kpi_definitions`: tenant/global; code/name; unit; formula/reference; owner module.
- `kpi_targets`: KPI; tenant/org/unit/customer scope; period; target value.
- `kpi_results`: KPI; scope; period/as-of; calculated value; source version.
- `operational_goals`, `commercial_goals`, `financial_goals`: target/period/scope/status/owner.
- `budgets`: tenant/org/unit; fiscal period; version/status.
- `budget_items`: budget; category/cost center; planned amount/currency.
- `forecasts`: tenant; type; horizon; generated_at; model/version/status.
- `forecast_items`: forecast; dimension/scope; period; projected value/confidence.
- `customer_segments`: tenant lookup/rules/version.
- `customer_scores`, `supplier_scores`, `carrier_scores`, `driver_scores`: subject; score dimensions; model/ruleset version; as-of timestamp.

Daily/subject metrics may be materialized tables or views according to volume:

- `daily_operational_metrics`,
- `daily_financial_metrics`,
- `daily_commercial_metrics`,
- `customer_metrics`, `driver_metrics`, `vehicle_metrics`, `carrier_metrics`, `lane_metrics`, `load_metrics` (transport-request projection), `trip_metrics`.

Every metric row must expose its grain explicitly (tenant + period + dimensions) and be reproducible from source facts.

## 20. Future configuration tables mapped from initial discovery

The following initial ideas are already covered and must not become duplicates:

| Initial idea | Canonical treatment |
| --- | --- |
| `addresses` | use `business_party_addresses`; use `locations` for operational sites not owned by a party |
| `contacts` | use `business_party_contacts` |
| `customer_*`, `carrier_*`, `supplier_*` master roots | use `business_parties` + roles + extension tables |
| `vehicle_documents` | `capacity_asset_documents` |
| `vehicle_capabilities` | `capacity_asset_capabilities` |
| `vehicle_availability` | `capacity_asset_availability` |
| `vehicle_locations` | `capacity_asset_locations` |
| `vehicle_blocks` | `capacity_asset_blocks` |
| `load_items` | `transport_request_items` |
| `load_stops` | existing `transport_request_stops` |
| `load_requirements` | `transport_request_requirements` |
| `load_status_history` | `transport_request_status_history` |
| `load_events` | `transport_request_events` |
| `matching_requests` | `matching_runs` against a canonical transport request |
| `matching_scores` | `matching_candidate_scores` |
| `freight_offers` / `counteroffers` | existing `freight_proposals` self-chain |
| `negotiation_acceptances` | proposal accepted event + capacity reservation + transport contract |
| `driver_vehicle_links` | existing `capacity_assignments` |
| `trip_loads` | `trip_transport_requests` |
| `load_profitability` | projection keyed by `transport_request_id` |
| generic `entity_tags` | typed tag joins for strong tenant-aware FKs |
| generic `document_links` | typed document joins for strong FKs |

## 21. Index standards for target tables

1. Tenant operational indexes normally begin with `tenant_id`.
2. Every FK used frequently for joins/filtering gets an index unless covered by a suitable leading prefix of an existing index.
3. Live-record uniqueness under soft delete uses partial unique indexes `WHERE deleted_at IS NULL`.
4. Time-series tables use `(tenant_id,subject_id,occurred_at/observed_at DESC)`; BRIN may complement B-tree only at meaningful scale.
5. JSONB gets GIN only for a defined query path; storing JSONB is not sufficient justification.
6. Search by human names/identifiers may later use normalized columns or trigram indexes, but only after query and extension policy is approved.
7. Avoid indexing low-cardinality booleans alone; combine with tenant and query-driving fields.

## 22. FK and delete-action standards

- Master roots referenced by history: `ON DELETE RESTRICT`.
- True dependent content that has no meaning without an uncommitted/draft parent may use `CASCADE`.
- Immutable history normally `RESTRICT`s the parent, or the parent itself is non-deletable.
- User actor FKs use `RESTRICT` so audit attribution is not erased.
- Tenant-owned FK pairs include tenant id on both sides whenever the parent is tenant-owned.
- Global lookup FKs reference only the lookup id and are protected by read-only privileges.

## 23. Definition of ready for physical implementation

A target table moves from this catalog to Drizzle/SQL only when its module wave is active and the PR includes: schema, migration, backfill if required, RLS/grants, API/domain invariants, unit/integration tests, cross-tenant negative tests, clean-schema replay and migration-upgrade test.

This prevents the catalog from becoming a request to create hundreds of premature empty tables while still guaranteeing that the product has a stable data architecture to grow into.
