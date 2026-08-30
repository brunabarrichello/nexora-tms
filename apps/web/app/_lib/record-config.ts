export type RecordMode = 'create' | 'edit';
export type RecordFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox-group';

export type RecordField = {
  readonly name: string;
  readonly label: string;
  readonly type?: RecordFieldType;
  readonly required?: boolean;
  readonly wide?: boolean;
  readonly placeholder?: string;
  readonly step?: string;
  readonly defaultValue?: string;
  readonly options?: readonly { readonly label: string; readonly value: string }[];
};

export type RecordResource =
  | 'party-client'
  | 'party-supplier'
  | 'party-carrier'
  | 'driver'
  | 'vehicle'
  | 'implement'
  | 'location'
  | 'department'
  | 'cost-center'
  | 'commodity'
  | 'party-group'
  | 'custom-field'
  | 'party-requirement';

export type RecordConfig = {
  readonly resource: RecordResource;
  readonly title: string;
  readonly singular: string;
  readonly description: string;
  readonly returnPath: string;
  readonly endpoint: string;
  readonly supportsEdit: boolean;
  readonly fields: readonly RecordField[];
};

const activeOptions = [
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
] as const;
const booleanOptions = [
  { label: 'Sim', value: 'true' },
  { label: 'Não', value: 'false' },
] as const;
const catalogActiveOptions = [
  { label: 'Ativo', value: 'true' },
  { label: 'Inativo', value: 'false' },
] as const;

const partyBase = [
  { name: 'taxId', label: 'CPF/CNPJ', required: true, placeholder: 'Somente números ou formatado' },
  { name: 'legalName', label: 'Razão social / nome', required: true, wide: true },
  { name: 'tradeName', label: 'Nome fantasia' },
  { name: 'email', label: 'E-mail', type: 'email' as const },
  { name: 'phone', label: 'Telefone', type: 'tel' as const },
] as const;

const partnerHomologation = [
  {
    name: 'homologationStatus',
    label: 'Homologação',
    type: 'select' as const,
    defaultValue: 'pending',
    options: [
      { label: 'Pendente', value: 'pending' },
      { label: 'Aprovada', value: 'approved' },
      { label: 'Rejeitada', value: 'rejected' },
    ],
  },
  { name: 'homologationNotes', label: 'Notas de homologação', wide: true },
] as const;

export const recordConfigs = {
  'party-client': {
    resource: 'party-client',
    title: 'Clientes e embarcadores',
    singular: 'cliente / embarcador',
    description: 'Business party canônico com papéis comerciais de contratação e embarque.',
    returnPath: '/cadastros/clientes',
    endpoint: '/api/v1/master-data/business-parties',
    supportsEdit: true,
    fields: [
      ...partyBase,
      {
        name: 'roles',
        label: 'Papéis',
        type: 'checkbox-group',
        required: true,
        wide: true,
        options: [
          { label: 'Cliente', value: 'customer' },
          { label: 'Embarcador', value: 'shipper' },
          { label: 'Consignatário', value: 'consignee' },
        ],
      },
      { name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: activeOptions },
    ],
  },
  'party-supplier': {
    resource: 'party-supplier',
    title: 'Fornecedores',
    singular: 'fornecedor',
    description: 'Fornecedor ou parceiro operacional com homologação controlada.',
    returnPath: '/cadastros/fornecedores',
    endpoint: '/api/v1/master-data/business-parties',
    supportsEdit: true,
    fields: [
      ...partyBase,
      {
        name: 'roles',
        label: 'Papéis',
        type: 'checkbox-group',
        required: true,
        wide: true,
        options: [
          { label: 'Fornecedor', value: 'supplier' },
          { label: 'Parceiro', value: 'partner' },
        ],
      },
      ...partnerHomologation,
      { name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: activeOptions },
    ],
  },
  'party-carrier': {
    resource: 'party-carrier',
    title: 'Transportadoras',
    singular: 'transportadora',
    description: 'Transportadora parceira com papel carrier e processo de homologação.',
    returnPath: '/cadastros/transportadoras',
    endpoint: '/api/v1/master-data/business-parties',
    supportsEdit: true,
    fields: [
      ...partyBase,
      {
        name: 'roles',
        label: 'Papéis',
        type: 'checkbox-group',
        required: true,
        wide: true,
        options: [
          { label: 'Transportadora', value: 'carrier' },
          { label: 'Parceiro', value: 'partner' },
        ],
      },
      ...partnerHomologation,
      { name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: activeOptions },
    ],
  },
  driver: {
    resource: 'driver',
    title: 'Motoristas',
    singular: 'motorista',
    description: 'Cadastro operacional do motorista e qualificação básica para matching.',
    returnPath: '/cadastros/motoristas',
    endpoint: '/api/v1/capacity/drivers',
    supportsEdit: true,
    fields: [
      { name: 'fullName', label: 'Nome completo', required: true, wide: true },
      { name: 'taxId', label: 'CPF', required: true },
      { name: 'carrierPartyId', label: 'Transportadora (UUID)', placeholder: 'Opcional' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'phone', label: 'Telefone', type: 'tel', required: true },
      { name: 'whatsapp', label: 'WhatsApp', type: 'tel' },
      { name: 'cnhNumber', label: 'Número da CNH', required: true },
      {
        name: 'cnhCategory',
        label: 'Categoria CNH',
        type: 'select',
        required: true,
        defaultValue: 'D',
        options: ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'].map((value) => ({ label: value, value })),
      },
      { name: 'cnhExpiresOn', label: 'Validade CNH', type: 'date', required: true },
      {
        name: 'registrationStatus',
        label: 'Situação cadastral',
        type: 'select',
        defaultValue: 'pending',
        options: ['pending', 'qualified', 'blocked', 'inactive'].map((value) => ({ label: value, value })),
      },
      {
        name: 'operationalStatus',
        label: 'Situação operacional',
        type: 'select',
        defaultValue: 'inactive',
        options: ['active', 'blocked', 'inactive'].map((value) => ({ label: value, value })),
      },
      { name: 'statusReason', label: 'Motivo de status', wide: true },
    ],
  },
  vehicle: assetConfig('vehicle', 'Veículos', 'veículo', '/cadastros/veiculos'),
  implement: assetConfig('implement', 'Equipamentos', 'implemento', '/cadastros/equipamentos'),
  location: {
    resource: 'location',
    title: 'Locais operacionais',
    singular: 'local',
    description: 'Ponto operacional standalone vinculado à geografia global da Wave 0015.',
    returnPath: '/cadastros/locais',
    endpoint: '/api/v1/master-data/locations',
    supportsEdit: false,
    fields: [
      { name: 'code', label: 'Código', required: true },
      { name: 'name', label: 'Nome', required: true, wide: true },
      {
        name: 'type',
        label: 'Tipo',
        type: 'select',
        required: true,
        defaultValue: 'other',
        options: ['customer', 'shipper', 'consignee', 'terminal', 'warehouse', 'yard', 'port', 'airport', 'border', 'support', 'other'].map((value) => ({ label: value, value })),
      },
      { name: 'cityId', label: 'Cidade (UUID)', required: true },
      { name: 'postalCode', label: 'CEP' },
      { name: 'street', label: 'Logradouro', required: true, wide: true },
      { name: 'number', label: 'Número' },
      { name: 'district', label: 'Bairro' },
      { name: 'complement', label: 'Complemento' },
      { name: 'latitude', label: 'Latitude', type: 'number', step: '0.000001' },
      { name: 'longitude', label: 'Longitude', type: 'number', step: '0.000001' },
      { name: 'operationalReference', label: 'Referência operacional', wide: true },
      { name: 'isActive', label: 'Status', type: 'select', defaultValue: 'true', options: catalogActiveOptions },
    ],
  },
  department: dimensionConfig('department', 'Departamentos', 'departamento', '/cadastros/departamentos'),
  'cost-center': dimensionConfig('cost-center', 'Centros de custo', 'centro de custo', '/cadastros/centros-custo'),
  commodity: {
    resource: 'commodity',
    title: 'Mercadorias',
    singular: 'mercadoria',
    description: 'Mercadoria reutilizável com classificação de risco e temperatura.',
    returnPath: '/cadastros/mercadorias',
    endpoint: '/api/v1/master-data/commodities',
    supportsEdit: false,
    fields: [
      { name: 'code', label: 'Código', required: true },
      { name: 'name', label: 'Nome', required: true, wide: true },
      { name: 'description', label: 'Descrição', wide: true },
      { name: 'defaultCargoTypeId', label: 'Tipo de carga padrão (UUID)' },
      { name: 'isHazardous', label: 'Mercadoria perigosa', type: 'select', defaultValue: 'false', options: booleanOptions },
      { name: 'requiresTemperatureControl', label: 'Controle de temperatura', type: 'select', defaultValue: 'false', options: booleanOptions },
      { name: 'isActive', label: 'Status', type: 'select', defaultValue: 'true', options: catalogActiveOptions },
    ],
  },
  'party-group': {
    resource: 'party-group',
    title: 'Grupos de parceiros',
    singular: 'grupo',
    description: 'Agrupamento governado de business parties.',
    returnPath: '/cadastros/grupos',
    endpoint: '/api/v1/master-data/business-party-groups',
    supportsEdit: false,
    fields: [
      { name: 'code', label: 'Código', required: true },
      { name: 'name', label: 'Nome', required: true, wide: true },
      {
        name: 'groupType',
        label: 'Tipo de grupo',
        type: 'select',
        required: true,
        defaultValue: 'operational',
        options: ['economic', 'commercial', 'operational', 'risk', 'other'].map((value) => ({ label: value, value })),
      },
      { name: 'isActive', label: 'Status', type: 'select', defaultValue: 'true', options: catalogActiveOptions },
    ],
  },
  'custom-field': {
    resource: 'custom-field',
    title: 'Campos personalizados',
    singular: 'campo personalizado',
    description: 'Definição tipada de custom field sob whitelist de entidades e tipos de dado.',
    returnPath: '/cadastros/campos-personalizados',
    endpoint: '/api/v1/master-data/custom-fields/definitions',
    supportsEdit: false,
    fields: [
      {
        name: 'entityType',
        label: 'Entidade',
        type: 'select',
        required: true,
        defaultValue: 'business_party',
        options: ['business_party', 'driver', 'capacity_asset', 'transport_request', 'location'].map((value) => ({ label: value, value })),
      },
      { name: 'key', label: 'Chave', required: true },
      { name: 'label', label: 'Rótulo', required: true },
      {
        name: 'dataType',
        label: 'Tipo de dado',
        type: 'select',
        required: true,
        defaultValue: 'string',
        options: ['string', 'number', 'boolean', 'date', 'datetime', 'json'].map((value) => ({ label: value, value })),
      },
      { name: 'isRequired', label: 'Obrigatório', type: 'select', defaultValue: 'false', options: booleanOptions },
      { name: 'validation', label: 'Validação JSON', placeholder: 'Ex.: {"min": 1}', wide: true },
      { name: 'isActive', label: 'Status', type: 'select', defaultValue: 'true', options: catalogActiveOptions },
    ],
  },
  'party-requirement': {
    resource: 'party-requirement',
    title: 'Requisitos de parceiro',
    singular: 'requisito',
    description: 'Requisito operacional/comercial/documental associado a um business party específico.',
    returnPath: '/cadastros/requisitos',
    endpoint: '/api/v1/master-data/business-parties',
    supportsEdit: false,
    fields: [
      { name: 'requirementType', label: 'Tipo do requisito', required: true },
      { name: 'value', label: 'Valor', required: true, wide: true },
      { name: 'isMandatory', label: 'Obrigatório', type: 'select', defaultValue: 'true', options: booleanOptions },
      { name: 'validFrom', label: 'Válido desde', type: 'date' },
      { name: 'validUntil', label: 'Válido até', type: 'date' },
      { name: 'isActive', label: 'Status', type: 'select', defaultValue: 'true', options: catalogActiveOptions },
    ],
  },
} as const satisfies Readonly<Record<RecordResource, RecordConfig>>;

export function getRecordConfig(resource: string): RecordConfig | null {
  if (!Object.prototype.hasOwnProperty.call(recordConfigs, resource)) return null;
  return recordConfigs[resource as RecordResource];
}

function assetConfig(
  resource: 'vehicle' | 'implement',
  title: string,
  singular: string,
  returnPath: string,
): RecordConfig {
  return {
    resource,
    title,
    singular,
    description: 'Capacity asset canônico com propriedade, classificação, capacidade e status operacional.',
    returnPath,
    endpoint: '/api/v1/capacity/assets',
    supportsEdit: true,
    fields: [
      { name: 'identifier', label: 'Identificador', required: true },
      { name: 'plate', label: 'Placa' },
      { name: 'carrierPartyId', label: 'Transportadora (UUID)' },
      { name: 'ownerPartyId', label: 'Proprietário cadastrado (UUID)' },
      { name: 'ownerName', label: 'Nome do proprietário', required: true, wide: true },
      { name: 'vehicleType', label: 'Tipo de veículo', required: true },
      { name: 'bodyType', label: 'Tipo de carroceria', required: true },
      { name: 'capacityWeightKg', label: 'Capacidade (kg)', type: 'number', step: '0.001', required: true },
      { name: 'capacityVolumeM3', label: 'Capacidade (m³)', type: 'number', step: '0.001' },
      { name: 'maxLengthM', label: 'Comprimento máximo (m)', type: 'number', step: '0.001' },
      { name: 'maxWidthM', label: 'Largura máxima (m)', type: 'number', step: '0.001' },
      { name: 'maxHeightM', label: 'Altura máxima (m)', type: 'number', step: '0.001' },
      { name: 'trackingAvailable', label: 'Rastreamento', type: 'select', defaultValue: 'false', options: booleanOptions },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'inactive',
        options: ['active', 'blocked', 'inactive'].map((value) => ({ label: value, value })),
      },
      { name: 'statusReason', label: 'Motivo de status', wide: true },
    ],
  };
}

function dimensionConfig(
  resource: 'department' | 'cost-center',
  title: string,
  singular: string,
  returnPath: string,
): RecordConfig {
  return {
    resource,
    title,
    singular,
    description: 'Dimensão tenant-scoped vinculada à organização e opcionalmente a uma unidade de negócio.',
    returnPath,
    endpoint: `/api/v1/master-data/dimensions/${resource === 'department' ? 'departments' : 'cost-centers'}`,
    supportsEdit: false,
    fields: [
      { name: 'organizationId', label: 'Organização (UUID)', required: true },
      { name: 'businessUnitId', label: 'Unidade de negócio (UUID)' },
      { name: 'code', label: 'Código', required: true },
      { name: 'name', label: 'Nome', required: true, wide: true },
      { name: 'isActive', label: 'Status', type: 'select', defaultValue: 'true', options: catalogActiveOptions },
    ],
  };
}
