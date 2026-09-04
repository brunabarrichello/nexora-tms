import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { FinancialAnalyticsService } from './financial-analytics.service.js';

const TENANT_A = '76000000-0000-4000-8000-000000000001';
const TENANT_B = '76000000-0000-4000-8000-000000000002';
const USER_A = '76000000-0000-4000-8000-000000000101';
const USER_B = '76000000-0000-4000-8000-000000000102';
const REQUEST_A = '76000000-0000-4000-8000-000000000701';
const CUSTOMER_A = '76000000-0000-4000-8000-000000000502';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({ subject: 'integration|financial-a', tenantId: TENANT_A, userId: USER_A });
  const financialA = new FinancialAnalyticsService(contextA, database);

  const contextB = new TenantContext();
  contextB.establish({ subject: 'integration|financial-b', tenantId: TENANT_B, userId: USER_B });
  const financialB = new FinancialAnalyticsService(contextB, database);

  try {
    await database.withTenantContext(contextA.require(), async (client) => {
      await client.query(
        `INSERT INTO customer_receivables (
           id,tenant_id,transport_request_id,customer_party_id,currency_code,invoiced_amount,due_at,
           status,created_by_user_id,updated_by_user_id
         ) VALUES (
           '76000000-0000-4000-8000-000000000971',$1::uuid,$2::uuid,$3::uuid,'BRL',18000,
           '2026-09-30T18:00:00Z','open',$4::uuid,$4::uuid
         )`,
        [TENANT_A, REQUEST_A, CUSTOMER_A, USER_A],
      );
    });

    const tenantA = await financialA.getFinancialIndicators({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
      customerPartyId: CUSTOMER_A,
    });
    const brlA = tenantA.byCurrency.find((entry) => entry.currencyCode === 'BRL');

    assert.ok(brlA);
    assert.equal(brlA.plannedRevenueAmount, '19000.00');
    assert.equal(brlA.invoicedRevenueAmount, '18000.00');
    assert.equal(brlA.contractedCostAmount, '15300.00');
    assert.equal(brlA.marginAmount, '3700.00');
    assert.equal(brlA.marginPercentage, '19.47');
    assert.equal(brlA.operationCount, 1);
    assert.equal(brlA.contractedOperationCount, 1);
    assert.equal(brlA.marginEligibleOperationCount, 1);
    assert.equal(brlA.invoicedReceivableCount, 1);
    assert.deepEqual(tenantA.customers, [{ id: CUSTOMER_A, name: 'NEX-50 Customer A' }]);

    const tenantB = await financialB.getFinancialIndicators({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });
    const brlB = tenantB.byCurrency.find((entry) => entry.currencyCode === 'BRL');

    assert.ok(brlB);
    assert.equal(brlB.plannedRevenueAmount, '10000.00');
    assert.equal(brlB.invoicedRevenueAmount, '0.00');
    assert.equal(brlB.contractedCostAmount, '0.00');
    assert.equal(brlB.marginAmount, '0.00');
    assert.equal(brlB.marginPercentage, null);
    assert.equal(
      tenantB.customers.some((customer) => customer.id === CUSTOMER_A),
      false,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
