import pg from 'pg';

const { Client } = pg;

if (process.env.APP_ENV !== 'development') {
  throw new Error('NEX-91 worker role provisioner is restricted to APP_ENV=development');
}

const adminUrl = process.env.NEX70_ADMIN_DATABASE_URL;
const password = process.env.WORKER_DB_PASSWORD;

if (!adminUrl || !password) {
  throw new Error('NEX-91 worker provisioning variables are missing');
}

const parsed = new URL(adminUrl);
const database = decodeURIComponent(parsed.pathname.slice(1)) || 'neondb';

const admin = new Client({ connectionString: adminUrl });
await admin.connect();

try {
  const formatted = await admin.query('select quote_literal($1) as password_literal', [password]);
  const passwordLiteral = formatted.rows[0]?.password_literal;
  if (typeof passwordLiteral !== 'string') {
    throw new Error('Could not safely quote nexora_worker password');
  }

  await admin.query(`alter role nexora_worker password ${passwordLiteral}`);
} finally {
  await admin.end();
}

const worker = new Client({
  host: parsed.hostname,
  port: Number(parsed.port || 5432),
  database,
  user: 'nexora_worker',
  password,
  ssl: { rejectUnauthorized: true },
});

await worker.connect();
let verified;
try {
  verified = await worker.query(`
    select
      current_user as role,
      current_database() as database,
      has_function_privilege(
        current_user,
        'nexora_claim_durable_jobs(text,integer,integer)',
        'EXECUTE'
      ) as can_claim_jobs,
      has_function_privilege(
        current_user,
        'nexora_claim_outbox_events(text,integer,integer)',
        'EXECUTE'
      ) as can_claim_outbox
  `);
} finally {
  await worker.end();
}

const row = verified.rows[0];
if (row?.role !== 'nexora_worker' || row.can_claim_jobs !== true || row.can_claim_outbox !== true) {
  throw new Error('nexora_worker post-rotation verification failed');
}

console.log(
  JSON.stringify({
    event: 'nex91.worker_role.provisioned',
    environment: 'development',
    workerRole: row.role,
    database: row.database,
    host: parsed.hostname,
    canClaimJobs: row.can_claim_jobs,
    canClaimOutbox: row.can_claim_outbox,
  }),
);
