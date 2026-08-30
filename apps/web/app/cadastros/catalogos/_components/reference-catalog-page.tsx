import { OperationalPage } from '../../../_components/operational-page';
import { apiGet, type ApiResult } from '../../../_lib/api-client';

type SearchParamValue = string | string[] | undefined;
export type CatalogSearchParams = Promise<Record<string, SearchParamValue>>;

type FilterOption = string | { label: string; value: string };
type CatalogFilter = {
  readonly label: string;
  readonly name: string;
  readonly options?: readonly FilterOption[];
  readonly placeholder?: string;
};

type CatalogColumn = {
  readonly key: string;
  readonly label: string;
  readonly align?: 'left' | 'right';
};

interface ReferenceItem {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly [key: string]: unknown;
}

interface ReferencePage {
  readonly items: readonly ReferenceItem[];
  readonly page: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  };
}

interface ReferenceCatalogPageProps {
  readonly searchParams: CatalogSearchParams;
  readonly slug: string;
  readonly basePath: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly columns: readonly CatalogColumn[];
  readonly mapRow: (item: ReferenceItem) => Record<string, string>;
  readonly filters?: readonly CatalogFilter[];
  readonly integrationNotes?: readonly string[];
  readonly readOnly?: boolean;
}

const activeFilter: CatalogFilter = {
  label: 'Status',
  name: 'active',
  options: [
    { label: 'Ativo', value: 'true' },
    { label: 'Inativo', value: 'false' },
  ],
};

export async function ReferenceCatalogPage({
  searchParams,
  slug,
  basePath,
  eyebrow,
  title,
  description,
  columns,
  mapRow,
  filters = [],
  integrationNotes = [],
  readOnly = false,
}: Readonly<ReferenceCatalogPageProps>) {
  const rawParams = await searchParams;
  const values = singleValueParams(rawParams);
  const limit = 25;
  const offset = positiveInteger(values.offset) ?? 0;
  const query = pickQuery(
    values,
    filters.map((filter) => filter.name),
  );
  const result = await apiGet<ReferencePage>(`/api/v1/reference-data/${slug}`, {
    ...query,
    limit: String(limit),
    offset: String(offset),
  });
  const view = toViewState(result);
  const page = result.kind === 'ready' ? result.data.page : undefined;
  const rows = result.kind === 'ready' ? result.data.items.map(mapRow) : [];

  return (
    <OperationalPage
      eyebrow={eyebrow}
      title={title}
      description={description}
      status={view.status}
      filters={[activeFilter, ...filters]}
      columns={[...columns]}
      rows={rows}
      filterAction={basePath}
      filterValues={values}
      totalRows={page?.total}
      emptyTitle={view.emptyTitle}
      emptyDescription={view.message}
      pagination={
        page ? paginationFor(basePath, values, page.total, page.limit, page.offset) : undefined
      }
      integrationNotes={[
        `GET /api/v1/reference-data/${slug} conectado com filtros e paginação server-side.`,
        readOnly
          ? 'Catálogo global exposto como somente leitura para tenants.'
          : 'POST/PATCH disponíveis no contrato; lifecycle por isActive, sem DELETE físico.',
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

function pickQuery(
  values: Readonly<Record<string, string>>,
  extraFilterNames: readonly string[],
): Record<string, string | undefined> {
  const allowed = new Set(['q', 'active', ...extraFilterNames]);
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key)) output[key] = value;
  }
  return output;
}

function positiveInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function toViewState(result: ApiResult<ReferencePage>): {
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

function paginationFor(
  basePath: string,
  values: Readonly<Record<string, string>>,
  total: number,
  limit: number,
  offset: number,
): { label: string; previousHref?: string; nextHref?: string } {
  const pageNumber = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    label: `Página ${pageNumber} de ${totalPages}`,
    previousHref: offset > 0 ? pageHref(basePath, values, Math.max(0, offset - limit)) : undefined,
    nextHref: offset + limit < total ? pageHref(basePath, values, offset + limit) : undefined,
  };
}

function pageHref(
  basePath: string,
  values: Readonly<Record<string, string>>,
  offset: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key !== 'offset' && value) params.set(key, value);
  }
  if (offset > 0) params.set('offset', String(offset));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function displayValue(value: unknown, fallback = '—'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

export function displayBoolean(value: unknown, positive = 'Sim', negative = 'Não'): string {
  return value === true ? positive : value === false ? negative : '—';
}

export function displayStatus(item: ReferenceItem): string {
  return item.isActive ? 'Ativo' : 'Inativo';
}
