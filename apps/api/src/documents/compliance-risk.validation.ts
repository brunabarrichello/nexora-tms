import { BadRequestException } from '@nestjs/common';

import type { ComplianceRiskSubjectScope } from './compliance-risk-provider.port.js';

export type ComplianceRiskDecision = 'approve' | 'review' | 'block';

export interface ComplianceRiskManualDecisionInput {
  readonly decision: ComplianceRiskDecision;
  readonly reason: string;
}

const subjectScopes = new Set<ComplianceRiskSubjectScope>(['party', 'driver', 'asset', 'document']);
const decisions = new Set<ComplianceRiskDecision>(['approve', 'review', 'block']);

export function parseComplianceRiskSubjectScope(value: unknown): ComplianceRiskSubjectScope {
  if (typeof value !== 'string' || !subjectScopes.has(value as ComplianceRiskSubjectScope)) {
    throw new BadRequestException('subjectScope must be party, driver, asset or document');
  }
  return value as ComplianceRiskSubjectScope;
}

export function parseComplianceRiskDecision(input: unknown): ComplianceRiskManualDecisionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Request body must be an object');
  }
  const body = input as Record<string, unknown>;
  if (typeof body.decision !== 'string' || !decisions.has(body.decision as ComplianceRiskDecision)) {
    throw new BadRequestException('decision must be approve, review or block');
  }
  if (typeof body.reason !== 'string') {
    throw new BadRequestException('reason must be a string');
  }
  const reason = body.reason.trim();
  if (reason.length < 10 || reason.length > 1500) {
    throw new BadRequestException('reason must contain between 10 and 1500 characters');
  }
  return { decision: body.decision as ComplianceRiskDecision, reason };
}
