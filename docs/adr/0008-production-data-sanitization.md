# ADR-0008 — Production Data Is Not Cloned to Lower Environments Without Sanitization

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Transport data can contain personal, financial, document and operationally sensitive information.

## Decision

Production data must never be copied to development or staging without an explicit sanitization/anonymization process. Synthetic seeds and fixtures are the default.

## Alternatives considered

- full production clones for debugging;
- manual dumps without a formal policy.

## Consequences

**Positive:** significantly lower exposure risk and a stronger compliance posture.  
**Trade-off:** some data-dependent defects require synthetic reproduction.  
**Mitigation:** fixture generators, scenario builders and tightly controlled sanitized exports only when indispensable.
