# Nexora TMS — Master Data Catalog v1

**Status:** Proposed canonical engineering specification  
**Scope:** PostgreSQL/Neon data model, Drizzle schema, migrations, tenant isolation, lifecycle and audit  
**Baseline:** `main` through migration `0014_shocking_sentry`  
**Target sequence:** Cadastros → Cargas → Matching → Negociação → Viagens  

## 1. Purpose

This document is the canonical data-model contract for Nexora TMS. It consolidates the schema that already exists in the repository and defines the evolution rules that future tables must follow. The objective is to prevent parallel concepts, cross-tenant foreign keys, inconsistent deletion rules and repeated redesign while the product advances from master data to freight execution.

The catalog does **not** authorize production DDL by itself. Any physical change still requires a versioned migration, clean-schema test, tenant-isolation tests and the normal PR/release gates.

## 2. Sources of truth

The current physical model is defined by:

- `packages/database/src/schema/*.ts` — typed Drizzle schema;
- `packages/database/migrations/*.sql` — immutable, ordered migration history;
- `packages/database/migrations/meta/_journal.json` — migration ordering;
- ADR-0002 — application TenantContext + PostgreSQL RLS;
- ADR-0003 — Drizzle + versioned explicit SQL.

If documentation and executable schema disagree, the executable schema is the current-state truth; the catalog must then be corrected in the same PR that changes the schema.

## 3. Canonical naming and model decisions

The existing model is kept as the base. The following names are canonical and must not be duplicated by synonyms:

| Business concept | Canonical Nexora entity | Do not introduce as a parallel table |
| --- | --- | --- |
| Tenant | `tenants` | `companies`, `accounts` |
| Organization | `organizations` | `legal_entities` unless a future tax/legal distinction is explicitly required |
| Branch / operating unit | `business_units` | `branches` |
| Customer / carrier / supplier / shipper / consignee | `business_parties` + `business_party_roles` | separate `customers`, `carriers`, `suppliers` master tables |
| Party address | `business_party_addresses` | generic duplicate `addresses` for the same subject |
| Party contact | `business_party_contacts` | generic duplicate `contacts` for the same subject |
| Driver | `drivers` | `motorists` |
| Vehicle / implement | `capacity_assets` | separate `vehicles` and `implements` master tables unless specialization is later justified |
| Driver × active vehicle history | `capacity_assignments` | `driver_vehicle_links` |
| Freight/load request | `transport_requests` | parallel `loads` table for the same lifecycle |
| Freight stops | `transport_request_stops` | `load_stops` |
| Cargo summary | `transport_request_cargo_profiles` | `load_dimensions` as a competing summary |
| Commercial terms | `transport_request_commercial_terms` | ad-hoc price columns spread across modules |
| Proposal/counterproposal | `freight_proposals` | separate `counteroffers` table |
| Capacity reservation | `capacity_reservations` | `accepted_matches` as a second reservation aggregate |
| Transport contract | `transport_contracts` | `negotiation_acceptances` as another contract record |

## 4. PostgreSQL type standards

| Purpose | Standard |
| --- | --- |
| Primary identifiers | `uuid`, generated with `gen_random_uuid()` / Drizzle `defaultRandom()` |
| Tenant-owned FK | `uuid NOT NULL` plus composite tenant-aware FK whenever the parent is tenant-owned |
| Instants | `timestamptz` |
| Calendar-only dates | `date` |
| Money | `numeric(14,2)` for current operational values; new high-range financial ledgers may use `numeric(18,2)` |
| Weight / volume | `numeric(14,3)` unless a smaller bounded precision is explicitly justified |
| Dimensions | `numeric(10,3)` or smaller only when validated by domain limits |
| Currency | `varchar(3)` with ISO-4217 uppercase check |
| Country | `varchar(2)` with ISO-3166-1 alpha-2 uppercase check |
| State/UF | canonical geography FK when available; legacy `varchar(2)` accepted during transition |
| Statuses with small stable domain | PostgreSQL enum or checked varchar; do not mix both for the same aggregate |
| Flexible external payload | `jsonb`; not a substitute for core relational fields |
| Flags | `boolean NOT NULL` with explicit default when meaningful |
| Free text | bounded `varchar` for operational inputs; `text` only when no useful bound exists |

Floating-point types must not be used for money, freight, weight, cubage or dimensions.

## 5. Multi-tenant invariant

Every tenant-owned row must satisfy all of the following:

1. `tenant_id uuid NOT NULL`.
2. A tenant-owned root with a surrogate `id` exposes `UNIQUE (tenant_id, id)` so children can reference the tenant and id together.
3. A child referencing another tenant-owned table uses a composite FK such as `(tenant_id, party_id) -> business_parties(tenant_id, id)`. This prevents a valid ID from another tenant from being linked accidentally.
4. Tenant-selective indexes start with `tenant_id` unless a proven query plan requires another order.
5. Tenant business keys are unique inside the tenant, not globally, unless the concept is intentionally global.
6. RLS uses the session context `app.tenant_id`; user-sensitive access may additionally use `app.user_id`.
7. Runtime requests must set both session settings transaction-locally before tenant-owned queries.
8. Global reference tables are read-only to the runtime role and do not receive a fake `tenant_id`.
9. Cross-tenant reporting is not implemented by weakening normal RLS; it requires a dedicated privileged path and explicit authorization.

### RLS policy baseline

For normal tenant-owned mutable tables:

```sql
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
```

`memberships` remains a special case because a user may need to resolve their own memberships through `app.user_id` before a tenant is fully selected.

## 6. Lifecycle and soft-delete policy

Soft delete is a **data-lifecycle policy**, not a universal column added blindly to every table.

| Class | Examples | Required lifecycle |
| --- | --- | --- |
| Mutable master records | `business_parties`, party addresses/contacts, `drivers`, `capacity_assets`, future `locations` | Add `deleted_at timestamptz`, `deleted_by_user_id uuid`, optional `delete_reason`; normal reads exclude deleted rows. Business `status` remains independent from deletion. |
| Organizational configuration | `organizations`, `business_units`, tenant-owned lookup/config records | Prefer `is_active` for reversible business deactivation. Add soft delete only when users can remove records from the catalog while history must retain the row. |
| Workflow aggregates | transport requests, proposals, reservations, contracts, trips | Do **not** use soft delete for business cancellation. Use explicit status/event. Administrative deletion, if ever allowed, is a separate exceptional policy. |
| Immutable events/history/audit | `*_events`, `*_history`, `*_audit`, future `audit_events` | Append-only. No soft delete and no routine update/delete permission. |
| Pure current-state association | some RBAC join tables | Hard delete is acceptable when the relationship has no legal/operational history requirement. |

When a master table uses `deleted_at`, business-key uniqueness must normally become a **partial unique index** over live rows, e.g. `WHERE deleted_at IS NULL`, so a deleted record does not permanently reserve a reusable tenant-local code unless regulation requires otherwise.

## 7. Audit standard

Nexora uses two complementary audit layers:

- **Domain audit/history:** immutable snapshots/events close to regulated or operational aggregates (`business_party_audit`, `driver_audit`, commercial history, proposal/reservation/contract events).
- **Platform audit:** target `audit_events` table for who/what/when/request/IP/correlation trace across modules.

New mutable business tables must record `created_at`, `updated_at`, and when actions are user-driven, `created_by_user_id` / `updated_by_user_id`. Soft deletes require `deleted_at` / `deleted_by_user_id`. Audit/event tables use `actor_user_id` and are append-only.

`business_party_audit.actor_user_id` is currently not protected by an explicit FK in the Drizzle definition. The catalog classifies this as a consistency gap to be corrected in the first safe foundation migration after review.

## 8. Current baseline inventory — 34 tables

### 8.1 Platform / tenancy

#### `tenants`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `slug varchar(80)`; `name varchar(200)`; `status tenant_status`; `created_at timestamptz`; `updated_at timestamptz`.
- **Keys/indexes:** unique `slug`.
- **RLS:** tenant isolation comparing the row `id` with `app.tenant_id`.
- **Cardinality:** tenant 1:N organizations, memberships, roles and every tenant-owned business aggregate.
- **Lifecycle:** suspend with `status`; no routine deletion.

#### `organizations`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `tenant_id uuid`; `code varchar(80)`; `name varchar(200)`; `is_active boolean`; `created_at timestamptz`; `updated_at timestamptz`.
- **FK:** `tenant_id -> tenants.id` (`RESTRICT`).
- **Keys/indexes:** unique `(tenant_id,id)`; unique `(tenant_id,code)`; index `(tenant_id)`.
- **RLS:** tenant isolation.
- **Cardinality:** tenant 1:N organizations; organization 1:N business units.

#### `business_units`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `tenant_id uuid`; `organization_id uuid`; `parent_business_unit_id uuid NULL`; `code varchar(80)`; `name varchar(200)`; `is_active boolean`; `created_at timestamptz`; `updated_at timestamptz`.
- **FKs:** `(tenant_id,organization_id) -> organizations(tenant_id,id)`; recursive `(tenant_id,organization_id,parent_business_unit_id) -> business_units(tenant_id,organization_id,id)`.
- **Keys/indexes:** unique `(tenant_id,id)`; unique `(tenant_id,organization_id,id)`; unique `(tenant_id,organization_id,code)`; index `(tenant_id,organization_id)`.
- **RLS:** tenant isolation.
- **Cardinality:** organization 1:N units; unit 0/1:N child units.

#### `tenant_settings`
- **PK/FK:** `tenant_id uuid -> tenants.id` (`CASCADE`).
- **Fields:** `tenant_id uuid`; `settings jsonb`; `created_at timestamptz`; `updated_at timestamptz`.
- **RLS:** tenant isolation.
- **Cardinality:** tenant 1:1 settings.

### 8.2 Identity / IAM

#### `users`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `display_name varchar(200) NULL`; `status user_status`; `created_at timestamptz`; `updated_at timestamptz`.
- **Scope:** platform identity, intentionally not tenant-owned.
- **Cardinality:** user 1:N external identities and memberships.

#### `external_identities`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `user_id uuid`; `provider varchar(80)`; `subject varchar(255)`; `created_at timestamptz`; `last_seen_at timestamptz NULL`.
- **FK:** `user_id -> users.id` (`CASCADE`).
- **Keys/indexes:** unique `(provider,subject)`; unique `(user_id,provider)`; index `(user_id)`.
- **Cardinality:** user 1:N identities, at most one identity per provider.

#### `memberships`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `tenant_id uuid`; `user_id uuid`; `status membership_status`; `invited_at timestamptz NULL`; `joined_at timestamptz NULL`; `created_at timestamptz`; `updated_at timestamptz`.
- **FKs:** tenant and user, both `RESTRICT`.
- **Keys/indexes:** unique `(tenant_id,id)`; unique `(tenant_id,user_id)`; index `(user_id)`; index `(tenant_id,status)`.
- **RLS:** select by matching tenant **or own user**; writes by tenant.
- **Cardinality:** tenant N:M user through membership.

#### `permissions`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `key varchar(160)`; `description varchar(300) NULL`; `created_at timestamptz`.
- **Key:** globally unique `key`.
- **Scope:** global platform reference.

#### `roles`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `tenant_id uuid`; `code varchar(80)`; `name varchar(160)`; `description varchar(300) NULL`; `created_at timestamptz`; `updated_at timestamptz`.
- **FK:** tenant.
- **Keys/indexes:** unique `(tenant_id,id)`; unique `(tenant_id,code)`; index `(tenant_id)`.
- **RLS:** tenant isolation.

#### `role_permissions`
- **PK:** `(tenant_id,role_id,permission_id)`.
- **Fields:** `tenant_id uuid`; `role_id uuid`; `permission_id uuid`; `created_at timestamptz`.
- **FKs:** `(tenant_id,role_id) -> roles`; `permission_id -> permissions.id`.
- **Index:** `permission_id`.
- **RLS:** tenant isolation.
- **Cardinality:** roles N:M permissions.

#### `membership_roles`
- **PK:** `(tenant_id,membership_id,role_id)`.
- **Fields:** tenant, membership, role, `created_at timestamptz`.
- **FKs:** tenant-aware membership and role, `CASCADE`.
- **Index:** `(tenant_id,role_id)`.
- **RLS:** tenant isolation.
- **Cardinality:** memberships N:M roles.

#### `membership_organization_scopes`
- **PK:** `(tenant_id,membership_id,organization_id)`.
- **Fields:** tenant, membership, organization, `created_at timestamptz`.
- **FKs:** tenant-aware membership and organization.
- **Index:** `(tenant_id,organization_id)`.
- **RLS:** tenant isolation.

#### `membership_business_unit_scopes`
- **PK:** `(tenant_id,membership_id,business_unit_id)`.
- **Fields:** tenant, membership, unit, `created_at timestamptz`.
- **FKs:** tenant-aware membership and business unit.
- **Index:** `(tenant_id,business_unit_id)`.
- **RLS:** tenant isolation.

### 8.3 Master data / business parties

#### `business_parties`
- **PK:** `id uuid`.
- **Fields:** `id uuid`; `tenant_id uuid`; `tax_id varchar(20)`; `legal_name varchar(200)`; `trade_name varchar(200) NULL`; `email varchar(254) NULL`; `phone varchar(32) NULL`; `status business_party_status`; `homologation_status business_party_homologation_status NULL`; `homologation_notes varchar(500) NULL`; timestamps.
- **FK:** tenant.
- **Keys/indexes:** unique `(tenant_id,id)`; unique `(tenant_id,tax_id)`; `(tenant_id,status)`; `(tenant_id,homologation_status)`.
- **RLS:** tenant isolation.
- **Cardinality:** party 1:N roles, addresses, contacts; party may be referenced as customer/shipper/consignee/carrier/owner/supplier.
- **Target lifecycle:** soft-delete capable plus independent business status.

#### `business_party_roles`
- **PK:** `(tenant_id,party_id,role)`.
- **Fields:** tenant, party, `role varchar(32)`, `created_at timestamptz`.
- **FK:** tenant-aware party, `CASCADE`.
- **Constraint:** role ∈ `customer|shipper|consignee|carrier|partner|supplier`.
- **Index:** `(tenant_id,role)`.
- **RLS:** tenant isolation.
- **Cardinality:** one party 1:N role records.

#### `business_party_audit`
- **PK:** `id uuid`.
- **Fields:** tenant, party, `actor_user_id uuid`; `change_type varchar(32)`; `before_snapshot jsonb NULL`; `after_snapshot jsonb`; `created_at timestamptz`.
- **FK:** tenant-aware party (`RESTRICT`).
- **Constraint:** change type `created|updated`.
- **Index:** `(tenant_id,party_id,created_at)`.
- **RLS:** tenant isolation.
- **Lifecycle:** immutable; target fix adds actor FK to `users`.

#### `business_party_addresses`
- **PK:** `id uuid`.
- **Fields:** `tenant_id`; `party_id`; `type varchar(32)`; `label varchar(160)`; `postal_code varchar(16) NULL`; `street varchar(200)`; `number varchar(40) NULL`; `complement varchar(160) NULL`; `district varchar(120) NULL`; `city varchar(120)`; `state varchar(2)`; `country_code varchar(2)`; `operational_reference varchar(500) NULL`; `is_active boolean`; timestamps.
- **FK:** tenant-aware party (`RESTRICT`).
- **Keys/indexes:** unique `(tenant_id,party_id,id)`; `(tenant_id,party_id,is_active)`; `(tenant_id,city,state)`.
- **Constraints:** controlled address type; uppercase state/country format.
- **RLS:** tenant isolation.
- **Target lifecycle:** retain `is_active` and add soft-delete metadata for user removal.

#### `business_party_contacts`
- **PK:** `id uuid`.
- **Fields:** tenant, party, `address_id uuid NULL`; `type varchar(32)`; `name varchar(160)`; `title varchar(120) NULL`; `email varchar(254) NULL`; `phone varchar(32) NULL`; `whatsapp varchar(32) NULL`; `operational_reference varchar(500) NULL`; `is_active boolean`; timestamps.
- **FKs:** tenant-aware party and optional tenant/party/address.
- **Keys/indexes:** unique `(tenant_id,party_id,id)`; `(tenant_id,party_id,is_active)`; `(tenant_id,address_id)`.
- **Constraints:** controlled contact type; at least one of email/phone/WhatsApp.
- **RLS:** tenant isolation.

### 8.4 Capacity / drivers / assets

#### `drivers`
- **PK:** `id uuid`.
- **Fields:** tenant; `carrier_party_id uuid NULL`; `full_name varchar(180)`; `tax_id varchar(11)`; `email varchar(254) NULL`; `phone varchar(32)`; `whatsapp varchar(32) NULL`; `cnh_number varchar(11)`; `cnh_category varchar(4)`; `cnh_expires_on date`; registration and operational status enums; `status_reason varchar(500) NULL`; created/updated user FKs; timestamps.
- **FKs:** optional tenant-aware carrier; creator/updater -> users.
- **Keys/indexes:** unique tenant+tax id; tenant+CNH; tenant+id; indexes by registration status, operational status and carrier.
- **Constraints:** CPF/CNH digit format; supported CNH category; name/phone minimums; active operational status requires qualified registration; blocked/inactive requires reason.
- **RLS:** tenant isolation.
- **Target lifecycle:** soft-delete capable.

#### `driver_audit`
- **PK:** id.
- **Fields:** tenant; driver; actor user; `change_type`; before/after JSON snapshots; created timestamp.
- **FKs:** tenant-aware driver; actor -> users.
- **Constraint:** `created|updated|status_changed`.
- **Index:** `(tenant_id,driver_id,created_at)`.
- **Lifecycle:** immutable.

#### `capacity_assets`
- **PK:** `id uuid`.
- **Fields:** tenant; optional carrier/owner party; `owner_name`; `asset_kind capacity_asset_kind`; `identifier varchar(64)`; `plate varchar(7) NULL`; `vehicle_type varchar(80)`; `body_type varchar(80)`; `capacity_weight_kg numeric(12,3)`; `capacity_volume_m3 numeric(12,3) NULL`; max dimensions `numeric(8,3)`; `tracking_available boolean`; status enum; reason; created/updated users; timestamps.
- **FKs:** tenant-aware carrier and owner; creators -> users.
- **Keys/indexes:** unique tenant+identifier, tenant+plate, tenant+id; indexes by status, carrier, vehicle/body type and tracking.
- **Constraints:** plate format; positive capacity; dimensions all-null or all-positive; owner source required; blocked requires reason.
- **RLS:** tenant isolation.
- **Target:** normalize `vehicle_type` and `body_type` to catalog FKs without breaking existing values; soft-delete capable.

#### `capacity_asset_audit`
- **PK:** id.
- **Fields:** tenant; asset; actor; change type; before/after JSON; created timestamp.
- **FKs:** tenant-aware asset; actor -> users.
- **Constraint:** `created|updated|status_changed`.
- **Index:** tenant+asset+created.
- **Lifecycle:** immutable.

#### `capacity_assignments`
- **PK:** id.
- **Fields:** tenant; driver; vehicle; carrier party; status; `starts_at`; `ends_at NULL`; reason; created/updated users; timestamps.
- **FKs:** tenant-aware driver, capacity asset and carrier; creator/updater -> users.
- **Keys/indexes:** unique tenant+id; partial unique live assignment per driver and per vehicle; history indexes for driver/vehicle; carrier/status index.
- **Constraints:** valid period; active assignment has no end; ended/cancelled has end; cancellation requires reason.
- **RLS:** tenant isolation.
- **Lifecycle:** temporal workflow, no soft delete.
- **Gap:** `vehicle_id` references generic `capacity_assets`; a future constraint/service invariant must guarantee `asset_kind='vehicle'` for this role.

### 8.5 Freight / Cargas

#### `transport_requests`
- **PK:** id.
- **Fields:** tenant; customer, shipper, consignee party IDs; origin/destination address IDs; planned pickup/delivery timestamps; `cargo_description varchar(1000)`; request status; created/updated users; timestamps.
- **FKs:** all business subjects and addresses are tenant-aware; users are global.
- **Keys/indexes:** unique tenant+id; indexes tenant+status, tenant+pickup, tenant+customer.
- **Constraints:** delivery >= pickup; origin and destination addresses distinct.
- **RLS:** tenant isolation.
- **Cardinality:** request 1:N stops; 0/1 cargo profile; 0/1 commercial terms; 0:N proposals; 0/1 active reservation; 0/1 confirmed contract.
- **Design rule:** origin/destination columns are the canonical primary endpoints while stops represent the complete route. Future write logic must validate that primary endpoints and first/last operational stops remain consistent.

#### `transport_request_stops`
- **PK:** id.
- **Fields:** tenant; request; `sequence integer`; stop type; party; address; optional contact; window start/end; instructions; timestamps.
- **FKs:** tenant-aware request/address/contact.
- **Keys/indexes:** unique tenant+request+id; unique tenant+request+sequence; route sequence index; window index.
- **Constraints:** sequence > 0; window end >= start.
- **RLS:** tenant isolation.

#### `transport_request_cargo_profiles`
- **PK:** id.
- **Fields:** tenant; request; material; cargo type; `total_weight_kg numeric(14,3)`; volume/pallet counts; `cubage_m3 numeric(14,3) NULL`; max dimensions `numeric(10,3)`; tracking required; vehicle/body type; non-stackable; special-cargo flag/instructions; timestamps.
- **FK:** tenant-aware request (`CASCADE`).
- **Key:** unique `(tenant_id,transport_request_id)` => request 1:0/1 profile.
- **Indexes:** tenant+vehicle/body; tenant+weight.
- **Constraints:** positive weight; non-negative package counts with at least one count > 0; positive optional cubage/dimensions; non-empty classification; special cargo requires instructions.
- **RLS:** tenant isolation.

#### `transport_request_commercial_terms`
- **PK:** id.
- **Fields:** tenant; request; currency; customer price nullable; target carrier freight; toll; additional amount; payment terms; notes; approval status/note/user/time; version; created/updated users; timestamps.
- **FKs:** request; approval/creator/updater users.
- **Keys:** unique tenant+request; unique tenant+id.
- **Indexes:** tenant+status.
- **Constraints:** valid currency; non-negative monetary supplements; carrier freight > 0; version > 0; approved requires user/time.
- **RLS:** tenant isolation.

#### `transport_request_commercial_history`
- **PK:** id.
- **Fields:** tenant; request; commercial terms; version; event type; status; actor; snapshot JSON; note; created timestamp.
- **FKs:** request, terms, actor.
- **Key:** unique tenant+terms+version.
- **Constraint:** event type `created|updated|submitted|approved|rejected`.
- **Index:** request/version.
- **Lifecycle:** immutable.

### 8.6 Negotiation / capacity reservation / contract

#### `freight_proposals`
- **PK:** id.
- **Fields:** tenant; request; capacity assignment; carrier; optional parent proposal; sequence; kind; currency; freight/toll/additional amounts; payment terms; notes; expiry; author; created timestamp.
- **FKs:** tenant-aware request, assignment, carrier and parent proposal; author -> users.
- **Keys/indexes:** unique tenant+id; unique tenant+request+sequence; request/assignment/carrier timeline indexes.
- **Constraints:** positive sequence/freight; non-negative supplements; valid currency; counterproposal requires parent and root proposal forbids parent.
- **RLS:** tenant isolation.
- **Cardinality:** request 1:N proposals; proposal 0:N child counterproposals.

#### `freight_proposal_events`
- **PK:** id.
- **Fields:** tenant; proposal; status; actor; reason; created timestamp.
- **FK:** proposal; actor.
- **Key:** one event of each status per proposal.
- **Constraint:** rejection requires reason.
- **Index:** proposal timeline.
- **Lifecycle:** immutable.

#### `capacity_reservations`
- **PK:** id.
- **Fields:** tenant; request; proposal; capacity assignment; driver; vehicle; carrier; status; approval user/time; optional cancellation user/time/reason; timestamps.
- **FKs:** all tenant-aware operational subjects; actor users global.
- **Keys/indexes:** unique tenant+id; partial unique active reservation per request, assignment, driver and vehicle; request history; carrier/status.
- **Constraint:** active vs cancelled state tuple is internally consistent.
- **RLS:** tenant isolation.

#### `capacity_reservation_events`
- **PK:** id.
- **Fields:** tenant; reservation; event type; actor; reason; created timestamp.
- **FK:** reservation; actor.
- **Constraint:** cancelled event requires reason.
- **Index:** reservation timeline.
- **Lifecycle:** immutable.

#### `transport_contracts`
- **PK:** id.
- **Fields:** tenant; request; reservation; proposal; assignment; driver; vehicle; carrier; status; currency; freight/toll/additional amounts; payment terms; notes; confirmed/refused/cancelled actor/time/reason fields; timestamps.
- **FKs:** all tenant-aware operational references plus global user actors.
- **Keys/indexes:** unique tenant+id; unique tenant+reservation; partial unique confirmed contract per request/assignment/driver/vehicle; request history; carrier/status.
- **Constraints:** valid currency/amounts/payment terms; confirmed/refused/cancelled state tuple is mutually consistent.
- **RLS:** tenant isolation.

#### `transport_contract_events`
- **PK:** id.
- **Fields:** tenant; contract; type; actor; reason; created timestamp.
- **FK:** contract; actor.
- **Key:** one event of each type per contract.
- **Constraint:** refused/cancelled require reason.
- **Index:** contract timeline.
- **Lifecycle:** immutable.

## 9. Cardinality overview

```text
Tenant 1 ── N Organization 1 ── N BusinessUnit
Tenant N ── M User          via Membership
Membership N ── M Role      via MembershipRole
Role N ── M Permission      via RolePermission

BusinessParty 1 ── N Address
BusinessParty 1 ── N Contact
BusinessParty 1 ── N BusinessPartyRole
BusinessParty 1 ── N Driver (optional carrier relation)
BusinessParty 1 ── N CapacityAsset (carrier/owner relation)
Driver 1 ── N CapacityAssignment N ── 1 CapacityAsset

TransportRequest 1 ── N TransportRequestStop
TransportRequest 1 ── 0..1 CargoProfile
TransportRequest 1 ── 0..1 CommercialTerms
CommercialTerms 1 ── N CommercialHistory
TransportRequest 1 ── N FreightProposal
FreightProposal 1 ── N ProposalEvent
TransportRequest 1 ── 0..1 ACTIVE CapacityReservation
CapacityReservation 1 ── N ReservationEvent
CapacityReservation 1 ── 0..1 TransportContract
TransportContract 1 ── N ContractEvent
```

## 10. Data-model gaps to close before scaling modules

| Gap | Decision |
| --- | --- |
| Vehicle/body/cargo classification stored as free text | Introduce canonical lookup tables; migrate incrementally while preserving compatibility. |
| No first-class cargo items/packages | Add item/package tables; retain cargo profile as aggregate summary. |
| No persisted matching run/candidate explanation | Add matching persistence before Matching is considered production-complete. |
| No first-class trip aggregate | Add Trips only after Cargas/Matching/Negociação contracts are stable. |
| No universal document model | Add document metadata/version model plus strongly typed subject link tables. |
| No transversal soft-delete standard | Apply only to mutable master records under the rules in section 6. |
| Per-entity audits exist but no platform audit trail | Add append-only `audit_events` later; keep domain history tables. |
| Party audit actor lacks explicit FK | Add safe FK to `users` after existing data validation. |
| Current primary origin/destination coexist with detailed stops | Enforce consistency in service validation and later add a DB validation strategy if safe. |
| Generic asset can be referenced as `vehicle_id` | Enforce vehicle-kind invariant before high-volume matching/trip execution. |

## 11. Migration order

### 11.1 Immutable current baseline

Do not renumber, squash or rewrite the existing migration history:

```text
0000_past_enchantress
0001_runtime_app_privileges
0002_conscious_midnight
0003_fearless_zzzax
0004_chilly_shaman
0005_brainy_weapon_omega
0006_closed_karnak
0007_young_slyde
0008_high_dragon_lord
0009_amused_micromax
0010_first_drax
0011_naive_wildside
0012_yummy_maggott
0013_gifted_klaw
0014_shocking_sentry
```

### 11.2 Planned evolution after the baseline

| Migration wave | Scope | Dependency |
| --- | --- | --- |
| `0015_*` | Catalog foundations: geography references, units, vehicle/body/cargo/package/document types, tag/config primitives; safe audit FK correction | 0014 |
| `0016_*` | Cadastros enrichment: locations, party groups/requirements, cost centers/departments, custom fields; soft-delete metadata on approved master entities | 0015 |
| `0017_*` | Driver/asset qualification: documents, courses, capabilities, availability, inspections, insurance/maintenance foundations | 0016 |
| `0018_*` | Document core: documents, versions, validations and typed links to party/driver/asset/request | 0017 |
| `0019_*` | Cargas normalization: request items, packages, references, requirements, status history/events, freight lanes; lookup FKs staged without destructive free-text removal | 0018 |
| `0020_*` | Matching persistence: runs, candidates, scores/rule results, rejections and match-policy configuration | 0019 |
| `0021_*` | Negociação completion: participant/message thread where required, negotiation audit consistency and invariants around accepted proposal/reservation | 0020 |
| `0022_*` | Viagens core: trips, trip-request links, stops, drivers/assets and status history | 0021 |
| `0023_*` | Viagens execution: events, check-ins, locations, expenses/tolls/fuel, proofs/POD and trip documents | 0022 |
| `0024_*` | Cross-cutting audit/outbox and high-volume operational indexes | 0023 |
| `0025+` | Pricing, finance, occurrences, communications, automation, integrations and analytics according to roadmap | 0024 |

Migration names are generated by the project tooling; the numbers above define required dependency order, not final suffix text.

## 12. Migration safety rules

- Additive-first; avoid destructive rename/drop in the same release that introduces replacements.
- New nullable columns first when backfill is required; validate data before `NOT NULL`.
- Large FKs/checks should use a validate-after-create strategy when PostgreSQL locking risk is relevant.
- Large indexes should use `CREATE INDEX CONCURRENTLY` through explicit SQL where transaction behavior permits.
- New tenant-owned tables are not complete until RLS, grants and negative cross-tenant tests are included.
- Do not use `CASCADE` from long-lived business roots when it could erase legal/operational history. `CASCADE` is reserved for true dependent rows whose independent existence is invalid.
- All migrations must pass clean-schema replay from 0000 and upgrade tests from the immediately previous production baseline.

## 13. Acceptance gates for each new table

A table is implementation-ready only when all applicable items below are explicit in the PR:

- domain owner and business purpose;
- PK and business keys;
- tenant ownership/global scope;
- all FKs and cardinalities;
- field types/defaults/nullability;
- indexes justified by query paths;
- check/unique constraints;
- RLS policy and runtime grants;
- lifecycle: active/status/soft-delete/immutable;
- audit strategy;
- migration dependency and rollback/forward-fix strategy;
- API/service validation impact;
- clean migration, RLS isolation and repository tests.

## 14. Target catalog

The complete complementary target tables, their standard columns, keys, indexes, lifecycle and module/wave classification are specified in `docs/data/master-data-catalog-target-v1.md`.

That companion specification is normative for new work. Tables marked **Future** are reserved architecture and must not be created before their roadmap wave merely because they appear in the catalog.
