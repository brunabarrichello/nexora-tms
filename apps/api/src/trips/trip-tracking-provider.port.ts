export type TrackingEtaSource = 'provider' | 'calculated';

export interface TrackingProviderPosition {
  readonly providerEventId: string;
  readonly tripStopId?: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM?: number | null;
  readonly speedKmh?: number | null;
  readonly headingDegrees?: number | null;
  readonly recordedAt: string;
  readonly etaAt?: string | null;
  readonly etaSource?: TrackingEtaSource | null;
  readonly metadata?: Record<string, unknown>;
}

export interface TrackingProviderAdapter {
  readonly key: string;
  normalizeEvent(input: unknown): Promise<TrackingProviderPosition> | TrackingProviderPosition;
}

export const TRACKING_PROVIDER_ADAPTERS = Symbol('TRACKING_PROVIDER_ADAPTERS');
