import { OperationalPage } from './operational-page';
import { apiGet, type ApiResult } from '../_lib/api-client';
import {
  qualificationEndpoint,
  type QualificationColumn,
  type QualificationConfig,
} from '../_lib/qualification-config';

export type QualificationSearchParams = Promise<Record<string, string | string[] | undefined>>;
type QualificationRecord = { readonly id: string; readonly [key: string]: unknown };

type SubjectRecord = QualificationRecord & {
  readonly fullName?: unknown;
  readonly identifier?: unknown;
  readonly plate?: unknown;
  readonly assetKind?: unknown;
};

export async function QualificationResourcePage({
  config,
  searchParams,
}: Readonly<{
  config: QualificationConfig;
  searchParams: QualificationSearchParams;
}>) {
  const rawParams = await searchParams;
  const values = singleValues(rawParams);
  const subjectKey = config.scope === 'driver' ? 'driverId' : 'assetId';
  const subjectEndpoint = config.scope === 'driver' ? '/api/v1/capacity/drivers' : '/api/v1/capacity/assets';
  const subjectsResult = await apiGet<readonly SubjectRecord[]>(subjectEndpoint);
  const subjects = subjectsResult.kind === 'ready' ? subjectsResult.data : [];
  const subjectId = values[subjectKey];

  let maintenanceOptions: readonly { label: string; value: string }[] = [];
  let maintenanceId = values.maintenanceId;
  if (config.requiresMaintenance && subjectId) {
    const maintenanceResult = await apiGet<readonly QualificationRecord[]>(
      `/api/v1/capacity/assets/${subjectId}/maintenance`,
    );
    if (maintenanceResult.kind === 'ready') {
      maintenanceOptions = maintenanceResult.data.map((item) => ({
        value: item.id,
        label: `${text(item.maintenance_type, 'manutenção')} • ${text(item.status)} • ${text(item.planned_at, 'sem data')}`,
      }));
      if (maintenanceId && !maintenanceOptions.some((option) => option.value === maintenanceId)) {
        maintenanceId = undefined;
      }
    }
  }

  const canQuery = Boolean(subjectId && (!config.requiresMaintenance || maintenanceId));
  let result: ApiResult<readonly QualificationRecord[]> | null = null;
  if (canQuery && subjectId) {
    const endpoint = qualificationEndpoint(config, subjectId, maintenanceId);
    if (config.singleton) {
      const single = await apiGet<QualificationRecord>(endpoint);
      result = single.kind === 'ready' ? { kind: 'ready', data: [single.data] } : single;
    } else {
      result = await apiGet<readonly QualificationRecord[]>(endpoint);
    }
  }

  const records = result?.kind === 'ready' ? result.data : [];
  const filtered = values.q
    ? records.filter((record) => searchable(record).includes(normalize(values.q)))
    : records;
  const rows = filtered.map((record) => mapRow(config, record, subjectId, maintenanceId));
  const state = viewState(subjectsResult, result, Boolean(subjectId), Boolean(maintenanceId), config);
  const saved = values.saved === '1' && result?.kind === 'ready';
  const filters: Array<{
    label: string;
    name: string;
    options: readonly { label: string; value: string }[];
  }> = [
    {
      label: config.scope === 'driver' ? 'Motorista' : 'Ativo',
      name: subjectKey,
      options: subjects.map((subject) => ({ value: subject.id, label: subjectLabel(config, subject) })),
    },
  ];
  if (config.requiresMaintenance) {
    filters.push({ label: 'Manutenção', name: 'maintenanceId', options: maintenanceOptions });
  }

  const actions = [] as Array<{ href: string; label: string; variant?: 'primary' | 'secondary' }>;
  if (subjectId && (!config.requiresMaintenance || maintenanceId)) {
    const params = maintenanceId ? `?maintenanceId=${encodeURIComponent(maintenanceId)}` : '';
    actions.push({
      href: `/cadastros/qualificacao/${config.scope}/${subjectId}/${config.resource}/novo${params}`,
      label: config.method === 'PUT' ? 'Configurar' : `Adicionar ${config.singular}`,
    });
  }

  return (
    <OperationalPage
      eyebrow="Capacity • Wave 0017"
      title={config.title}
      description={config.description}
      status={saved ? 'Registro salvo' : state.status}
      filters={filters}
      filterAction={config.returnPath}
      filterValues={values}
      columns={config.columns.map(columnForTable)}
      rows={rows}
      actions={actions}
      tabs={resourceTabs(config, subjectId)}
      totalRows={result?.kind === 'ready' ? filtered.length : undefined}
      emptyTitle={state.emptyTitle}
      emptyDescription={state.message}
      integrationNotes={[
        `Contrato oficial: ${config.method} + GET ${config.endpointSegment}.`,
        'Motorista/ativo é selecionado por ID retornado da API; tenant e usuário não são parâmetros editáveis.',
        config.method === 'POST'
          ? 'O histórico é acrescentado sem expor edição ou exclusão física não prevista no contrato.'
          : 'A configuração usa upsert PUT idempotente no agregado selecionado.',
      ]}
    />
  );
}

function mapRow(
  config: QualificationConfig,
  record: QualificationRecord,
  subjectId?: string,
  maintenanceId?: string,
): Record<string, string> {
  const row: Record<string, string> = { id: record.id };
  for (const column of config.columns) {
    const sourceKey = column.sourceKey ?? column.key;
    if (column.kind === 'block-action') {
      const released = Boolean(record.released_at);
      row[column.key] = released ? 'Liberado' : 'Liberar';
      if (!released && subjectId) {
        row[`${column.key}Href`] = `/cadastros/qualificacao/${config.scope}/${subjectId}/${config.resource}/${record.id}/release`;
      }
      continue;
    }
    if (column.kind === 'maintenance-items') {
      row[column.key] = 'Abrir itens';
      if (subjectId) {
        row[`${column.key}Href`] = `/cadastros/veiculos/manutencoes/itens?assetId=${encodeURIComponent(subjectId)}&maintenanceId=${encodeURIComponent(record.id)}`;
      }
      continue;
    }
    row[column.key] = formatValue(record[sourceKey], column.kind);
  }
  if (maintenanceId) row.maintenanceId = maintenanceId;
  return row;
}

function columnForTable(column: QualificationColumn) {
  return {
    key: column.key,
    label: column.label,
    align: column.align,
    hrefKey:
      column.kind === 'block-action' || column.kind === 'maintenance-items'
        ? `${column.key}Href`
        : undefined,
  } as const;
}

function resourceTabs(config: QualificationConfig, subjectId?: string) {
  const query = subjectId
    ? `?${config.scope === 'driver' ? 'driverId' : 'assetId'}=${encodeURIComponent(subjectId)}`
    : '';
  const driverTabs = [
    ['/cadastros/motoristas/documentos', 'Documentos'],
    ['/cadastros/motoristas/qualificacoes', 'Qualificações'],
    ['/cadastros/motoristas/cursos', 'Cursos'],
    ['/cadastros/motoristas/disponibilidade', 'Disponibilidade'],
    ['/cadastros/motoristas/indisponibilidades', 'Indisponibilidades'],
    ['/cadastros/motoristas/contatos-emergencia', 'Emergência'],
    ['/cadastros/motoristas/bloqueios', 'Bloqueios'],
    ['/cadastros/motoristas/avaliacoes', 'Avaliações'],
  ] as const;
  const assetTabs = [
    ['/cadastros/veiculos/capabilities', 'Capabilities'],
    ['/cadastros/veiculos/documentos', 'Documentos'],
    ['/cadastros/veiculos/planos-manutencao', 'Planos'],
    ['/cadastros/veiculos/manutencoes', 'Manutenções'],
    ['/cadastros/veiculos/seguros', 'Seguros'],
    ['/cadastros/veiculos/inspecoes', 'Inspeções'],
    ['/cadastros/veiculos/disponibilidade', 'Disponibilidade'],
    ['/cadastros/veiculos/indisponibilidades', 'Indisponibilidades'],
    ['/cadastros/veiculos/localizacoes', 'Localizações'],
    ['/cadastros/veiculos/bloqueios', 'Bloqueios'],
  ] as const;
  return (config.scope === 'driver' ? driverTabs : assetTabs).map(([href, label]) => ({
    href: `${href}${query}`,
    label,
  }));
}

function viewState(
  subjects: ApiResult<readonly SubjectRecord[]>,
  result: ApiResult<readonly QualificationRecord[]> | null,
  hasSubject: boolean,
  hasMaintenance: boolean,
  config: QualificationConfig,
): { status: string; emptyTitle: string; message: string } {
  if (subjects.kind !== 'ready') return resultState(subjects);
  if (!hasSubject) {
    return {
      status: 'Selecione um cadastro',
      emptyTitle: config.scope === 'driver' ? 'Selecione um motorista' : 'Selecione um ativo',
      message: 'Use o filtro acima para escolher um registro real antes de consultar a Wave 0017.',
    };
  }
  if (config.requiresMaintenance && !hasMaintenance) {
    return {
      status: 'Selecione uma manutenção',
      emptyTitle: 'Manutenção necessária',
      message: 'Escolha uma execução de manutenção para consultar ou adicionar seus itens.',
    };
  }
  if (!result) return { status: 'Aguardando consulta', emptyTitle: 'Sem consulta', message: 'Selecione os filtros obrigatórios.' };
  if (result.kind === 'ready') {
    return {
      status: 'API conectada',
      emptyTitle: 'Nenhum registro encontrado',
      message: config.singleton
        ? 'Ainda não existe configuração persistida. Use Configurar para criar o estado inicial.'
        : 'A API respondeu com sucesso e ainda não há registros neste histórico.',
    };
  }
  if (config.singleton && result.kind === 'error' && result.message.toLowerCase().includes('not found')) {
    return {
      status: 'Ainda não configurado',
      emptyTitle: 'Configuração ausente',
      message: 'Use Configurar para persistir o estado inicial deste recurso.',
    };
  }
  return resultState(result);
}

function resultState(result: Exclude<ApiResult<unknown>, { kind: 'ready'; data: unknown }> | ApiResult<unknown>) {
  switch (result.kind) {
    case 'ready':
      return { status: 'API conectada', emptyTitle: 'Sem registros', message: 'A consulta não retornou dados.' };
    case 'unconfigured':
      return { status: 'API não configurada', emptyTitle: 'Integração aguardando ambiente', message: result.message };
    case 'unauthorized':
      return { status: 'Autorização pendente', emptyTitle: 'Sessão sem acesso à API', message: result.message };
    case 'error':
      return { status: 'API indisponível', emptyTitle: 'Falha ao consultar dados', message: result.message };
  }
}

function subjectLabel(config: QualificationConfig, subject: SubjectRecord): string {
  if (config.scope === 'driver') return text(subject.fullName, subject.id);
  const plate = text(subject.plate, 'sem placa');
  return `${text(subject.identifier, subject.id)} • ${plate} • ${text(subject.assetKind)}`;
}

function formatValue(value: unknown, kind: QualificationColumn['kind']): string {
  if (value === undefined || value === null || value === '') return '—';
  if (kind === 'boolean') return value === true ? 'Sim' : value === false ? 'Não' : text(value);
  if (kind === 'date') {
    const raw = String(value).slice(0, 10);
    const parts = raw.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : raw;
  }
  if (kind === 'datetime') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
  }
  if (kind === 'json' || (typeof value === 'object' && value !== null)) return JSON.stringify(value);
  return String(value);
}

function searchable(record: QualificationRecord): string {
  return normalize(
    Object.values(record)
      .map((value) => (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')))
      .join(' '),
  );
}

function singleValues(input: Record<string, string | string[] | undefined>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) output[key] = first;
  }
  return output;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function text(value: unknown, fallback = '—'): string {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}
