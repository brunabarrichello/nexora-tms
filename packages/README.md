# Shared packages

The canonical Nexora TMS architecture allows shared packages such as `ui`, `database`, `auth`,
`config`, `contracts`, `types`, `validation`, `observability`, `security`, `testing`, and `shared`.

They are **not scaffolded as empty abstractions** in NEX-18.

Create a package only when at least two deployables require the same stable responsibility or when
an accepted ADR explicitly requires a package boundary. Domain/business logic stays inside its
bounded context rather than being moved into a generic shared package.

See the canonical architecture and ADRs before creating new package boundaries.
