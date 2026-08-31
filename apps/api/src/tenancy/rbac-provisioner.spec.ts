import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { requireRbacProvisionTarget } from './rbac-provisioner.js';

test('RBAC provisioning accepts only explicit non-production targets', () => {
  assert.equal(requireRbacProvisionTarget('development'), 'development');
  assert.equal(requireRbacProvisionTarget('staging'), 'staging');
  assert.equal(requireRbacProvisionTarget('ephemeral'), 'ephemeral');
});

test('RBAC provisioning rejects Production and missing targets', () => {
  assert.throws(() => requireRbacProvisionTarget('production'), /forbidden/i);
  assert.throws(() => requireRbacProvisionTarget(undefined), /forbidden/i);
  assert.throws(() => requireRbacProvisionTarget(''), /forbidden/i);
});
