# ADR-0015 — Canonical Document Core, Versioning and Storage Boundary

- **Status:** Accepted
- **Date:** 2026-08-30
- **Wave:** 0018
- **Related:** ADR-0002, ADR-0003, ADR-0009, ADR-0012, ADR-0014
- **Jira:** NEX-10, NEX-46, NEX-47

## Context

Wave 0017 introduced operational document registers for drivers and capacity assets. Those registers intentionally contain qualification facts such as document type, number, issuer, validity dates and operational status, but do not own binary files or file version history.

Wave 0018 needs a single document aggregate that can be reused by parties, drivers, assets, transport requests and future trips without creating one storage model per domain. It must preserve tenant isolation, immutable file history and the provider-neutral object-storage decision from ADR-0009.

## Decision

Nexora adopts `documents` as the canonical metadata root for stored documents.

The document aggregate is composed of:

- `documents` — mutable current metadata and lifecycle state;
- `document_versions` — immutable object versions with content metadata and SHA-256;
- `document_validations` — append-only validation decisions;
- typed relation tables instead of a generic polymorphic entity type/id pair;
- existing Wave 0017 driver/asset document registers linked to the canonical root through nullable tenant-aware `document_id` foreign keys.

### Binary storage

PostgreSQL must not store document binary payloads.

Binary content is stored behind `DocumentStoragePort`. Application services know only opaque upload identifiers, provider/key metadata returned after verification and short-lived authorized download URLs.

The API must fail closed when no concrete storage adapter is configured. It must not silently fall back to local disk, public buckets or unsigned permanent URLs.

### Upload lifecycle

The controlled upload flow is:

1. create the `documents` metadata root;
2. authorize the request in tenant context;
3. request an upload target through `DocumentStoragePort.prepareUpload`;
4. upload directly to object storage using the short-lived target;
5. commit using the opaque upload identifier;
6. verify the object through `DocumentStoragePort.verifyUpload`;
7. lock the document aggregate and allocate the next version number;
8. persist an immutable `document_versions` row with byte size, MIME type, storage locator and SHA-256;
9. transition current document status according to validation and expiry rules.

### Versioning

`document_versions` is append-only for the application runtime.

A version contains:

- monotonic `version_number` per document;
- original file name and MIME type;
- byte size;
- lowercase hexadecimal SHA-256;
- storage provider and opaque storage key;
- source (`upload`, `import`, `generated`, `integration`);
- metadata and creator/time.

A storage object may appear only once per tenant/provider/key.

### Validation

`document_validations` is append-only. A validation may target the document as a whole or a specific version, but a version reference is accepted only when it belongs to that same document and tenant.

Manual validation requires an actor. The current document status is derived from the latest accepted operation, while the validation history remains immutable.

### Typed links

Wave 0018 implements typed links for:

- business party → `business_party_documents`;
- driver → existing `driver_documents.document_id`;
- capacity asset → existing `capacity_asset_documents.document_id`;
- transport request → `transport_request_documents`.

Trip links are deferred until the canonical `trips` root exists in Wave 0022.

A document type's `subject_scope` must be compatible with the linked entity or be `other`.

### Deletion and retention

`documents` uses controlled soft delete with `deleted_at`, `deleted_by_user_id` and mandatory `delete_reason`.

Soft deleting the root does not remove versions, validations or typed links. Those records remain available for audit/retention and cannot be deleted by `nexora_app`.

Physical binary retention/deletion is a later policy-driven storage concern and must not be coupled to a normal application delete request.

## Security consequences

- all new document tables are tenant-scoped and protected by PostgreSQL RLS;
- `nexora_app` receives no DELETE on Wave 0018 tables;
- append-oriented tables receive only `SELECT` and `INSERT`;
- `documents` receives `SELECT`, `INSERT` and `UPDATE` for controlled lifecycle changes;
- cross-tenant relations are rejected by composite foreign keys and RLS;
- storage URLs are short-lived and never persisted as canonical database state;
- object storage credentials and raw binary payloads are never written to audit snapshots.

## Operational consequences

A concrete object-storage adapter is an environment capability. Until configured, metadata and database workflows remain available but upload/download operations return a controlled service-unavailable response rather than using an insecure fallback.

## Rejected alternatives

### Store binaries in PostgreSQL

Rejected because it couples transactional database scaling, backup and retention to large immutable objects.

### Generic `entity_type` + `entity_id` links

Rejected because PostgreSQL cannot enforce tenant-aware referential integrity to multiple entity tables through a generic identifier.

### Separate binary/version roots per business domain

Rejected because it duplicates storage/versioning semantics and makes retention, validation and auditing inconsistent.

### Replace Wave 0017 document registers

Rejected because the registers hold domain qualification state. They are evolved by linking to the canonical document root instead of being replaced.

## Validation

Wave 0018 is complete only when CI and the Neon gate prove:

- full migration replay through 0018;
- 89 application tables, 81 RLS tables and 19 migration ledger rows;
- runtime privilege matrix for mutable vs append-only document tables;
- tenant isolation and cross-tenant FK rejection;
- immutable version and validation history;
- validation/version same-document integrity;
- driver and asset typed-link integrity;
- no destructive rewrite of migrations 0000–0017;
- API typecheck, tests and build.
