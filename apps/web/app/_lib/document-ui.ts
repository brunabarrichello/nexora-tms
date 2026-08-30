export type DocumentRecord = Readonly<Record<string, unknown>>;

export interface DocumentPageData {
  readonly items: readonly DocumentRecord[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

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
  readonly page: { readonly total: number; readonly limit: number; readonly offset: number };
}

export type DocumentSearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  const parts = raw.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : raw;
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
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function documentStatusLabel(value: unknown): string {
  const status = String(value ?? '');
  const labels: Readonly<Record<string, string>> = {
    draft: 'Rascunho',
    active: 'Ativo',
    expired: 'Vencido',
    blocked: 'Bloqueado',
    archived: 'Arquivado',
    pending: 'Pendente',
    validated: 'Validado',
    rejected: 'Reprovado',
    not_required: 'Não exigida',
    warning: 'Alerta',
    not_applicable: 'Não aplicável',
  };
  return labels[status] ?? documentText(value);
}

export function documentTabs() {
  return [
    { href: '/documentos', label: 'Todos' },
    { href: '/documentos/validacoes', label: 'Validações' },
    { href: '/documentos/vencimentos', label: 'Vencimentos' },
  ];
}
