# Security Policy

Security is a first-class requirement for Nexora TMS.

## Reporting a vulnerability

Do not publish sensitive security findings in public issues, discussions, pull requests, or commit messages.

If you discover a vulnerability, report it privately to the repository owner or through an approved private security-reporting channel once one is configured.

Include, when possible:

- affected component;
- reproduction steps;
- expected and observed behavior;
- security impact;
- suggested mitigation;
- whether credentials, customer data, or tenant isolation may be affected.

## Secret handling

Never commit:

- access tokens;
- passwords;
- database connection strings containing credentials;
- private keys or certificates;
- production `.env` files;
- customer or tenant production data.

Credentials exposed in Git history must be considered compromised and rotated immediately.

## Supported versions

The project is currently in pre-release development. A formal supported-version matrix will be introduced before production readiness.
