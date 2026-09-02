export type ComplianceRiskSubjectScope = 'party' | 'driver' | 'asset' | 'document';
export type ComplianceRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceRiskSignal {
  readonly code: string;
  readonly severity: ComplianceRiskSeverity;
  readonly message: string;
  readonly scoreDelta: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ComplianceRiskProviderInput {
  readonly tenantId: string;
  readonly subjectScope: ComplianceRiskSubjectScope;
  readonly subjectId: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export interface ComplianceRiskProviderResult {
  readonly provider: string;
  readonly reference?: string | null;
  readonly signals: readonly ComplianceRiskSignal[];
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ComplianceRiskProviderPort {
  evaluate(input: ComplianceRiskProviderInput): Promise<ComplianceRiskProviderResult | null>;
}

export const COMPLIANCE_RISK_PROVIDER_PORT = Symbol('COMPLIANCE_RISK_PROVIDER_PORT');
