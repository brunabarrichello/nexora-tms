from pathlib import Path


def patch_migration() -> None:
    migration = Path('packages/database/migrations/0021_dizzy_longshot.sql')
    sql = migration.read_text()
    if 'enforce_negotiation_message_reply_scope' in sql:
        return
    sql += r'''
--> statement-breakpoint
CREATE FUNCTION "public"."enforce_negotiation_message_reply_scope"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.reply_to_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
    FROM public.negotiation_messages parent_message
   WHERE parent_message.id = NEW.reply_to_message_id
     AND parent_message.tenant_id = NEW.tenant_id
     AND parent_message.thread_id = NEW.thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'reply_to_message_id must reference a message in the same tenant and thread';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."enforce_negotiation_message_reply_scope"() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER "negotiation_messages_reply_scope_trigger"
BEFORE INSERT OR UPDATE OF "reply_to_message_id", "tenant_id", "thread_id"
ON "public"."negotiation_messages"
FOR EACH ROW
EXECUTE FUNCTION "public"."enforce_negotiation_message_reply_scope"();
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."negotiation_threads" FROM nexora_app;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."negotiation_participants" FROM nexora_app;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."negotiation_messages" FROM nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."negotiation_threads" TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."negotiation_participants" TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "public"."negotiation_messages" TO nexora_app;
'''
    migration.write_text(sql)


def patch_global_gate() -> None:
    gate = Path('.github/workflows/neon-pr-gate.yml')
    text = gate.read_text()
    old = "'business_party_documents','transport_request_documents'"
    new = "'business_party_documents','transport_request_documents','negotiation_threads','negotiation_participants','negotiation_messages'"
    if text.count(old) < 2:
        raise RuntimeError('neon-pr-gate inventory anchor not found enough times')
    text = text.replace(old, new)
    replacements = {
        'IF table_count <> 89 THEN': 'IF table_count <> 92 THEN',
        'Expected 89 application tables': 'Expected 92 application tables',
        'IF rls_count <> 81 THEN': 'IF rls_count <> 84 THEN',
        'Expected RLS on 81 tenant-scoped tables': 'Expected RLS on 84 tenant-scoped tables',
        'IF migration_count <> 21 THEN': 'IF migration_count <> 22 THEN',
        'Expected 21 Drizzle migration records': 'Expected 22 Drizzle migration records',
    }
    for before, after in replacements.items():
        if before not in text:
            raise RuntimeError(f'missing global gate anchor: {before}')
        text = text.replace(before, after)
    gate.write_text(text)


def patch_shared_migrate() -> None:
    migrate = Path('.github/workflows/neon-migrate.yml')
    text = migrate.read_text()
    if 'Verify Wave 0018 through 0021 baselines' not in text:
        text = text.replace(
            'Verify Wave 0018 through 0020 baselines',
            'Verify Wave 0018 through 0021 baselines',
        )
    anchor = """            IF EXISTS (\n              SELECT 1\n                FROM unnest(ARRAY['matching_candidates','matching_candidate_scores','matching_rule_results','matching_rejections']) AS t(table_name)\n               WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')\n                  OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')\n                  OR has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')\n                  OR has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')\n            ) THEN\n              RAISE EXCEPTION 'Wave 0020 historical matching privileges are incorrect';\n            END IF;\n"""
    checks = """

            SELECT count(*) INTO tables_count
              FROM information_schema.tables
             WHERE table_schema='public'
               AND table_name IN ('negotiation_threads','negotiation_participants','negotiation_messages');
            IF tables_count <> 3 THEN
              RAISE EXCEPTION 'Wave 0021 negotiation tables incomplete: %', tables_count;
            END IF;

            SELECT count(*) INTO rls_count
              FROM pg_class c
              JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public'
               AND c.relname IN ('negotiation_threads','negotiation_participants','negotiation_messages')
               AND c.relrowsecurity;
            IF rls_count <> 3 THEN
              RAISE EXCEPTION 'Wave 0021 negotiation RLS incomplete: %', rls_count;
            END IF;

            IF EXISTS (
              SELECT 1
                FROM unnest(ARRAY['negotiation_threads','negotiation_participants']) AS t(table_name)
               WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')
                  OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')
                  OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')
                  OR has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')
            ) THEN
              RAISE EXCEPTION 'Wave 0021 mutable negotiation privileges are incorrect';
            END IF;

            IF NOT has_table_privilege('nexora_app','public.negotiation_messages','SELECT')
               OR NOT has_table_privilege('nexora_app','public.negotiation_messages','INSERT')
               OR has_table_privilege('nexora_app','public.negotiation_messages','UPDATE')
               OR has_table_privilege('nexora_app','public.negotiation_messages','DELETE') THEN
              RAISE EXCEPTION 'Wave 0021 negotiation_messages must remain append-only';
            END IF;

            IF NOT EXISTS (
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
    if 'Wave 0021 negotiation tables incomplete' not in text:
        if anchor not in text:
            raise RuntimeError('Wave 0020 privilege anchor missing from neon-migrate.yml')
        text = text.replace(anchor, anchor + checks, 1)
    summary = 'echo "- Wave 0020 matching persistence baseline: verified"'
    if 'Wave 0021 negotiation collaboration baseline: verified' not in text:
        if summary not in text:
            raise RuntimeError('Wave 0020 summary anchor missing from neon-migrate.yml')
        text = text.replace(
            summary,
            summary + '\n            echo "- Wave 0021 negotiation collaboration baseline: verified"',
        )
    migrate.write_text(text)


def write_dedicated_gate() -> None:
    dedicated = Path('.github/workflows/neon-negotiation-gate.yml')
    dedicated.write_text(r'''name: Neon Negotiation Gate

on:
  pull_request:
    branches:
      - main
    paths:
      - 'packages/database/**'
      - 'apps/api/src/negotiation/**'
      - '.github/workflows/neon-negotiation-gate.yml'

permissions:
  contents: read

concurrency:
  group: neon-negotiation-gate-pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

env:
  NEON_PROJECT_ID: raspy-river-76339604

jobs:
  negotiation-isolation:
    name: Negotiation schema, grants and RLS
    if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - name: Checkout PR
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.24.0
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24.20.0

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Set ephemeral branch
        shell: bash
        run: |
          set -euo pipefail
          echo "NEON_TEST_BRANCH=pr-${{ github.event.pull_request.number }}-negotiation-${{ github.run_id }}" >> "$GITHUB_ENV"
          echo "NEON_TEST_EXPIRES_AT=$(date -u --date '+2 hours' +'%Y-%m-%dT%H:%M:%SZ')" >> "$GITHUB_ENV"

      - name: Create isolated Neon branch
        id: admin
        uses: neondatabase/create-branch-action@v6
        with:
          project_id: ${{ env.NEON_PROJECT_ID }}
          parent_branch: main
          branch_name: ${{ env.NEON_TEST_BRANCH }}
          database: neondb
          role: neondb_owner
          expires_at: ${{ env.NEON_TEST_EXPIRES_AT }}
          api_key: ${{ secrets.NEON_API_KEY }}

      - name: Ensure PostgreSQL client
        shell: bash
        run: |
          set -euo pipefail
          if ! command -v psql >/dev/null 2>&1; then
            sudo apt-get update
            sudo apt-get install -y postgresql-client
          fi

      - name: Bootstrap migration capability
        env:
          ADMIN_DATABASE_URL: ${{ steps.admin.outputs.db_url }}
        run: |
          set -euo pipefail
          echo "::add-mask::$ADMIN_DATABASE_URL"
          psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          GRANT CREATE ON DATABASE neondb TO nexora_owner;
          GRANT USAGE, CREATE ON SCHEMA public TO nexora_owner;
          SQL

      - name: Resolve migrator connection
        id: migrator
        uses: neondatabase/create-branch-action@v6
        with:
          project_id: ${{ env.NEON_PROJECT_ID }}
          parent_branch: main
          branch_name: ${{ env.NEON_TEST_BRANCH }}
          database: neondb
          role: nexora_migrator
          api_key: ${{ secrets.NEON_API_KEY }}

      - name: Apply migrations
        env:
          MIGRATOR_DATABASE_URL: ${{ steps.migrator.outputs.db_url }}
        shell: bash
        run: |
          set -euo pipefail
          echo "::add-mask::$MIGRATOR_DATABASE_URL"
          if [[ "$MIGRATOR_DATABASE_URL" == *"?"* ]]; then
            OWNER_DATABASE_URL="${MIGRATOR_DATABASE_URL}&options=-c%20role%3Dnexora_owner"
          else
            OWNER_DATABASE_URL="${MIGRATOR_DATABASE_URL}?options=-c%20role%3Dnexora_owner"
          fi
          echo "::add-mask::$OWNER_DATABASE_URL"
          echo "OWNER_DATABASE_URL=$OWNER_DATABASE_URL" >> "$GITHUB_ENV"
          DATABASE_URL="$OWNER_DATABASE_URL" pnpm --filter @nexora/database db:migrate

      - name: Verify schema, RLS, grants and reply integrity
        shell: bash
        run: |
          set -euo pipefail
          psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          DO $block$
          DECLARE
            v_count integer;
          BEGIN
            SELECT count(*) INTO v_count
              FROM information_schema.tables
             WHERE table_schema='public'
               AND table_name IN ('negotiation_threads','negotiation_participants','negotiation_messages');
            IF v_count <> 3 THEN
              RAISE EXCEPTION 'Expected 3 negotiation tables, found %', v_count;
            END IF;

            SELECT count(*) INTO v_count
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public'
               AND c.relname IN ('negotiation_threads','negotiation_participants','negotiation_messages')
               AND c.relrowsecurity;
            IF v_count <> 3 THEN
              RAISE EXCEPTION 'Expected RLS on 3 negotiation tables, found %', v_count;
            END IF;

            IF EXISTS (
              SELECT 1 FROM unnest(ARRAY['negotiation_threads','negotiation_participants']) AS x(table_name)
               WHERE NOT has_table_privilege('nexora_app',format('public.%I',table_name),'SELECT')
                  OR NOT has_table_privilege('nexora_app',format('public.%I',table_name),'INSERT')
                  OR NOT has_table_privilege('nexora_app',format('public.%I',table_name),'UPDATE')
                  OR has_table_privilege('nexora_app',format('public.%I',table_name),'DELETE')
            ) THEN
              RAISE EXCEPTION 'Negotiation mutable-table grants are incorrect';
            END IF;

            IF NOT has_table_privilege('nexora_app','public.negotiation_messages','SELECT')
               OR NOT has_table_privilege('nexora_app','public.negotiation_messages','INSERT')
               OR has_table_privilege('nexora_app','public.negotiation_messages','UPDATE')
               OR has_table_privilege('nexora_app','public.negotiation_messages','DELETE') THEN
              RAISE EXCEPTION 'negotiation_messages grants are incorrect';
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_trigger t
              JOIN pg_class c ON c.oid=t.tgrelid
              JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public'
                AND c.relname='negotiation_messages'
                AND t.tgname='negotiation_messages_reply_scope_trigger'
                AND NOT t.tgisinternal
            ) THEN
              RAISE EXCEPTION 'reply-scope trigger is missing';
            END IF;
          END
          $block$;
          SQL

      - name: Seed two-tenant negotiation fixtures
        shell: bash
        run: |
          set -euo pipefail
          psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          INSERT INTO tenants(id,slug,name,status) VALUES
            ('11111111-1111-4111-8111-111111111111','neg-a','Negotiation A','active'),
            ('22222222-2222-4222-8222-222222222222','neg-b','Negotiation B','active');
          INSERT INTO users(id,display_name,status) VALUES
            ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Negotiation User A','active'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Negotiation User B','active');
          INSERT INTO memberships(id,tenant_id,user_id,status,joined_at) VALUES
            ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active',now()),
            ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active',now());
          INSERT INTO business_parties(id,tenant_id,tax_id,legal_name,status) VALUES
            ('a1000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','A100','Customer A','active'),
            ('a1000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','A200','Shipper A','active'),
            ('a1000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','A300','Consignee A','active'),
            ('b2000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','B100','Customer B','active'),
            ('b2000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','B200','Shipper B','active'),
            ('b2000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','B300','Consignee B','active');
          INSERT INTO business_party_addresses(id,tenant_id,party_id,type,label,street,city,state,country_code) VALUES
            ('a1100000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000002','pickup','Origin A','Rua A','Sao Paulo','SP','BR'),
            ('a1100000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000003','delivery','Destination A','Rua B','Campinas','SP','BR'),
            ('b2200000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','b2000000-0000-4000-8000-000000000002','pickup','Origin B','Rua C','Curitiba','PR','BR'),
            ('b2200000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','b2000000-0000-4000-8000-000000000003','delivery','Destination B','Rua D','Londrina','PR','BR');
          INSERT INTO transport_requests(id,tenant_id,customer_party_id,shipper_party_id,consignee_party_id,origin_address_id,destination_address_id,planned_pickup_at,planned_delivery_at,cargo_description,status,created_by_user_id,updated_by_user_id) VALUES
            ('a1200000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000002',now(),now()+interval '1 day','Cargo A','in_negotiation','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
            ('b2300000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','b2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000003','b2200000-0000-4000-8000-000000000001','b2200000-0000-4000-8000-000000000002',now(),now()+interval '1 day','Cargo B','in_negotiation','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
          SQL

      - name: Resolve app connection
        id: app
        uses: neondatabase/create-branch-action@v6
        with:
          project_id: ${{ env.NEON_PROJECT_ID }}
          parent_branch: main
          branch_name: ${{ env.NEON_TEST_BRANCH }}
          database: neondb
          role: nexora_app
          api_key: ${{ secrets.NEON_API_KEY }}

      - name: Verify runtime RLS and reply scope
        env:
          APP_DATABASE_URL: ${{ steps.app.outputs.db_url }}
        shell: bash
        run: |
          set -euo pipefail
          echo "::add-mask::$APP_DATABASE_URL"
          psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          BEGIN;
          SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
          INSERT INTO negotiation_threads(id,tenant_id,transport_request_id,subject,created_by_membership_id) VALUES
            ('a1300000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','a1200000-0000-4000-8000-000000000001','Primary thread','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
            ('a1300000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','a1200000-0000-4000-8000-000000000001','Secondary thread','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
          INSERT INTO negotiation_participants(id,tenant_id,thread_id,kind,role,membership_id,added_by_membership_id) VALUES
            ('a1400000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','a1300000-0000-4000-8000-000000000001','internal','operator','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
            ('a1400000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','a1300000-0000-4000-8000-000000000002','internal','operator','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
          INSERT INTO negotiation_messages(id,tenant_id,thread_id,transport_request_id,author_participant_id,kind,body) VALUES
            ('a1500000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','a1300000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','a1400000-0000-4000-8000-000000000001','message','Message one'),
            ('a1500000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','a1300000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000001','a1400000-0000-4000-8000-000000000002','message','Message two');
          INSERT INTO negotiation_messages(tenant_id,thread_id,transport_request_id,author_participant_id,kind,body,reply_to_message_id) VALUES
            ('11111111-1111-4111-8111-111111111111','a1300000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','a1400000-0000-4000-8000-000000000001','message','Valid reply','a1500000-0000-4000-8000-000000000001');
          DO $block$
          BEGIN
            BEGIN
              INSERT INTO negotiation_messages(tenant_id,thread_id,transport_request_id,author_participant_id,kind,body,reply_to_message_id) VALUES
                ('11111111-1111-4111-8111-111111111111','a1300000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001','a1400000-0000-4000-8000-000000000001','message','Invalid cross-thread reply','a1500000-0000-4000-8000-000000000002');
              RAISE EXCEPTION 'Cross-thread reply unexpectedly succeeded';
            EXCEPTION WHEN foreign_key_violation THEN
              NULL;
            END;
          END
          $block$;
          COMMIT;

          BEGIN;
          SELECT set_config('app.tenant_id','22222222-2222-4222-8222-222222222222',true);
          DO $block$
          DECLARE visible_count integer;
          BEGIN
            SELECT count(*) INTO visible_count FROM negotiation_threads;
            IF visible_count <> 0 THEN
              RAISE EXCEPTION 'Tenant B can see Tenant A negotiation rows: %', visible_count;
            END IF;
          END
          $block$;
          DO $block$
          BEGIN
            BEGIN
              INSERT INTO negotiation_threads(tenant_id,transport_request_id,subject,created_by_membership_id) VALUES
                ('11111111-1111-4111-8111-111111111111','a1200000-0000-4000-8000-000000000001','Cross tenant','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
              RAISE EXCEPTION 'Cross-tenant negotiation insert unexpectedly succeeded';
            EXCEPTION WHEN insufficient_privilege THEN
              NULL;
            END;
          END
          $block$;
          ROLLBACK;
          SQL

      - name: Delete ephemeral Neon branch
        if: ${{ always() }}
        uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ env.NEON_PROJECT_ID }}
          branch: ${{ env.NEON_TEST_BRANCH }}
          api_key: ${{ secrets.NEON_API_KEY }}
''')


def cleanup() -> None:
    Path('.github/workflows/wave-0021-generate-migration.yml').unlink(missing_ok=True)
    Path('scripts/wave-0021-harden.py').unlink(missing_ok=True)


patch_migration()
patch_global_gate()
patch_shared_migrate()
write_dedicated_gate()
cleanup()
