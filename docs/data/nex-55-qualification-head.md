# NEX-55 qualification candidate

Base main: `601a6b70945961ea11f44d4ab03e94b411498f03`.

Candidate includes Worker handlers for NEX-54 notification intents, tenant-safe async administration, privileged reprocessing wrappers, Web processing view and dedicated Neon lifecycle qualification.

The dedicated Neon gate already proved the full retry → dead-letter → administrative reprocess → eventual success lifecycle before formatting. The current human head contains only the normalized source formatting on top of that qualified behavior and must pass CI + Neon again before merge.

Production remains frozen.
