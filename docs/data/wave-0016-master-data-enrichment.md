# Wave 0016 — Cadastros Enriquecidos

## Status

Implementation baseline prepared for merge after the PR gates complete on the final documentation head.

## Objective

Extend the canonical master-data model with reusable operational locations, organizational dimensions, customer/carrier grouping and requirements, tenant customization and lifecycle controls without duplicating existing Nexora TMS aggregate roots.

## Physical database additions

### Global reference

- `currencies`

### Tenant-owned with RLS

- `departments`
- `cost_centers`
- `number_sequences`
- `module_settings`
- `feature_flags`
- `locations`
- `business_party_groups`
- `business_party_group_members`
- `business_party_requirements`
- `business_party_document_requirements`
- `business_party_service_areas`
- `business_party_billing_rules`
- `business_party_credit_limits`
- `commodities`
- `business_party_tags`
- `driver_tags`
- `capacity_asset_tags`
- `transport_request_tags`
- `custom_field_definitions`
- `custom_field_values`

Wave 0016 therefore adds 21 physical tables, of which 20 are tenant-scoped and protected by RLS.

## Migration

- `packages/database/migrations/0016_wooden_thunderball.sql`
- `packages/database/migrations/meta/0016_snapshot.json`
- migration journal updated with the `0016` entry

The migration is additive. It does not drop, truncate, rename or destructively convert existing structures.

## Runtime privilege model

`nexora_app` receives:

- `SELECT` on `currencies`;
- `SELECT`, `INSERT` and `UPDATE` on the 20 tenant-owned Wave 0016 tables;
- no physical `DELETE` privilege on those tables.

Global currency maintenance remains an administrative/migration concern.

## Multi-tenant model

Every tenant-owned Wave 0016 table carries `tenant_id` and uses the standard Nexora RLS session context. Cross-references to tenant-owned roots use tenant-aware composite FKs where applicable.

The database PR gate baseline after Wave 0016 is:

- 65 application tables;
- 57 RLS-enabled tenant tables;
- 17 versioned Drizzle migrations.

## Reused roots

The Wave deliberately reuses rather than replaces:

- `organizations` and `business_units`;
- `business_parties`;
- `business_party_addresses` and `business_party_contacts`;
- `drivers`;
- `capacity_assets`;
- `transport_requests`.

This preserves the source-of-truth decisions established by ADR-0012.

## API additions

The tenant-aware API facade is exposed under `api/v1/master-data`.

Implemented capabilities include:

- list/create locations;
- location activation/inactivation lifecycle;
- list/create departments and cost centers;
- list/create commodities;
- list/create business-party groups;
- activate/inactivate business-party group membership;
- list/create business-party requirements;
- list/create controlled custom-field definitions;
- upsert controlled custom-field values;
- activate/inactivate typed tag links for business parties, drivers, assets and transport requests;
- atomic tenant-scoped number allocation;
- upsert tenant module settings and feature flags.

## Extensibility rules

Custom fields are the only intentionally polymorphic Wave 0016 value model. The API accepts only statically whitelisted entity types and verifies target existence inside the tenant transaction before persistence.

Tags are not generic polymorphic links. They use typed relational join tables so their FKs remain explicit.

JSONB is reserved for extension/configuration payloads and is not used to replace core relational domain facts.

## Validation gates

The Wave is not considered complete until the final PR head passes:

- repository lint;
- Prettier check;
- TypeScript typecheck;
- API/unit tests;
- monorepo build;
- Drizzle generation and consistency check;
- versioned migration artifact verification;
- full clean replay through migration `0016` on isolated Neon;
- schema/RLS/migration-ledger baseline verification;
- runtime privilege checks;
- Wave 0016 `locations` positive and negative RLS scenarios;
- TenantContext integration against `nexora_app`;
- OIDC identity-mapping regression gate;
- Matching, freight proposal, capacity reservation and transport-contract regression integrations;
- tenant-aware FK rejection;
- ephemeral Neon branch cleanup.

## External operational blocker

Direct inspection/promotion of the shared Neon `development` and `staging` branches is currently blocked by an argument-schema mismatch in the connected Neon tool. GitHub Actions isolated Neon branches remain the safe real-database validation route. Shared promotion must be resumed through the standard Development → Staging flow when the connector issue is corrected.

## Next dependency

Once merged and post-merge CI is green, Wave 0017 extends the existing `drivers`, `capacity_assets` and `capacity_assignments` roots with qualifications, capabilities, availability, maintenance, insurance, inspection and operational blocking/history data. Full generic document storage/versioning remains reserved for Wave 0018.
