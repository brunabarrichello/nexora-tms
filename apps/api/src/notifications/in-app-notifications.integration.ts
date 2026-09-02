import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { emitInAppNotification } from './in-app-notification-emitter.js';
import { InAppNotificationsService } from './in-app-notifications.service.js';

const TENANT_A = '77000000-0000-4000-8000-000000000001';
const TENANT_B = '77000000-0000-4000-8000-000000000002';
const OPERATIONS_A = '77000000-0000-4000-8000-000000000101';
const DISPATCHER_A = '77000000-0000-4000-8000-000000000102';
const VIEWER_A = '77000000-0000-4000-8000-000000000103';
const OPERATIONS_B = '77000000-0000-4000-8000-000000000201';

function context(subject: string, tenantId: string, userId: string): TenantContext {
  const value = new TenantContext();
  value.establish({ subject, tenantId, userId });
  return value;
}

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const operationsContext = context('integration|nex54-operations-a', TENANT_A, OPERATIONS_A);
  const dispatcherContext = context('integration|nex54-dispatcher-a', TENANT_A, DISPATCHER_A);
  const viewerContext = context('integration|nex54-viewer-a', TENANT_A, VIEWER_A);
  const otherTenantContext = context('integration|nex54-operations-b', TENANT_B, OPERATIONS_B);

  const operationsInbox = new InAppNotificationsService(operationsContext, database);
  const dispatcherInbox = new InAppNotificationsService(dispatcherContext, database);
  const viewerInbox = new InAppNotificationsService(viewerContext, database);
  const otherTenantInbox = new InAppNotificationsService(otherTenantContext, database);

  try {
    const emissions = await database.withTenantContext(operationsContext.require(), async (client) => {
      const targetRoleCodes = ['operations_manager', 'dispatcher'] as const;
      const freight = await emitInAppNotification(client, {
        eventKey: 'integration.freight.created:request-001',
        eventType: 'freight.transport_request.created',
        module: 'freight',
        aggregateType: 'transport_request',
        aggregateId: 'request-001',
        title: 'Nova carga criada',
        body: 'Carga de integração pronta para acompanhamento.',
        contextUrl: '/cargas',
        targetRoleCodes,
        payload: { transportRequestId: 'request-001' },
      });
      const negotiation = await emitInAppNotification(client, {
        eventKey: 'integration.negotiation.confirmed:contract-001',
        eventType: 'negotiation.transport_contract.confirmed',
        module: 'negotiation',
        aggregateType: 'transport_contract',
        aggregateId: 'contract-001',
        title: 'Contratação confirmada',
        body: 'Contrato de integração confirmado.',
        contextUrl: '/negociacoes',
        targetRoleCodes,
        payload: { transportContractId: 'contract-001' },
      });
      const trip = await emitInAppNotification(client, {
        eventKey: 'integration.trip.status:trip-001:in-transit',
        eventType: 'trips.status.changed',
        module: 'trips',
        aggregateType: 'trip',
        aggregateId: 'trip-001',
        title: 'Viagem em trânsito',
        body: 'Viagem de integração iniciou execução.',
        contextUrl: '/viagens',
        targetRoleCodes,
        payload: { tripId: 'trip-001', toStatus: 'in_transit' },
      });
      const document = await emitInAppNotification(client, {
        eventKey: 'integration.document.validation:document-001',
        eventType: 'documents.validation.recorded',
        module: 'documents',
        aggregateType: 'document',
        aggregateId: 'document-001',
        title: 'Documento rejeitado',
        body: 'Documento de integração recebeu validação inválida.',
        contextUrl: '/documentos',
        severity: 'critical',
        targetRoleCodes,
        payload: { documentId: 'document-001', result: 'invalid' },
      });
      const duplicateFreight = await emitInAppNotification(client, {
        eventKey: 'integration.freight.created:request-001',
        eventType: 'freight.transport_request.created',
        module: 'freight',
        aggregateType: 'transport_request',
        aggregateId: 'request-001',
        title: 'Nova carga criada',
        body: 'Carga de integração pronta para acompanhamento.',
        contextUrl: '/cargas',
        targetRoleCodes,
        payload: { transportRequestId: 'request-001' },
      });

      return { freight, negotiation, trip, document, duplicateFreight };
    });

    assert.equal(emissions.freight.deliveryCount, 2);
    assert.equal(emissions.negotiation.deliveryCount, 2);
    assert.equal(emissions.trip.deliveryCount, 2);
    assert.equal(emissions.document.deliveryCount, 2);
    assert.equal(emissions.duplicateFreight.notificationEventId, emissions.freight.notificationEventId);
    assert.equal(emissions.duplicateFreight.outboxEventId, emissions.freight.outboxEventId);
    assert.equal(emissions.duplicateFreight.deliveryCount, 2);

    const operationsItems = await operationsInbox.list({});
    const dispatcherItems = await dispatcherInbox.list({});
    assert.equal(operationsItems.length, 4);
    assert.equal(dispatcherItems.length, 4);
    assert.equal(await operationsInbox.unreadCount(), 4);
    assert.equal(await dispatcherInbox.unreadCount(), 4);
    assert.equal((await viewerInbox.list({})).length, 0);
    assert.equal(await viewerInbox.unreadCount(), 0);
    assert.equal((await otherTenantInbox.list({})).length, 0);
    assert.equal(await otherTenantInbox.unreadCount(), 0);

    const critical = await operationsInbox.list({ module: 'documents', state: 'unread' });
    assert.equal(critical.length, 1);
    assert.equal(critical[0]?.severity, 'critical');
    assert.equal(critical[0]?.contextUrl, '/documentos');

    const first = operationsItems[0];
    assert.ok(first);
    const marked = await operationsInbox.markRead(first.id);
    assert.ok(marked.readAt);
    const markedAgain = await operationsInbox.markRead(first.id);
    assert.equal(markedAgain.readAt, marked.readAt);
    assert.equal(await operationsInbox.unreadCount(), 3);
    assert.equal(await dispatcherInbox.unreadCount(), 4);

    await assert.rejects(
      () => viewerInbox.markRead(first.id),
      /Notification not found for current user/,
    );

    await database.withTenantContext(operationsContext.require(), async (client) => {
      await assert.rejects(
        client.query('INSERT INTO in_app_notification_events DEFAULT VALUES'),
        (error: unknown) => (error as { code?: string }).code === '42501',
      );
    });
    await database.withTenantContext(operationsContext.require(), async (client) => {
      await assert.rejects(
        client.query('INSERT INTO in_app_notification_deliveries DEFAULT VALUES'),
        (error: unknown) => (error as { code?: string }).code === '42501',
      );
    });

    await database.withTenantContext(operationsContext.require(), async (client) => {
      const outbox = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count
           FROM outbox_events
          WHERE idempotency_key LIKE 'in-app:integration.%'`,
      );
      assert.equal(outbox.rows[0]?.count, 4);
    });
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
