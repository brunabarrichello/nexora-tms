import {
  DocumentLinkForm,
  type DocumentLinkTargetOption,
} from '../../../../_components/document-forms';
import { apiGet } from '../../../../_lib/api-client';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ documentId: string }> }>) {
  const { documentId } = await params;
  const document = await apiGet<Record<string, unknown>>(`/api/v1/documents/${documentId}`);
  const subjectScope =
    document.kind === 'ready' && typeof document.data.subject_scope === 'string'
      ? document.data.subject_scope
      : 'other';

  const [parties, drivers, assets, requests] = await Promise.all([
    shouldLoad(subjectScope, 'party')
      ? apiGet<readonly Record<string, unknown>[]>('/api/v1/master-data/business-parties')
      : Promise.resolve(null),
    shouldLoad(subjectScope, 'driver')
      ? apiGet<readonly Record<string, unknown>[]>('/api/v1/capacity/drivers')
      : Promise.resolve(null),
    shouldLoad(subjectScope, 'asset')
      ? apiGet<readonly Record<string, unknown>[]>('/api/v1/capacity/assets')
      : Promise.resolve(null),
    shouldLoad(subjectScope, 'request')
      ? apiGet<readonly Record<string, unknown>[]>('/api/v1/freight/transport-requests')
      : Promise.resolve(null),
  ]);

  const targets: DocumentLinkTargetOption[] = [
    ...mapTargets(parties, 'party', (item) =>
      joinLabel(item.legalName ?? item.tradeName, item.taxId),
    ),
    ...mapTargets(drivers, 'driver', (item) => joinLabel(item.fullName, item.cnhNumber)),
    ...mapTargets(assets, 'asset', (item) =>
      joinLabel(item.identifier ?? item.plate, item.assetKind ?? item.vehicleType),
    ),
    ...mapTargets(requests, 'request', (item) =>
      joinLabel(item.cargoDescription, item.status ?? item.plannedPickupAt),
    ),
  ];

  return <DocumentLinkForm documentId={documentId} subjectScope={subjectScope} targets={targets} />;
}

function shouldLoad(subjectScope: string, targetScope: string): boolean {
  return subjectScope === 'other' || subjectScope === targetScope;
}

function mapTargets(
  result:
    | Awaited<ReturnType<typeof apiGet<readonly Record<string, unknown>[]>>>
    | null,
  kind: string,
  label: (item: Record<string, unknown>) => string,
): DocumentLinkTargetOption[] {
  if (!result || result.kind !== 'ready') return [];
  return result.data.flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id : '';
    return id ? [{ kind, id, label: label(item) }] : [];
  });
}

function joinLabel(primary: unknown, secondary: unknown): string {
  const values = [primary, secondary]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(String);
  return values.join(' • ') || 'Registro sem identificação textual';
}
