import { Injectable } from '@nestjs/common';

import type {
  ComplianceRiskProviderInput,
  ComplianceRiskProviderPort,
  ComplianceRiskProviderResult,
} from './compliance-risk-provider.port.js';

@Injectable()
export class UnconfiguredComplianceRiskProviderAdapter implements ComplianceRiskProviderPort {
  evaluate(_input: ComplianceRiskProviderInput): Promise<ComplianceRiskProviderResult | null> {
    return Promise.resolve(null);
  }
}
