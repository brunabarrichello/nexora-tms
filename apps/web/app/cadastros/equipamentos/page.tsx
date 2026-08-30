import {
  ApiCollectionPage,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Equipamentos' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/capacity/assets"
      basePath="/cadastros/equipamentos"
      eyebrow="Capacity • Implements"
      title="Equipamentos e implementos"
      description="Implementos e equipamentos de transporte registrados no mesmo aggregate root de capacity assets."
      filters={[{ label: 'Status', name: 'status', options: ['active', 'blocked', 'inactive'] }]}
      columns={[
        { key: 'identifier', label: 'Identificador' },
        { key: 'plate', label: 'Placa' },
        { key: 'classification', label: 'Classificação' },
        { key: 'capacity', label: 'Capacidade' },
        { key: 'owner', label: 'Proprietário' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (item.assetKind !== 'implement') return false;
        if (values.status && item.status !== values.status) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        identifier: collectionText(item.identifier),
        plate: collectionText(item.plate),
        classification: `${collectionText(item.vehicleType)} / ${collectionText(item.bodyType)}`,
        capacity: `${collectionText(item.capacityWeightKg)} kg`,
        owner: collectionText(item.ownerName ?? item.ownerPartyId),
        status: collectionText(item.status),
      })}
      integrationNotes={['Asset kind implement é filtrado sem criar um aggregate root paralelo.']}
    />
  );
}
