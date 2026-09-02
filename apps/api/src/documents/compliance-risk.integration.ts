import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { ComplianceRiskService } from './compliance-risk.service.js';
import { UnconfiguredComplianceRiskProviderAdapter } from './unconfigured-compliance-risk-provider.adapter.js';

const TENANT_A = '75000000-0000-4000-8000-000000000001';
const TENANT_B = '75000000-0000-4000-8000-000000000002';
const USER_A = '75000000-0000-4000-8000-000000000101';
const USER_B = '75000000-0000-4000-8000-000000000102';
const PARTY_A = '75000000-0000-4000-8000-000000000201';
const DRIVER_A = '75000000-0000-4000-8000-000000000301';
const DOCUMENT_A = '75000000-0000-4000-8000-000000000401';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const provider = new UnconfiguredComplianceRiskProviderAdapter();

  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|nex49-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const riskA = new ComplianceRiskService(contextA, database, provider);

  const contextB = new TenantContext();
  contextB.establish({
    subject: 'integration|nex49-b',
    tenantId: TENANT_B,
    userId: USER_B,
  });
  const riskB = new ComplianceRiskService(contextB, database, provider);

  try {
    const partyAssessment = await riskA.evaluate('party', PARTY_A);
    assert.equal(partyAssessment.decision, 'review');
    assert.equal(partyAssessment.source, 'system');
    assert.ok(Number(partyAssessment.score) >= 40);
    assert.ok(
      (partyAssessment.signals as Array<{ code: string }>).some(
        (item) => item.code === 'PARTY_HOMOLOGATION_PENDING',
      ),
    );

    const driverAssessment = await riskA.evaluate('driver', DRIVER_A);
    assert.equal(driverAssessment.decision, 'block');
    assert.ok(
      (driverAssessment.signals as Array<{ code: string }>).some(
        (item) => item.code === 'DRIVER_CNH_EXPIRED',
      ),
    );

    const documentAssessment = await riskA.evaluate('document', DOCUMENT_A);
    assert.equal(documentAssessment.decision, 'block');
    assert.ok(
      (documentAssessment.signals as Array<{ code: string }>).some(
        (item) => item.code === 'DOCUMENT_VALIDATION_INVALID',
      ),
    );

    const manualDecision = await riskA.decide(String(partyAssessment.id), {
      decision: 'approve',
      reason: 'Compliance analyst approved after reviewing the registered evidence.',
    });
    assert.equal(manualDecision.decision, 'approve');
    assert.equal(manualDecision.source, 'manual');
    assert.equal(manualDecision.supersedesAssessmentId, partyAssessment.id);

    const partyHistory = await riskA.list('party', PARTY_A);
    assert.equal(partyHistory.length, 2);
    assert.equal(partyHistory[0]?.id, manualDecision.id);
    assert.equal(partyHistory[1]?.id, partyAssessment.id);

    await database.withTenantContext(contextA.require(), async (client) => {
      const audit = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM audit_events
          WHERE entity_type='compliance_risk_assessment'
            AND action IN ('compliance.risk.assessed','compliance.risk.decided')`,
      );
      assert.equal(Number(audit.rows[0]?.count ?? 0), 4);

      await assert.rejects(
        client.query(
          `UPDATE compliance_risk_assessments SET reason='tampered assessment reason' WHERE id=$1::uuid`,
          [partyAssessment.id],
        ),
        /permission denied|append-only/i,
      );
      await assert.rejects(
        client.query(`DELETE FROM compliance_risk_assessments WHERE id=$1::uuid`, [partyAssessment.id]),
        /permission denied|append-only/i,
      );
    });

    await assert.rejects(riskB.list('party', PARTY_A), /not found in current tenant/);
    await assert.rejects(riskB.decide(String(partyAssessment.id), {
      decision: 'review',
      reason: 'Cross-tenant decision must never resolve another tenant assessment.',
    }), /risk assessment not found in current tenant/);
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
