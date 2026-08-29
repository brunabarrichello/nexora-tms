# Shared packages

Packages under `packages/` exist only for stable cross-deployable contracts or accepted architecture boundaries. Domain/business logic stays in its bounded context rather than moving into a generic shared package.

## Materialized packages

- `@nexora/database` — persistence contract shared by API, Worker and controlled migrations; implements the NEX-71 foundation schema and the accepted database boundary.

Other package directories created during Wave 0 remain placeholders until their owning work item adds an executable contract.

See the canonical architecture and ADRs before creating additional package boundaries.
