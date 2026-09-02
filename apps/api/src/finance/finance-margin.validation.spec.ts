import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { TenantContext } from '../tenancy/tenant-context.js';
import type { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { FinanceMarginService } from './finance-margin.service.js';

test('margin lookup rejects invalid transport request UUID before database access', async () => {
  const service = new FinanceMarginService({} as TenantContext, {} as TenantDatabaseService);

  await assert.rejects(service.get('not-a-uuid'), /transportRequestId must be a valid UUID/);
});
