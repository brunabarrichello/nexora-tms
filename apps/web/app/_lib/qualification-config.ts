export type QualificationScope = 'driver' | 'asset';
export type QualificationMethod = 'POST' | 'PUT';
export type QualificationFieldType =
  'text' | 'number' | 'date' | 'datetime' | 'select' | 'boolean' | 'json';

export type QualificationField = {
  readonly name: string;
  readonly label: string;
  readonly type?: QualificationFieldType;
  readonly required?: boolean;
  readonly wide?: boolean;
  readonly step?: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly options?: readonly { readonly label: string; readonly value: string }[];
};

export type QualificationColumn = {
  readonly key: string;
  readonly label: string;
  readonly sourceKey?: string;
  readonly kind?:
    'text' | 'boolean' | 'date' | 'datetime' | 'json' | 'block-action' | 'maintenance-items';
  readonly align?: 'left' | 'right';
};

export type QualificationResource =
  | 'driver-document'
  | 'driver-qualification'
  | 'driver-course'
  | 'driver-availability'
  | 'driver-unavailability'
  | 'driver-emergency-contact'
  | 'driver-block'
  | 'driver-rating'
  | 'asset-capabilities'
  | 'asset-document'
  | 'asset-maintenance-plan'
  | 'asset-maintenance'
  | 'asset-maintenance-item'
  | 'asset-insurance'
  | 'asset-inspection'
  | 'asset-availability'
  | 'asset-unavailability'
  | 'asset-location'
  | 'asset-block';

export type QualificationConfig = {
  readonly resource: QualificationResource;
  readonly scope: QualificationScope;
  readonly title: string;
  readonly singular: string;
  readonly description: string;
  readonly returnPath: string;
  readonly endpointSegment: string;
  readonly method: QualificationMethod;
  readonly singleton?: boolean;
  readonly requiresMaintenance?: boolean;
  readonly columns: readonly QualificationColumn[];
  readonly fields: readonly QualificationField[];
};

const lifecycleStatus = ['pending', 'valid', 'expired', 'blocked', 'inactive'].map((value) => ({
  label: value,
  value,
}));
const documentFields: readonly QualificationField[] = [
  { name: 'documentTypeId', label: 'Tipo de documento (UUID)', required: true, wide: true },
  { name: 'documentNumber', label: 'Número do documento' },
  { name: 'issuer', label: 'Emissor' },
  { name: 'issuedOn', label: 'Emissão', type: 'date' },
  { name: 'expiresOn', label: 'Validade', type: 'date' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    defaultValue: 'pending',
    options: lifecycleStatus,
  },
  {
    name: 'validationStatus',
    label: 'Validação',
    type: 'select',
    defaultValue: 'pending',
    options: ['pending', 'validated', 'rejected', 'not_required'].map((value) => ({
      label: value,
      value,
    })),
  },
  { name: 'notes', label: 'Observações', wide: true },
];
const unavailabilityFields: readonly QualificationField[] = [
  { name: 'reasonCode', label: 'Código do motivo', required: true },
  { name: 'reason', label: 'Motivo', required: true, wide: true },
  { name: 'startsAt', label: 'Início', type: 'datetime', required: true },
  { name: 'endsAt', label: 'Fim', type: 'datetime', required: true },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    defaultValue: 'scheduled',
    options: ['scheduled', 'active', 'completed', 'cancelled'].map((value) => ({
      label: value,
      value,
    })),
  },
];
const availabilityColumns: readonly QualificationColumn[] = [
  { key: 'status', label: 'Status' },
  { key: 'from', label: 'Disponível desde', sourceKey: 'available_from', kind: 'datetime' },
  { key: 'until', label: 'Disponível até', sourceKey: 'available_until', kind: 'datetime' },
  { key: 'city', label: 'Cidade atual', sourceKey: 'current_city_id' },
  { key: 'notes', label: 'Observações' },
];

export const qualificationConfigs: Readonly<Record<QualificationResource, QualificationConfig>> = {
  'driver-document': {
    resource: 'driver-document',
    scope: 'driver',
    title: 'Documentos do motorista',
    singular: 'documento do motorista',
    description: 'Registro documental tipado e validável do motorista.',
    returnPath: '/cadastros/motoristas/documentos',
    endpointSegment: 'documents',
    method: 'POST',
    columns: [
      { key: 'number', label: 'Número', sourceKey: 'document_number' },
      { key: 'issuer', label: 'Emissor' },
      { key: 'expires', label: 'Validade', sourceKey: 'expires_on', kind: 'date' },
      { key: 'status', label: 'Status' },
      { key: 'validation', label: 'Validação', sourceKey: 'validation_status' },
    ],
    fields: documentFields,
  },
  'driver-qualification': {
    resource: 'driver-qualification',
    scope: 'driver',
    title: 'Qualificações do motorista',
    singular: 'qualificação',
    description: 'Licenças, certificações, autorizações e endorsements do motorista.',
    returnPath: '/cadastros/motoristas/qualificacoes',
    endpointSegment: 'qualifications',
    method: 'POST',
    columns: [
      { key: 'type', label: 'Tipo', sourceKey: 'qualification_type' },
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Qualificação' },
      { key: 'expires', label: 'Validade', sourceKey: 'expires_on', kind: 'date' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      {
        name: 'qualificationType',
        label: 'Tipo',
        type: 'select',
        required: true,
        options: ['license', 'endorsement', 'certification', 'authorization', 'other'].map(
          (value) => ({ label: value, value }),
        ),
      },
      { name: 'code', label: 'Código', required: true },
      { name: 'name', label: 'Nome', required: true, wide: true },
      { name: 'certificateNumber', label: 'Certificado' },
      { name: 'issuer', label: 'Emissor' },
      { name: 'issuedOn', label: 'Emissão', type: 'date' },
      { name: 'expiresOn', label: 'Validade', type: 'date' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'valid',
        options: lifecycleStatus,
      },
      { name: 'notes', label: 'Observações', wide: true },
    ],
  },
  'driver-course': {
    resource: 'driver-course',
    scope: 'driver',
    title: 'Cursos do motorista',
    singular: 'curso',
    description: 'Cursos concluídos, validade, carga horária e certificado.',
    returnPath: '/cadastros/motoristas/cursos',
    endpointSegment: 'courses',
    method: 'POST',
    columns: [
      { key: 'code', label: 'Código', sourceKey: 'course_code' },
      { key: 'name', label: 'Curso', sourceKey: 'course_name' },
      { key: 'provider', label: 'Instituição' },
      { key: 'completed', label: 'Conclusão', sourceKey: 'completed_on', kind: 'date' },
      { key: 'expires', label: 'Validade', sourceKey: 'expires_on', kind: 'date' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'courseCode', label: 'Código', required: true },
      { name: 'courseName', label: 'Curso', required: true, wide: true },
      { name: 'provider', label: 'Instituição' },
      { name: 'certificateNumber', label: 'Certificado' },
      { name: 'completedOn', label: 'Conclusão', type: 'date', required: true },
      { name: 'expiresOn', label: 'Validade', type: 'date' },
      { name: 'workloadHours', label: 'Carga horária', type: 'number', step: '0.1' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'valid',
        options: lifecycleStatus,
      },
      { name: 'notes', label: 'Observações', wide: true },
    ],
  },
  'driver-availability': {
    resource: 'driver-availability',
    scope: 'driver',
    title: 'Disponibilidade do motorista',
    singular: 'disponibilidade',
    description: 'Estado corrente e janela operacional do motorista para alocação/matching.',
    returnPath: '/cadastros/motoristas/disponibilidade',
    endpointSegment: 'availability',
    method: 'PUT',
    singleton: true,
    columns: availabilityColumns,
    fields: [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'offline',
        required: true,
        options: ['available', 'assigned', 'unavailable', 'offline'].map((value) => ({
          label: value,
          value,
        })),
      },
      { name: 'availableFrom', label: 'Disponível desde', type: 'datetime' },
      { name: 'availableUntil', label: 'Disponível até', type: 'datetime' },
      { name: 'currentCityId', label: 'Cidade atual (UUID)' },
      { name: 'destinationCityId', label: 'Cidade destino (UUID)' },
      { name: 'maxDistanceKm', label: 'Raio máximo (km)', type: 'number', step: '0.1' },
      { name: 'notes', label: 'Observações', wide: true },
    ],
  },
  'driver-unavailability': {
    resource: 'driver-unavailability',
    scope: 'driver',
    title: 'Indisponibilidades do motorista',
    singular: 'indisponibilidade',
    description: 'Janelas programadas ou efetivas em que o motorista não pode ser alocado.',
    returnPath: '/cadastros/motoristas/indisponibilidades',
    endpointSegment: 'unavailability',
    method: 'POST',
    columns: [
      { key: 'code', label: 'Código', sourceKey: 'reason_code' },
      { key: 'reason', label: 'Motivo' },
      { key: 'starts', label: 'Início', sourceKey: 'starts_at', kind: 'datetime' },
      { key: 'ends', label: 'Fim', sourceKey: 'ends_at', kind: 'datetime' },
      { key: 'status', label: 'Status' },
    ],
    fields: unavailabilityFields,
  },
  'driver-emergency-contact': {
    resource: 'driver-emergency-contact',
    scope: 'driver',
    title: 'Contatos de emergência',
    singular: 'contato de emergência',
    description: 'Contatos operacionais para incidentes e contingências.',
    returnPath: '/cadastros/motoristas/contatos-emergencia',
    endpointSegment: 'emergency-contacts',
    method: 'POST',
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'relationship', label: 'Relação' },
      { key: 'phone', label: 'Telefone' },
      { key: 'primary', label: 'Principal', sourceKey: 'is_primary', kind: 'boolean' },
      { key: 'active', label: 'Ativo', sourceKey: 'is_active', kind: 'boolean' },
    ],
    fields: [
      { name: 'name', label: 'Nome', required: true },
      { name: 'relationship', label: 'Relação' },
      { name: 'phone', label: 'Telefone', required: true },
      { name: 'isPrimary', label: 'Principal', type: 'boolean', defaultValue: 'false' },
      { name: 'isActive', label: 'Ativo', type: 'boolean', defaultValue: 'true' },
    ],
  },
  'driver-block': {
    resource: 'driver-block',
    scope: 'driver',
    title: 'Bloqueios do motorista',
    singular: 'bloqueio',
    description:
      'Bloqueios explícitos de operação, compliance, legal ou segurança, com liberação auditável.',
    returnPath: '/cadastros/motoristas/bloqueios',
    endpointSegment: 'blocks',
    method: 'POST',
    columns: [
      { key: 'code', label: 'Código', sourceKey: 'reason_code' },
      { key: 'reason', label: 'Motivo' },
      { key: 'severity', label: 'Severidade' },
      { key: 'starts', label: 'Início', sourceKey: 'starts_at', kind: 'datetime' },
      { key: 'released', label: 'Liberado em', sourceKey: 'released_at', kind: 'datetime' },
      { key: 'action', label: 'Ação', kind: 'block-action' },
    ],
    fields: [
      { name: 'reasonCode', label: 'Código do motivo', required: true },
      { name: 'reason', label: 'Motivo', required: true, wide: true },
      {
        name: 'severity',
        label: 'Severidade',
        type: 'select',
        defaultValue: 'operational',
        options: ['operational', 'compliance', 'legal', 'safety'].map((value) => ({
          label: value,
          value,
        })),
      },
      { name: 'startsAt', label: 'Início', type: 'datetime' },
      { name: 'endsAt', label: 'Fim previsto', type: 'datetime' },
    ],
  },
  'driver-rating': {
    resource: 'driver-rating',
    scope: 'driver',
    title: 'Avaliações do motorista',
    singular: 'avaliação',
    description: 'Histórico append-only de avaliações por dimensão operacional.',
    returnPath: '/cadastros/motoristas/avaliacoes',
    endpointSegment: 'ratings',
    method: 'POST',
    columns: [
      { key: 'dimension', label: 'Dimensão' },
      { key: 'score', label: 'Nota', align: 'right' },
      { key: 'note', label: 'Observação' },
      { key: 'created', label: 'Registrado em', sourceKey: 'created_at', kind: 'datetime' },
    ],
    fields: [
      { name: 'transportRequestId', label: 'Carga/solicitação (UUID)' },
      { name: 'dimension', label: 'Dimensão', required: true },
      { name: 'score', label: 'Nota (0–5)', type: 'number', required: true, step: '0.1' },
      { name: 'note', label: 'Observação', wide: true },
    ],
  },
  'asset-capabilities': {
    resource: 'asset-capabilities',
    scope: 'asset',
    title: 'Capabilities do ativo',
    singular: 'capability set',
    description: 'Capacidades físicas e operacionais persistidas para matching explicável.',
    returnPath: '/cadastros/veiculos/capabilities',
    endpointSegment: 'capabilities',
    method: 'PUT',
    singleton: true,
    columns: [
      { key: 'refrigerated', label: 'Refrigerado', kind: 'boolean' },
      { key: 'sealed', label: 'Lacrado', kind: 'boolean' },
      { key: 'side', label: 'Carga lateral', sourceKey: 'side_loading', kind: 'boolean' },
      { key: 'rear', label: 'Carga traseira', sourceKey: 'rear_loading', kind: 'boolean' },
      { key: 'dangerous', label: 'Perigosos', sourceKey: 'dangerous_goods', kind: 'boolean' },
      { key: 'pallets', label: 'Máx. pallets', sourceKey: 'max_pallets', align: 'right' },
    ],
    fields: [
      { name: 'refrigerated', label: 'Refrigerado', type: 'boolean', defaultValue: 'false' },
      { name: 'sealed', label: 'Lacrado', type: 'boolean', defaultValue: 'false' },
      { name: 'sideLoading', label: 'Carga lateral', type: 'boolean', defaultValue: 'false' },
      { name: 'rearLoading', label: 'Carga traseira', type: 'boolean', defaultValue: 'false' },
      { name: 'dangerousGoods', label: 'Cargas perigosas', type: 'boolean', defaultValue: 'false' },
      { name: 'foodGrade', label: 'Food grade', type: 'boolean', defaultValue: 'false' },
      { name: 'trackingCapable', label: 'Rastreável', type: 'boolean', defaultValue: 'false' },
      { name: 'maxPallets', label: 'Máximo de pallets', type: 'number', step: '1' },
      { name: 'minTemperatureC', label: 'Temperatura mínima °C', type: 'number', step: '0.1' },
      { name: 'maxTemperatureC', label: 'Temperatura máxima °C', type: 'number', step: '0.1' },
    ],
  },
  'asset-document': {
    resource: 'asset-document',
    scope: 'asset',
    title: 'Documentos do ativo',
    singular: 'documento do ativo',
    description: 'Registro documental tipado do veículo ou implemento.',
    returnPath: '/cadastros/veiculos/documentos',
    endpointSegment: 'documents',
    method: 'POST',
    columns: [
      { key: 'number', label: 'Número', sourceKey: 'document_number' },
      { key: 'issuer', label: 'Emissor' },
      { key: 'expires', label: 'Validade', sourceKey: 'expires_on', kind: 'date' },
      { key: 'status', label: 'Status' },
      { key: 'validation', label: 'Validação', sourceKey: 'validation_status' },
    ],
    fields: documentFields,
  },
  'asset-maintenance-plan': {
    resource: 'asset-maintenance-plan',
    scope: 'asset',
    title: 'Planos de manutenção',
    singular: 'plano de manutenção',
    description: 'Periodicidade preventiva por tempo ou odômetro.',
    returnPath: '/cadastros/veiculos/planos-manutencao',
    endpointSegment: 'maintenance-plans',
    method: 'POST',
    columns: [
      { key: 'name', label: 'Plano' },
      { key: 'type', label: 'Tipo', sourceKey: 'maintenance_type' },
      { key: 'days', label: 'Intervalo dias', sourceKey: 'interval_days', align: 'right' },
      { key: 'km', label: 'Intervalo km', sourceKey: 'interval_odometer_km', align: 'right' },
      { key: 'next', label: 'Próxima data', sourceKey: 'next_due_on', kind: 'date' },
      { key: 'active', label: 'Ativo', sourceKey: 'is_active', kind: 'boolean' },
    ],
    fields: [
      { name: 'name', label: 'Nome do plano', required: true, wide: true },
      { name: 'maintenanceType', label: 'Tipo', required: true },
      { name: 'intervalDays', label: 'Intervalo em dias', type: 'number', step: '1' },
      { name: 'intervalOdometerKm', label: 'Intervalo em km', type: 'number', step: '0.1' },
      { name: 'nextDueOn', label: 'Próxima data', type: 'date' },
      { name: 'nextDueOdometerKm', label: 'Próximo odômetro', type: 'number', step: '0.1' },
      { name: 'isActive', label: 'Ativo', type: 'boolean', defaultValue: 'true' },
      { name: 'notes', label: 'Observações', wide: true },
    ],
  },
  'asset-maintenance': {
    resource: 'asset-maintenance',
    scope: 'asset',
    title: 'Manutenções do ativo',
    singular: 'manutenção',
    description: 'Execuções planejadas/em andamento/concluídas, custos e odômetro.',
    returnPath: '/cadastros/veiculos/manutencoes',
    endpointSegment: 'maintenance',
    method: 'POST',
    columns: [
      { key: 'type', label: 'Tipo', sourceKey: 'maintenance_type' },
      { key: 'status', label: 'Status' },
      { key: 'planned', label: 'Planejada', sourceKey: 'planned_at', kind: 'datetime' },
      { key: 'completed', label: 'Concluída', sourceKey: 'completed_at', kind: 'datetime' },
      { key: 'cost', label: 'Custo', sourceKey: 'total_cost', align: 'right' },
      { key: 'items', label: 'Itens', kind: 'maintenance-items' },
    ],
    fields: [
      { name: 'maintenancePlanId', label: 'Plano (UUID)' },
      { name: 'providerPartyId', label: 'Prestador (UUID)' },
      { name: 'maintenanceType', label: 'Tipo', required: true },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'planned',
        options: ['planned', 'in_progress', 'completed', 'cancelled'].map((value) => ({
          label: value,
          value,
        })),
      },
      { name: 'plannedAt', label: 'Planejada para', type: 'datetime' },
      { name: 'startedAt', label: 'Iniciada em', type: 'datetime' },
      { name: 'completedAt', label: 'Concluída em', type: 'datetime' },
      { name: 'odometerKm', label: 'Odômetro km', type: 'number', step: '0.1' },
      { name: 'totalCost', label: 'Custo total', type: 'number', step: '0.01' },
      { name: 'currencyId', label: 'Moeda (UUID)' },
      { name: 'notes', label: 'Observações', wide: true },
    ],
  },
  'asset-maintenance-item': {
    resource: 'asset-maintenance-item',
    scope: 'asset',
    title: 'Itens da manutenção',
    singular: 'item da manutenção',
    description: 'Peças, serviços e demais itens financeiros da execução de manutenção.',
    returnPath: '/cadastros/veiculos/manutencoes/itens',
    endpointSegment: 'maintenance-items',
    method: 'POST',
    requiresMaintenance: true,
    columns: [
      { key: 'type', label: 'Tipo', sourceKey: 'item_type' },
      { key: 'description', label: 'Descrição' },
      { key: 'quantity', label: 'Qtd.', align: 'right' },
      { key: 'unit', label: 'Unitário', sourceKey: 'unit_amount', align: 'right' },
      { key: 'total', label: 'Total', sourceKey: 'total_amount', align: 'right' },
    ],
    fields: [
      { name: 'itemType', label: 'Tipo', required: true },
      { name: 'description', label: 'Descrição', required: true, wide: true },
      {
        name: 'quantity',
        label: 'Quantidade',
        type: 'number',
        defaultValue: '1',
        required: true,
        step: '0.01',
      },
      { name: 'unitAmount', label: 'Valor unitário', type: 'number', step: '0.01' },
      { name: 'totalAmount', label: 'Valor total', type: 'number', step: '0.01' },
      { name: 'currencyId', label: 'Moeda (UUID)' },
    ],
  },
  'asset-insurance': {
    resource: 'asset-insurance',
    scope: 'asset',
    title: 'Seguros do ativo',
    singular: 'seguro',
    description: 'Apólices, vigência, cobertura e situação do seguro.',
    returnPath: '/cadastros/veiculos/seguros',
    endpointSegment: 'insurances',
    method: 'POST',
    columns: [
      { key: 'policy', label: 'Apólice', sourceKey: 'policy_number' },
      { key: 'starts', label: 'Início', sourceKey: 'starts_on', kind: 'date' },
      { key: 'ends', label: 'Fim', sourceKey: 'ends_on', kind: 'date' },
      { key: 'coverage', label: 'Cobertura', sourceKey: 'coverage_amount', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'insurerPartyId', label: 'Seguradora (UUID)' },
      { name: 'policyNumber', label: 'Número da apólice', required: true },
      { name: 'startsOn', label: 'Início', type: 'date', required: true },
      { name: 'endsOn', label: 'Fim', type: 'date', required: true },
      { name: 'coverageAmount', label: 'Valor da cobertura', type: 'number', step: '0.01' },
      { name: 'currencyId', label: 'Moeda (UUID)' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'active',
        options: ['pending', 'active', 'expired', 'cancelled'].map((value) => ({
          label: value,
          value,
        })),
      },
      { name: 'notes', label: 'Observações', wide: true },
    ],
  },
  'asset-inspection': {
    resource: 'asset-inspection',
    scope: 'asset',
    title: 'Inspeções do ativo',
    singular: 'inspeção',
    description: 'Inspeções com resultado, checklist, responsável e próxima revisão.',
    returnPath: '/cadastros/veiculos/inspecoes',
    endpointSegment: 'inspections',
    method: 'POST',
    columns: [
      { key: 'type', label: 'Tipo', sourceKey: 'inspection_type' },
      { key: 'performed', label: 'Realizada em', sourceKey: 'performed_at', kind: 'datetime' },
      { key: 'result', label: 'Resultado' },
      { key: 'status', label: 'Status' },
      { key: 'next', label: 'Próxima', sourceKey: 'next_due_at', kind: 'datetime' },
    ],
    fields: [
      { name: 'inspectionType', label: 'Tipo da inspeção', required: true },
      { name: 'inspectorUserId', label: 'Inspetor (UUID)' },
      { name: 'performedAt', label: 'Realizada em', type: 'datetime', required: true },
      {
        name: 'result',
        label: 'Resultado',
        type: 'select',
        required: true,
        options: ['passed', 'failed', 'conditional', 'not_applicable'].map((value) => ({
          label: value,
          value,
        })),
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'finalized',
        options: ['draft', 'finalized', 'cancelled'].map((value) => ({ label: value, value })),
      },
      { name: 'checklist', label: 'Checklist JSON', type: 'json', defaultValue: '{}', wide: true },
      { name: 'notes', label: 'Observações', wide: true },
      { name: 'nextDueAt', label: 'Próxima inspeção', type: 'datetime' },
    ],
  },
  'asset-availability': {
    resource: 'asset-availability',
    scope: 'asset',
    title: 'Disponibilidade do ativo',
    singular: 'disponibilidade do ativo',
    description: 'Estado atual do ativo para alocação, manutenção e matching.',
    returnPath: '/cadastros/veiculos/disponibilidade',
    endpointSegment: 'availability',
    method: 'PUT',
    singleton: true,
    columns: availabilityColumns,
    fields: [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'offline',
        required: true,
        options: ['available', 'assigned', 'maintenance', 'unavailable', 'offline'].map(
          (value) => ({ label: value, value }),
        ),
      },
      { name: 'availableFrom', label: 'Disponível desde', type: 'datetime' },
      { name: 'availableUntil', label: 'Disponível até', type: 'datetime' },
      { name: 'currentCityId', label: 'Cidade atual (UUID)' },
      { name: 'notes', label: 'Observações', wide: true },
    ],
  },
  'asset-unavailability': {
    resource: 'asset-unavailability',
    scope: 'asset',
    title: 'Indisponibilidades do ativo',
    singular: 'indisponibilidade do ativo',
    description: 'Janelas de indisponibilidade programadas ou efetivas.',
    returnPath: '/cadastros/veiculos/indisponibilidades',
    endpointSegment: 'unavailability',
    method: 'POST',
    columns: [
      { key: 'code', label: 'Código', sourceKey: 'reason_code' },
      { key: 'reason', label: 'Motivo' },
      { key: 'starts', label: 'Início', sourceKey: 'starts_at', kind: 'datetime' },
      { key: 'ends', label: 'Fim', sourceKey: 'ends_at', kind: 'datetime' },
      { key: 'status', label: 'Status' },
    ],
    fields: unavailabilityFields,
  },
  'asset-location': {
    resource: 'asset-location',
    scope: 'asset',
    title: 'Localizações observadas',
    singular: 'localização',
    description: 'Histórico append-only de posições observadas do ativo.',
    returnPath: '/cadastros/veiculos/localizacoes',
    endpointSegment: 'locations',
    method: 'POST',
    columns: [
      { key: 'observed', label: 'Observado em', sourceKey: 'observed_at', kind: 'datetime' },
      { key: 'lat', label: 'Latitude', sourceKey: 'latitude', align: 'right' },
      { key: 'lng', label: 'Longitude', sourceKey: 'longitude', align: 'right' },
      { key: 'source', label: 'Fonte' },
      { key: 'accuracy', label: 'Precisão m', sourceKey: 'accuracy_m', align: 'right' },
    ],
    fields: [
      { name: 'cityId', label: 'Cidade (UUID)' },
      { name: 'observedAt', label: 'Observado em', type: 'datetime', required: true },
      { name: 'latitude', label: 'Latitude', type: 'number', required: true, step: '0.000001' },
      { name: 'longitude', label: 'Longitude', type: 'number', required: true, step: '0.000001' },
      {
        name: 'source',
        label: 'Fonte',
        type: 'select',
        required: true,
        options: ['gps', 'mobile', 'manual', 'integration', 'telematics'].map((value) => ({
          label: value,
          value,
        })),
      },
      { name: 'accuracyM', label: 'Precisão (m)', type: 'number', step: '0.1' },
      { name: 'providerReference', label: 'Referência do provedor' },
    ],
  },
  'asset-block': {
    resource: 'asset-block',
    scope: 'asset',
    title: 'Bloqueios do ativo',
    singular: 'bloqueio do ativo',
    description: 'Bloqueios operacionais, de compliance, legais, segurança ou manutenção.',
    returnPath: '/cadastros/veiculos/bloqueios',
    endpointSegment: 'blocks',
    method: 'POST',
    columns: [
      { key: 'code', label: 'Código', sourceKey: 'reason_code' },
      { key: 'reason', label: 'Motivo' },
      { key: 'severity', label: 'Severidade' },
      { key: 'starts', label: 'Início', sourceKey: 'starts_at', kind: 'datetime' },
      { key: 'released', label: 'Liberado em', sourceKey: 'released_at', kind: 'datetime' },
      { key: 'action', label: 'Ação', kind: 'block-action' },
    ],
    fields: [
      { name: 'reasonCode', label: 'Código do motivo', required: true },
      { name: 'reason', label: 'Motivo', required: true, wide: true },
      {
        name: 'severity',
        label: 'Severidade',
        type: 'select',
        defaultValue: 'operational',
        options: ['operational', 'compliance', 'legal', 'safety', 'maintenance'].map((value) => ({
          label: value,
          value,
        })),
      },
      { name: 'startsAt', label: 'Início', type: 'datetime' },
      { name: 'endsAt', label: 'Fim previsto', type: 'datetime' },
    ],
  },
};

export function qualificationEndpoint(
  config: QualificationConfig,
  subjectId: string,
  maintenanceId?: string,
): string {
  const root = config.scope === 'driver' ? 'drivers' : 'assets';
  if (config.requiresMaintenance) {
    if (!maintenanceId) throw new Error('maintenanceId is required');
    return `/api/v1/capacity/${root}/${subjectId}/maintenance/${maintenanceId}/items`;
  }
  return `/api/v1/capacity/${root}/${subjectId}/${config.endpointSegment}`;
}
