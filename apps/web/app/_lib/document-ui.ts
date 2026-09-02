export type DocumentRecord = Readonly<Record<string, unknown>>;

export interface ReferenceDocumentType {
  readonly id: string;
  readonly name: string;
  readonly code?: unknown;
  readonly subjectScope?: unknown;
  readonly hasExpiry?: unknown;
  readonly requiresValidation?: unknown;
  readonly isActive?: unknown;
}

export interface ReferenceDocumentTypePage {
  readonly items: readonly ReferenceDocumentType[];
  readonly page: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  };
}

export interface DocumentCompliancePolicyRecord {
  readonly documentTypeId: string;
  readonly warningDays?: unknown;
  readonly requiredForContracting?: unknown;
  readonly requiredForTrip?: unknown;
  readonly blockWhenExpiringSoon?: unknown;
  readonly isActive?: unknown;
}

export type DocumentSearchParams = Promise<Record<string, string | string[] | undefined>>;

export type DocumentTargetKind = 'party' | 'driver' | 'asset' | 'request';
export interface DocumentTargetOption {
  readonly kind: DocumentTargetKind;
  readonly id: string;
  readonly label: string;
}

export function singleValues(
  input: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) output[key] = first;
  }
  return output;
}

export function documentText(value: unknown, fallback = '—'): string {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

export function documentDate(value: unknown): string {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split('-');
  return year && month && day ? `${day}/${month}/${year}` : raw;
}

export function documentDateTime(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

export function documentBytes(value: unknown): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function documentStatusLabel(value: unknown): string {
  const labels: Readonly<Record<string, string>> = {
    draft: 'Rascunho',
    pending: 'Pendente',
    valid: 'Válido',
    expiring_soon: 'A vencer',
    rejected: 'Reprovado',
    expired: 'Vencido',
    archived: 'Arquivado',
    invalid: 'Inválido',
    review_required: 'Revisão necessária',
    manual: 'Manual',
    system: 'Sistema',
    external: 'Externa',
  };
  return labels[String(value ?? '')] ?? documentText(value);
}

export function documentTabs() {
  return [
    { href: '/documentos', label: 'Todos' },
    { href: '/documentos/validacoes', label: 'Validações' },
    { href: '/documentos/vencimentos', label: 'Vencimentos' },
  ];
}

export function effectiveStatus(item: DocumentRecord): string {
  return documentText(item.effective_status ?? item.status, 'draft');
}

export function policyWarningDays(
  item: DocumentRecord,
  policies: readonly DocumentCompliancePolicyRecord[],
  fallback = 30,
): number {
  const documentTypeId = String(item.document_type_id ?? '');
  const policy = policies.find(
    (candidate) => candidate.documentTypeId === documentTypeId && candidate.isActive !== false,
  );
  const configured = Number(policy?.warningDays);
  return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
}

export function policyAwareStatus(
  item: DocumentRecord,
  policies: readonly DocumentCompliancePolicyRecord[],
): string {
  const current = effectiveStatus(item);
  if (current !== 'valid') return current;
  return isExpiringWithin(item, policyWarningDays(item, policies)) ? 'expiring_soon' : current;
}

export function isExpiringWithin(item: DocumentRecord, days: number): boolean {
  if (!item.expires_on) return false;
  const expiry = new Date(`${String(item.expires_on).slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(expiry)) return false;
  const now = Date.now();
  const upper = now + days * 86_400_000;
  return expiry >= now && expiry <= upper;
}
