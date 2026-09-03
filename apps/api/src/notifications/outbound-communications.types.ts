export type CommunicationChannel = 'email' | 'whatsapp' | 'sms';
export type CommunicationRecipientType = 'driver' | 'party_contact';
export type CommunicationTemplateStatus = 'draft' | 'active' | 'retired';
export type CommunicationConsentStatus = 'granted' | 'denied' | 'unknown';
export type OutboundCommunicationStatus =
  | 'queued'
  | 'retry_wait'
  | 'sent'
  | 'failed'
  | 'blocked'
  | 'cancelled';

export interface CommunicationProviderRouteRecord {
  readonly id: string;
  readonly channel: CommunicationChannel;
  readonly providerCode: string;
  readonly status: 'active' | 'disabled';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CommunicationTemplateRecord {
  readonly id: string;
  readonly templateKey: string;
  readonly channel: CommunicationChannel;
  readonly locale: string;
  readonly version: number;
  readonly subjectTemplate: string | null;
  readonly bodyTemplate: string;
  readonly status: CommunicationTemplateStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CommunicationPreferenceRecord {
  readonly id: string;
  readonly recipientType: CommunicationRecipientType;
  readonly recipientId: string;
  readonly channel: CommunicationChannel;
  readonly enabled: boolean;
  readonly consentStatus: CommunicationConsentStatus;
  readonly consentSource: string | null;
  readonly consentedAt: string | null;
  readonly policyVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OutboundCommunicationRecord {
  readonly id: string;
  readonly templateId: string;
  readonly templateKey: string;
  readonly templateVersion: number;
  readonly channel: CommunicationChannel;
  readonly recipientType: CommunicationRecipientType;
  readonly recipientId: string;
  readonly providerCode: string | null;
  readonly status: OutboundCommunicationStatus;
  readonly blockedReason: string | null;
  readonly lastError: string | null;
  readonly durableJobId: string | null;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sentAt: string | null;
}

export interface OutboundCommunicationAttemptRecord {
  readonly id: string;
  readonly attemptNo: number;
  readonly jobAttempt: number;
  readonly providerCode: string;
  readonly outcome: 'success' | 'failure' | 'cancelled';
  readonly providerMessageId: string | null;
  readonly statusCode: number | null;
  readonly durationMs: number;
  readonly errorMessage: string | null;
  readonly createdAt: string;
}

export interface QueueCommunicationResult {
  readonly communication: OutboundCommunicationRecord;
  readonly blocked: boolean;
  readonly blockedReason: string | null;
}
