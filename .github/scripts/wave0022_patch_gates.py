from pathlib import Path


def patch_neon_pr_gate() -> None:
    path = Path('.github/workflows/neon-pr-gate.yml')
    text = path.read_text()
    if "apps/api/src/trips/**" not in text:
        text = text.replace(
            "      - 'apps/api/src/negotiation/**'\n",
            "      - 'apps/api/src/negotiation/**'\n      - 'apps/api/src/trips/**'\n",
            1,
        )
    text = text.replace('IF migration_count <> 22 THEN', 'IF migration_count <> 23 THEN', 1)
    text = text.replace('Expected 22 Drizzle migration records', 'Expected 23 Drizzle migration records', 1)
    path.write_text(text)


def patch_neon_migrate() -> None:
    path = Path('.github/workflows/neon-migrate.yml')
    text = path.read_text()
    text = text.replace(
        'Verify Wave 0018 through 0021 baselines',
        'Verify Wave 0018 through 0022 baselines',
        1,
    )
    if 'Wave 0022 trips tables incomplete' not in text:
        marker = """            IF NOT EXISTS (
              SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid=t.tgrelid
                JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public'
                 AND c.relname='negotiation_messages'
                 AND t.tgname='negotiation_messages_reply_scope_trigger'
                 AND NOT t.tgisinternal
            ) THEN
              RAISE EXCEPTION 'Wave 0021 reply scope trigger is missing';
            END IF;
"""
        addition = marker + """

            SELECT count(*) INTO tables_count
              FROM information_schema.tables
             WHERE table_schema='public'
               AND table_name IN ('trips','trip_transport_requests','trip_stops','trip_drivers','trip_assets','trip_status_history');
            IF tables_count <> 6 THEN
              RAISE EXCEPTION 'Wave 0022 trips tables incomplete: %', tables_count;
            END IF;

            SELECT count(*) INTO rls_count
              FROM pg_class c
              JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public'
               AND c.relname IN ('trips','trip_transport_requests','trip_stops','trip_drivers','trip_assets','trip_status_history')
               AND c.relrowsecurity;
            IF rls_count <> 6 THEN
              RAISE EXCEPTION 'Wave 0022 trips RLS incomplete: %', rls_count;
            END IF;

            IF EXISTS (
              SELECT 1
                FROM unnest(ARRAY['trips','trip_transport_requests','trip_stops','trip_drivers','trip_assets']) AS t(table_name)
               WHERE NOT has_table_privilege('nexora_app',format('public.%I',table_name),'SELECT')
                  OR NOT has_table_privilege('nexora_app',format('public.%I',table_name),'INSERT')
                  OR NOT has_table_privilege('nexora_app',format('public.%I',table_name),'UPDATE')
                  OR has_table_privilege('nexora_app',format('public.%I',table_name),'DELETE')
            ) THEN
              RAISE EXCEPTION 'Wave 0022 mutable trip privileges are incorrect';
            END IF;

            IF NOT has_table_privilege('nexora_app','public.trip_status_history','SELECT')
               OR NOT has_table_privilege('nexora_app','public.trip_status_history','INSERT')
               OR has_table_privilege('nexora_app','public.trip_status_history','UPDATE')
               OR has_table_privilege('nexora_app','public.trip_status_history','DELETE') THEN
              RAISE EXCEPTION 'Wave 0022 trip_status_history must remain append-only';
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='trip_transport_requests_active_request_unique')
               OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='trip_transport_requests_active_contract_unique') THEN
              RAISE EXCEPTION 'Wave 0022 active trip request/contract uniqueness is missing';
            END IF;
"""
        if marker not in text:
            raise SystemExit('Wave 0021 baseline marker not found')
        text = text.replace(marker, addition, 1)
    if 'Wave 0022 trips core baseline: verified' not in text:
        text = text.replace(
            '            echo "- Wave 0021 negotiation collaboration baseline: verified"\n',
            '            echo "- Wave 0021 negotiation collaboration baseline: verified"\n'
            '            echo "- Wave 0022 trips core baseline: verified"\n',
            1,
        )
    path.write_text(text)


patch_neon_pr_gate()
patch_neon_migrate()

# Retrigger permanent gate patch after synchronizing Wave 0022 with main.
