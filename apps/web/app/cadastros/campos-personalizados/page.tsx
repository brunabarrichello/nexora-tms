import {
  ApiCollectionPage,
  collectionBoolean,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Campos personalizados' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/custom-fields/definitions"
      basePath="/cadastros/campos-personalizados"
      eyebrow="Wave 0016 • Controlled Extensibility"
      title="Campos personalizados"
      description="Definições governadas de custom fields por tipo de entidade e tipo de dado, sem schema livre no browser."
      filters={[
        {
          label: 'Entidade',
          name: 'entityType',
          options: ['business_party', 'driver', 'capacity_asset', 'transport_request', 'location'],
        },
        {
          label: 'Tipo de dado',
          name: 'dataType',
          options: ['string', 'number', 'boolean', 'date', 'datetime', 'json'],
        },
      ]}
      columns={[
        { key: 'entityType', label: 'Entidade' },
        { key: 'key', label: 'Chave' },
        { key: 'label', label: 'Rótulo' },
        { key: 'dataType', label: 'Tipo' },
        { key: 'required', label: 'Obrigatório' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (values.entityType && item.entityType !== values.entityType) return false;
        if (values.dataType && item.dataType !== values.dataType) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        entityType: collectionText(item.entityType),
        key: collectionText(item.key),
        label: collectionText(item.label),
        dataType: collectionText(item.dataType),
        required: collectionBoolean(item.isRequired),
        status: item.isActive === true ? 'Ativo' : 'Inativo',
      })}
    />
  );
}
