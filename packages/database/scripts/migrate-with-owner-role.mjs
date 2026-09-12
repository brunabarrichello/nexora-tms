import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';

const url = process.env.MIGRATOR_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('MIGRATOR_DATABASE_URL or DATABASE_URL is required');

const parsedUrl = new URL(url);
if (parsedUrl.hostname.includes('-pooler.')) {
  throw new Error(
    'Migration runner requires a direct Neon endpoint; pooled endpoints are not supported for SET ROLE',
  );
}
if (parsedUrl.searchParams.has('options')) {
  throw new Error(
    'Migration runner does not accept startup options; use session-scoped SET ROLE instead',
  );
}

const sql = postgres(url, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
});

const assertIdentity = (identity, expectedUser) => {
  if (
    identity.session_user !== 'nexora_migrator' ||
    identity.current_user !== expectedUser ||
    identity.current_database !== 'nexora'
  ) {
    throw new Error(
      `Unexpected migration identity: ${identity.session_user}:${identity.current_user}:${identity.current_database}`,
    );
  }
};

try {
  const [identity] = await sql`
    select session_user, current_user, current_database()
  `;
  assertIdentity(identity, 'nexora_migrator');

  await sql`set role nexora_owner`;

  const [elevated] = await sql`
    select session_user, current_user, current_database()
  `;
  assertIdentity(elevated, 'nexora_owner');

  const db = drizzle(sql);
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
  });

  console.log(
    `Migration role chain verified: ${elevated.session_user} -> ${elevated.current_user}`,
  );
} finally {
  await sql.end({ timeout: 5 });
}
