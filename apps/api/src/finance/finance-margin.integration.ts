import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { FinanceMarginService } from './finance-margin.service.js';

const TENANT_A = '76000000-0000-4000-8000-000000000001';
const TENANT_B = '76000000-0000-4000-8000-000000000002';
const USER_A = '76000000-0000-4000-8000-000000000101';
const USER_B = '76000000-0000-4000-8000-000000000102';
const REQUEST_A = '76000000-0000-4000-8000-000000000701';
const REQUEST_B = '76000000-0000-4000-8000-000000000702';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({ subject: 'integration|finance-a', tenantId: TENANT_A, userId: USER_A });
  const financeA = new FinanceMarginService(contextA, database);

  const contextB = new TenantContext();
  contextB.establish({ subject: 'integration|finance-b', tenantId: TENANT_B, userId: USER_B });
  const financeB = new FinanceMarginService(contextB, database);

  try {
    const planned = await financeA.get(REQUEST_A);
    assert.equal(planned.stage, 'planned');
    assert.equal(planned.revenueAmount, '19000.00');
    assert.equal(planned.carrierFreightAmount, '16000.00');
    assert.equal(planned.tollAmount, '350.00');
    assert.equal(planned.additionalAmount, '150.00');
    assert.equal(planned.totalCostAmount, '16500.00');
    assert.equal(planned.marginAmount, '2500.00');
    assert.equal(planned.marginPercentage, '13.16');

    await database.withTenantContext(contextA.require(), async (client) => {
      await client.query(
        `INSERT INTO transport_contracts (
           id,tenant_id,transport_request_id,reservation_id,proposal_id,capacity_assignment_id,
           driver_id,vehicle_id,carrier_party_id,status,currency_code,freight_amount,toll_amount,
           additional_amount,payment_terms,commercial_notes,confirmed_by_user_id,confirmed_at
         ) VALUES (
           '76000000-0000-4000-8000-000000000901',$1::uuid,$2::uuid,
           '76000000-0000-4000-8000-000000000841','76000000-0000-4000-8000-000000000831',
           '76000000-0000-4000-8000-000000000821','76000000-0000-4000-8000-000000000801',
           '76000000-0000-4000-8000-000000000811','76000000-0000-4000-8000-000000000501',
           'confirmed','BRL',15000,300,0,'50% coleta / 50% entrega','NEX-50 contracted margin fixture',
           $3::uuid,'2026-09-02T18:00:00Z'
         )`,
        [TENANT_A, REQUEST_A, USER_A],
      );
    });

    const contracted = await financeA.get(REQUEST_A);
    assert.equal(contracted.stage, 'contracted');
    assert.equal(contracted.contractStatus, 'confirmed');
    assert.equal(contracted.revenueAmount, '19000.00');
    assert.equal(contracted.carrierFreightAmount, '15000.00');
    assert.equal(contracted.tollAmount, '300.00');
    assert.equal(contracted.additionalAmount, '0.00');
    assert.equal(contracted.totalCostAmount, '15300.00');
    assert.equal(contracted.marginAmount, '3700.00');
    assert.equal(contracted.marginPercentage, '19.47');

    const tenantAList = await financeA.list();
    assert.equal(tenantAList.length, 1);
    assert.equal(tenantAList[0]?.transportRequestId, REQUEST_A);

    const tenantBList = await financeB.list();
    assert.equal(tenantBList.length, 1);
    assert.equal(tenantBList[0]?.transportRequestId, REQUEST_B);
    assert.equal(tenantBList[0]?.stage, 'planned');

    await assert.rejects(
      financeB.get(REQUEST_A),
      /financial margin projection not found for transport request in current tenant/,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
