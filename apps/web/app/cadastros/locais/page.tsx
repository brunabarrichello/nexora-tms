import {
  ApiCollectionPage,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Locais' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/locations"
      basePath="/cadastros/locais"
      eyebrow="Wave 0016 • Locations"
      title="Locais operacionais"
      description="Origens, destinos, terminais, armazéns, pátios e outros pontos operacionais tenant-scoped."
      filters={[
        {
          label: 'Tipo',
          name: 'type',
          options: [
            'customer',
            'shipper',
            'consignee',
            'terminal',
            'warehouse',
            'yard',
            'port',
            'airport',
            'border',
            'support',
            'other',
          ],
        },
        {
          label: 'Status',
          name: 'active',
          options: [
            { label: 'Ativo', value: 'true' },
            { label: 'Inativo', value: 'false' },
          ],
        },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Local' },
        { key: 'type', label: 'Tipo' },
        { key: 'address', label: 'Endereço' },
        { key: 'reference', label: 'Referência' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (values.type && item.type !== values.type) return false;
        if (values.active && String(item.isActive) !== values.active) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        code: collectionText(item.code),
        name: collectionText(item.name),
        type: collectionText(item.type),
        address:
          [item.street, item.number, item.district, item.postalCode]
            .filter((value) => typeof value === 'string' && value)
            .join(', ') || '—',
        reference: collectionText(item.operationalReference),
        status: item.isActive === true ? 'Ativo' : 'Inativo',
      })}
    />
  );
}
