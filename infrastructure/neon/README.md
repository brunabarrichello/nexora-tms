# Neon PostgreSQL Infrastructure

This directory contains versioned database infrastructure guidance for Nexora TMS.

## Canonical project

- Neon project: `nexora-tms`
- Project ID: `raspy-river-76339604`
- PostgreSQL 18
- Region: `aws-us-east-2`

No credentials or connection strings are stored here.

## Target layout

```text
infrastructure/neon/
├── README.md
├── bootstrap/
│   └── roles-and-grants.sql
├── migrations/
│   └── README.md
└── seeds/
    └── README.md
```

## Environment model

- `main` → production baseline;
- `staging` → pre-production verification;
- `development` → shared development/integration;
- short-lived branches → PR/migration experiments and validation.

At the time this baseline was written, `main` is physically confirmed. `staging` and `development` are required but blocked by a Neon connector parameter-mapping defect and must be verified before NEX-77 is closed.

## Rules

1. Schema changes must be versioned.
2. Runtime roles and migrator privileges stay separate.
3. No production data is copied to lower environments without sanitization.
4. Destructive changes require explicit recovery and rollout planning.
5. Credentials are managed only through approved secret-management surfaces.
6. Database changes are validated in an isolated branch before production whenever possible.
