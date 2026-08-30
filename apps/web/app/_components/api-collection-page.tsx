import { OperationalPage } from './operational-page';
import { apiGet, type ApiResult } from '../_lib/api-client';

type SearchParamValue = string | string[] | undefined;
export type CollectionSearchParams = Promise<Record<string, SearchParamValue>>;

export interface ApiCollectionRecord {
  readonly id: string;
  readonly [key: string]: unknown;
}

type FilterOption = string | { label: string; value: string };
type CollectionFilter = {
  readonly label: string;
  readonly name: string;
  readonly options?: readonly FilterOption[];
  readonly placeholder?: string;
};

type CollectionColumn = {
  readonly key: string;
  readonly label: string;
  readonly align?: 'left' | 'right';
  readonly hrefKey?: string;
};

type CollectionAction = {
  readonly href: string;
  readonly label: string;
  readonly variant?: 'primary' | 'secondary';
};

export async function ApiCollectionPage({
  searchParams,
  endpoint,
  basePath,
  eyebrow,
  title,
  description,
  columns,
  mapRow,
  filters = [],
  filterItem,
  actions = [],
  integrationNotes = [],
}: Readonly<{
  searchParams: CollectionSearchParams;
  endpoint: string;
  basePath: string;
  eyebrow: string;
  title: string;
  description: string;
  columns: readonly CollectionColumn[];
  mapRow: (item: ApiCollectionRecord) => Record<string, string>;
  filters?: readonly CollectionFilter[];
  filterItem?: (item: ApiCollectionRecord, values: Readonly<Record<string, string>>) => boolean;
  actions?: readonly CollectionAction[];
  integrationNotes?: readonly string[];
}>) {
  const rawParams = await searchParams;
  const values = singleValueParams(rawParams);
  const result = await apiGet<readonly ApiCollectionRecord[]>(endpoint);
  const view = toViewState(result);

  const records = result.kind === 'ready' ? result.data : [];
  const filtered = records.filter((item) => {
    if (filterItem && !filterItem(item, values)) return false;
    if (!values.q) return true;
    const row = mapRow(item);
    const needle = normalize(values.q);
    return Object.values(row).some((value) => normalize(value).includes(needle));
  });
  const rows = filtered.map(mapRow);
  const status = values.saved === '1' && result.kind === 'ready' ? 'Cadastro salvo' : view.status;

  return (
    <OperationalPage
      eyebrow={eyebrow}
      title={title}
      description={description}
      status={status}
      filters={[...filters]}
      columns={[...columns]}
      rows={rows}
      actions={[...actions]}
      filterAction={basePath}
      filterValues={values}
      totalRows={result.kind === 'ready' ? filtered.length : undefined}
      emptyTitle={view.emptyTitle}
      emptyDescription={view.message}
      integrationNotes={[
        `GET ${endpoint} conectado ao runtime tenant-aware.`,
        'O contrato atual retorna coleção completa; filtros da página são aplicados no servidor web sem inventar paginação da API.',
        ...integrationNotes,
      ]}
    />
  );
}

function singleValueParams(input: Record<string, SearchParamValue>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized) output[key] = normalized;
  }
  return output;
}

function toViewState(result: ApiResult<readonly ApiCollectionRecord[]>): {
  status: string;
  emptyTitle: string;
  message: string;
} {
  switch (result.kind) {
    case 'ready':
      return {
        status: 'API conectada',
        emptyTitle: 'Nenhum registro encontrado',
        message:
          'A consulta foi executada com sucesso, mas não retornou registros para os filtros atuais.',
      };
    case 'unconfigured':
      return {
        status: 'API não configurada',
        emptyTitle: 'Integração aguardando ambiente',
        message: result.message,
      };
    case 'unauthorized':
      return {
        status: 'Autorização pendente',
        emptyTitle: 'Sessão sem acesso à API',
        message: result.message,
      };
    case 'error':
      return {
        status: 'API indisponível',
        emptyTitle: 'Falha ao consultar dados',
        message: result.message,
      };
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function collectionText(value: unknown, fallback = '—'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

export function collectionBoolean(value: unknown, positive = 'Sim', negative = 'Não'): string {
  if (value === true) return positive;
  if (value === false) return negative;
  return '—';
}

export function collectionRoles(value: unknown): string {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(', ') : '—';
}

export function hasCollectionRole(item: ApiCollectionRecord, roles: readonly string[]): boolean {
  if (!Array.isArray(item.roles)) return false;
  return item.roles.some((role) => typeof role === 'string' && roles.includes(role));
}
