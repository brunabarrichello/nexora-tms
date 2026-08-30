import { DocumentLinkForm } from '../../../../_components/document-forms';
import { apiGet } from '../../../../_lib/api-client';
import type { DocumentRecord, DocumentTargetOption } from '../../../../_lib/document-ui';

export default async function Page({ params }: Readonly<{ params: Promise<{ documentId: string }> }>) {
  const { documentId } = await params;
  const document = await apiGet<DocumentRecord>(`/api/v1/documents/${documentId}`);
  const subjectScope = document.kind === 'ready' ? String(document.data.subject_scope ?? 'other') : 'other';

  const [parties, drivers, assets, requests] = await Promise.all([
    loadIf(subjectScope, 'party', '/api/v1/master-data/business-parties'),
    loadIf(subjectScope, 'driver', '/api/v1/capacity/drivers'),
    loadIf(subjectScope, 'asset', '/api/v1/capacity/assets'),
    loadIf(subjectScope, 'request', '/api/v1/freight/transport-requests'),
  ]);

  const targets: DocumentTargetOption[] = [
    ...toTargets(parties, 'party', (item) => label(item.legalName ?? item.tradeName, item.taxId)),
    ...toTargets(drivers, 'driver', (item) => label(item.fullName, item.cnhNumber)),
    ...toTargets(assets, 'asset', (item) => label(item.identifier ?? item.plate, item.assetKind ?? item.vehicleType)),
    ...toTargets(requests, 'request', (item) => label(item.cargoDescription, item.status ?? item.plannedPickupAt)),
  ];

  return <DocumentLinkForm documentId={documentId} subjectScope={subjectScope} targets={targets} />;
}

async function loadIf(subjectScope: string, targetScope: string, endpoint: string) {
  if (subjectScope !== 'other' && subjectScope !== targetScope) return null;
  return apiGet<readonly Record<string, unknown>[]>(endpoint);
}

function toTargets(
  result: Awaited<ReturnType<typeof loadIf>>,
  kind: DocumentTargetOption['kind'],
  buildLabel: (item: Record<string, unknown>) => string,
): DocumentTargetOption[] {
  if (!result || result.kind !== 'ready') return [];
  return result.data.flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id : '';
    return id ? [{ kind, id, label: buildLabel(item) }] : [];
  });
}

function label(primary: unknown, secondary: unknown): string {
  const values = [primary, secondary]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(String);
  return values.join(' • ') || 'Registro sem identificação textual';
}
