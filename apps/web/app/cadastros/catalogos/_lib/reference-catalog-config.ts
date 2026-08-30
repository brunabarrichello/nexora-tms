export type ReferenceCatalogFormMode = 'create' | 'edit';

export type ReferenceCatalogFormField = {
  readonly name: string;
  readonly label: string;
  readonly type?: 'text' | 'number' | 'select';
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly wide?: boolean;
  readonly defaultValue?: string;
  readonly step?: string;
  readonly options?: readonly { readonly label: string; readonly value: string }[];
};

export type EditableReferenceCatalogConfig = {
  readonly slug: string;
  readonly basePath: string;
  readonly title: string;
  readonly singular: string;
  readonly description: string;
  readonly fields: readonly ReferenceCatalogFormField[];
};

const activeOptions = [
  { label: 'Ativo', value: 'true' },
  { label: 'Inativo', value: 'false' },
] as const;

const booleanOptions = [
  { label: 'Sim', value: 'true' },
  { label: 'Não', value: 'false' },
] as const;

const commonFields = [
  { name: 'code', label: 'Código', required: true, placeholder: 'Código interno' },
  { name: 'name', label: 'Nome', required: true, placeholder: 'Nome do catálogo' },
] as const;

const descriptionField = {
  name: 'description',
  label: 'Descrição',
  placeholder: 'Descrição operacional opcional',
  wide: true,
} as const;

const activeField = {
  name: 'isActive',
  label: 'Status',
  type: 'select' as const,
  defaultValue: 'true',
  options: activeOptions,
};

export const editableReferenceCatalogs = {
  'vehicle-types': {
    slug: 'vehicle-types',
    basePath: '/cadastros/catalogos/tipos-veiculo',
    title: 'Tipos de veículo',
    singular: 'tipo de veículo',
    description: 'Categoria de veículo e capacidade de peso padrão.',
    fields: [
      ...commonFields,
      descriptionField,
      {
        name: 'defaultMaxWeightKg',
        label: 'Peso máximo padrão (kg)',
        type: 'number',
        step: '0.001',
        placeholder: 'Ex.: 23000',
      },
      activeField,
    ],
  },
  'body-types': {
    slug: 'body-types',
    basePath: '/cadastros/catalogos/tipos-carroceria',
    title: 'Tipos de carroceria',
    singular: 'tipo de carroceria',
    description: 'Características estruturais e possibilidades de carregamento.',
    fields: [
      ...commonFields,
      descriptionField,
      {
        name: 'isClosed',
        label: 'Carroceria fechada',
        type: 'select',
        defaultValue: 'false',
        options: booleanOptions,
      },
      {
        name: 'supportsSideLoading',
        label: 'Permite carga lateral',
        type: 'select',
        defaultValue: 'false',
        options: booleanOptions,
      },
      {
        name: 'supportsRearLoading',
        label: 'Permite carga traseira',
        type: 'select',
        defaultValue: 'false',
        options: booleanOptions,
      },
      activeField,
    ],
  },
  'cargo-types': {
    slug: 'cargo-types',
    basePath: '/cadastros/catalogos/tipos-carga',
    title: 'Tipos de carga',
    singular: 'tipo de carga',
    description: 'Classificação da carga e requisito de manuseio especial.',
    fields: [
      ...commonFields,
      descriptionField,
      {
        name: 'requiresSpecialHandling',
        label: 'Exige manuseio especial',
        type: 'select',
        defaultValue: 'false',
        options: booleanOptions,
      },
      activeField,
    ],
  },
  'package-types': {
    slug: 'package-types',
    basePath: '/cadastros/catalogos/tipos-embalagem',
    title: 'Tipos de embalagem',
    singular: 'tipo de embalagem',
    description: 'Espécie de volume/embalagem e comportamento padrão de empilhamento.',
    fields: [
      ...commonFields,
      descriptionField,
      {
        name: 'stackableDefault',
        label: 'Empilhável por padrão',
        type: 'select',
        defaultValue: '',
        options: [
          { label: 'Não definido', value: '' },
          ...booleanOptions,
        ],
      },
      activeField,
    ],
  },
  'document-types': {
    slug: 'document-types',
    basePath: '/cadastros/catalogos/tipos-documento',
    title: 'Tipos de documento',
    singular: 'tipo de documento',
    description: 'Escopo documental, validade e política de validação.',
    fields: [
      ...commonFields,
      {
        name: 'subjectScope',
        label: 'Escopo',
        type: 'select',
        required: true,
        defaultValue: 'other',
        options: [
          { label: 'Parte / empresa', value: 'party' },
          { label: 'Motorista', value: 'driver' },
          { label: 'Ativo', value: 'asset' },
          { label: 'Carga / solicitação', value: 'request' },
          { label: 'Viagem', value: 'trip' },
          { label: 'Financeiro', value: 'financial' },
          { label: 'Outro', value: 'other' },
        ],
      },
      {
        name: 'hasExpiry',
        label: 'Possui vencimento',
        type: 'select',
        defaultValue: 'false',
        options: booleanOptions,
      },
      {
        name: 'requiresValidation',
        label: 'Exige validação',
        type: 'select',
        defaultValue: 'false',
        options: booleanOptions,
      },
      activeField,
    ],
  },
  tags: {
    slug: 'tags',
    basePath: '/cadastros/catalogos/tags',
    title: 'Tags',
    singular: 'tag',
    description: 'Classificador reutilizável no escopo do tenant.',
    fields: [...commonFields, descriptionField, activeField],
  },
} as const satisfies Readonly<Record<string, EditableReferenceCatalogConfig>>;

export type EditableReferenceCatalogSlug = keyof typeof editableReferenceCatalogs;

export function getEditableReferenceCatalog(
  slug: string,
): EditableReferenceCatalogConfig | null {
  if (!Object.prototype.hasOwnProperty.call(editableReferenceCatalogs, slug)) return null;
  return editableReferenceCatalogs[slug as EditableReferenceCatalogSlug];
}
