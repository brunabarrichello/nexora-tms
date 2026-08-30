# Wave 0018 — Document Core, Versions, Validations and Typed Links

## Status

Implementation branch: `feat/database-wave-0018-documents`

Base: green `main` commit `f33fe8ef2824d0b56a14865360f40a603e0668e1`.

Migration: `0018_tired_exodus.sql`.

Target physical baseline after migration:

- **89** application tables;
- **81** tenant-scoped RLS tables;
- **19** Drizzle migration ledger rows.

## Objective

Create the canonical document aggregate without duplicating the qualification registers delivered in Wave 0017 and without coupling application logic to a concrete object-storage provider.

## New tables

### `documents`

Canonical mutable metadata root.

Important fields:

- `tenant_id`;
- `document_type_id`;
- title;
- status;
- issue/expiry dates;
- external reference and notes;
- JSON metadata;
- created/updated actor fields;
- controlled soft-delete fields.

Allowed statuses:

- `draft`;
- `pending`;
- `valid`;
- `rejected`;
- `expired`;
- `archived`.

Runtime permissions: `SELECT`, `INSERT`, `UPDATE`; no `DELETE`.

### `document_versions`

Immutable content-version registry.

Stores object metadata only:

- version number;
- original file name;
- MIME type;
- byte size;
- SHA-256;
- storage provider;
- opaque storage key;
- source and metadata;
- creator/time.

Runtime permissions: `SELECT`, `INSERT`; no `UPDATE` or `DELETE`.

### `document_validations`

Append-only validation decisions with optional specific-version reference.

The composite FK `(tenant_id, document_id, document_version_id)` prevents a validation from pointing to a version that belongs to another document.

Runtime permissions: `SELECT`, `INSERT`; no `UPDATE` or `DELETE`.

### `business_party_documents`

Typed party/document relationship.

Relation types:

- `registration`;
- `compliance`;
- `contract`;
- `insurance`;
- `other`.

Runtime permissions: `SELECT`, `INSERT`; no `UPDATE` or `DELETE`.

### `transport_request_documents`

Typed transport-request/document relationship.

Relation types:

- `request`;
- `commercial`;
- `compliance`;
- `reference`;
- `other`.

Runtime permissions: `SELECT`, `INSERT`; no `UPDATE` or `DELETE`.

## Wave 0017 evolution

No parallel driver/asset document tables are created.

Existing tables are evolved additively:

- `driver_documents.document_id → documents.id` through tenant-aware composite FK;
- `capacity_asset_documents.document_id → documents.id` through tenant-aware composite FK.

Both links are nullable for backward compatibility with qualification records created before the canonical document core.

Partial unique indexes prevent the same canonical document from being linked more than once inside the same qualification-register type.

## API

Module: `apps/api/src/documents`.

Base route: `/api/v1/documents`.

Implemented operations:

- list active documents;
- create metadata root;
- get document;
- update mutable metadata;
- controlled soft delete;
- prepare object upload;
- commit verified upload as a new immutable version;
- list versions;
- prepare authorized download;
- list validation history;
- append validation decision;
- link document to business party;
- link document to transport request;
- link document to driver using `driver_documents`;
- link document to capacity asset using `capacity_asset_documents`.

The HTTP API never accepts a generic table/resource name from the caller.

## Storage boundary

`DocumentStoragePort` defines three provider-neutral operations:

1. `prepareUpload`;
2. `verifyUpload`;
3. `createDownloadUrl`.

The default runtime adapter fails closed with HTTP service-unavailable semantics when a concrete object-storage adapter has not been configured.

No local-disk or public-URL fallback is allowed.

## Upload and versioning workflow

```text
Create document metadata
→ authorize tenant
→ prepare short-lived upload target
→ client uploads object
→ commit opaque upload id
→ storage adapter verifies object
→ lock document
→ allocate next version number
→ persist immutable version + SHA-256
→ update current document status
```

If the document type requires validation, a committed upload moves the root to `pending`. Otherwise the document becomes `valid`, unless its expiry date is already in the past.

## Validation workflow

Validation results:

- `valid`;
- `invalid`;
- `review_required`.

Validation types:

- `manual`;
- `system`;
- `external`.

Manual decisions require an actor. History is never rewritten by `nexora_app`.

## Subject-scope enforcement

`document_types.subject_scope` remains the source of truth.

Typed links accept:

- `party` or `other` for business parties;
- `driver` or `other` for drivers;
- `asset` or `other` for capacity assets;
- `request` or `other` for transport requests.

Trip linkage is intentionally deferred to Wave 0022 because a canonical `trips` root does not exist yet.

## Soft delete

Deleting a document means lifecycle archival, not physical deletion:

- root status becomes `archived`;
- `deleted_at` is set;
- `deleted_by_user_id` is mandatory;
- `delete_reason` is mandatory;
- normal document lookup excludes deleted roots;
- versions, validations and typed links remain intact for retention/audit.

## Security and tenant isolation

All five new tables use tenant RLS based on `app.tenant_id`.

Tenant-aware composite FKs prevent cross-tenant document/type/entity relationships even when UUIDs are supplied directly.

Object-storage credentials, signed URLs and binary payloads are not persisted in the database.

## Validation gates

Required before merge:

- Prettier/lint;
- database and API typecheck;
- API tests;
- build;
- Drizzle generate/check/artifact versioning;
- full migration replay `0000 → 0018`;
- schema baseline `89/81/19`;
- runtime grant matrix;
- document RLS positive and negative cases;
- append-only enforcement for versions/validations/typed relation tables;
- cross-tenant typed-link rejection;
- same-document version-validation FK rejection;
- driver/asset canonical document FK isolation;
- existing Wave 0016/0017 and reservation/contract regression gates.

## Deferred from Wave 0018

- concrete cloud object-storage provider selection/configuration;
- automated document blocking policies required by the complete NEX-47 story;
- trip/POD relation because Trips core begins in Wave 0022;
- OCR/antifraud/external regulatory providers;
- retention worker and physical-object cleanup automation;
- generalized audit events, outbox and durable jobs from Wave 0024.
