# Gate 09 runtime deployment note

Development API migration gate uses `NEXORA_MIGRATOR_DATABASE_URL`, validates the migrator session, switches the PostgreSQL session with `SET ROLE nexora_owner`, runs `db:migrate`, and then starts the API.

This file is operational documentation only; Production remains frozen.
