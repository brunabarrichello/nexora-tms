import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { CapacityReservationController } from './capacity-reservation.controller.js';
import { FreightProposalController } from './freight-proposal.controller.js';
import { NegotiationCollaborationController } from './negotiation-collaboration.controller.js';
import { TransportContractController } from './transport-contract.controller.js';

const reflector = new Reflector();

function assertPermission(method: (...args: never[]) => unknown, permission: string): void {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, method), permission);
}

test('Negotiation controllers default to negotiation.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, CapacityReservationController),
    'negotiation.read',
  );
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, FreightProposalController),
    'negotiation.read',
  );
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, NegotiationCollaborationController),
    'negotiation.read',
  );
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, TransportContractController),
    'negotiation.read',
  );
});

test('Reservation and proposal mutations require negotiation.write', () => {
  const methods = [
    CapacityReservationController.prototype.approve,
    CapacityReservationController.prototype.cancel,
    FreightProposalController.prototype.create,
    FreightProposalController.prototype.counterproposal,
    FreightProposalController.prototype.setStatus,
  ];

  for (const method of methods) {
    assertPermission(method, 'negotiation.write');
  }
});

test('Collaboration mutations require negotiation.write', () => {
  const methods = [
    NegotiationCollaborationController.prototype.createThread,
    NegotiationCollaborationController.prototype.setThreadStatus,
    NegotiationCollaborationController.prototype.addParticipant,
    NegotiationCollaborationController.prototype.removeParticipant,
    NegotiationCollaborationController.prototype.createMessage,
  ];

  for (const method of methods) {
    assertPermission(method, 'negotiation.write');
  }
});

test('Transport contract mutations require negotiation.write', () => {
  const methods = [
    TransportContractController.prototype.confirm,
    TransportContractController.prototype.refuse,
    TransportContractController.prototype.cancel,
  ];

  for (const method of methods) {
    assertPermission(method, 'negotiation.write');
  }
});
