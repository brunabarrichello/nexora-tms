import { execFileSync } from 'node:child_process';

import pg from 'pg';

const { Client } = pg;

const projectId = 'raspy-river-76339604';
const branchName = 'staging';
const databaseName = 'neondb';
const adminRole = 'neondb_owner';
const userId = '58000000-0000-4000-8000-000000000101';

const subject = process.env.NEX70_AUTH_SUB?.trim();
const neonApiKey = process.env.NEON_API_KEY?.trim();

if (!subject || !neonApiKey) {
  throw new Error('Required protected inputs are missing');
}

const connectionString = execFileSync(
  'npx',
  [
    '--yes',
    'neonctl@v2',
    'connection-string',
    branchName,
    '--project-id',
    projectId,
    '--database-name',
    databaseName,
    '--role-name',
    adminRole,
  ],
  {
    encoding: 'utf8',
    env: { ...process.env, NEON_API_KEY: neonApiKey },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();

if (!connectionString) {
  throw new Error('Staging connection could not be resolved');
}

const client = new Client({ connectionString, application_name: 'nex70-staging-identity-linker' });
await client.connect();

try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE nexora_owner');

  const collision = await client.query(
    `SELECT user_id::text AS user_id
       FROM external_identities
      WHERE provider = 'auth0' AND subject = $1
      LIMIT 1`,
    [subject],
  );

  if (collision.rowCount && collision.rows[0].user_id !== userId) {
    throw new Error('External identity collision detected');
  }

  await client.query(
    `INSERT INTO users (id, display_name, status)
     VALUES ($1, 'NEX-70 Staging Auth Fixture', 'active')
     ON CONFLICT (id) DO UPDATE
       SET status = 'active', updated_at = now()`,
    [userId],
  );

  await client.query(
    `INSERT INTO external_identities (user_id, provider, subject, last_seen_at)
     VALUES ($1, 'auth0', $2, now())
     ON CONFLICT (provider, subject) DO UPDATE
       SET user_id = EXCLUDED.user_id, last_seen_at = now()`,
    [userId, subject],
  );

  const proof = await client.query(
    `SELECT
       (SELECT count(*)::int FROM users WHERE id = $1 AND status = 'active') AS active_users,
       (SELECT count(*)::int FROM external_identities WHERE user_id = $1 AND provider = 'auth0' AND subject = $2) AS identity_links,
       (SELECT count(*)::int FROM external_identities WHERE provider = 'auth0' AND subject = $2) AS subject_links`,
    [userId, subject],
  );

  const row = proof.rows[0];
  if (row.active_users !== 1 || row.identity_links !== 1 || row.subject_links !== 1) {
    throw new Error('Identity link postcondition failed');
  }

  await client.query('COMMIT');

  console.log(
    JSON.stringify({
      environment: 'staging',
      database: databaseName,
      activeUser: true,
      identityLinked: true,
      subjectCollision: false,
    }),
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
