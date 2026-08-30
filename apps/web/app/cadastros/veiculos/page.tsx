import {
  ApiCollectionPage,
  collectionBoolean,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Veículos' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/capacity/assets"
      basePath="/cadastros/veiculos"
      eyebrow="Capacity • Assets"
      title="Veículos"
      description="Veículos do tenant com capacidade, rastreamento, situação e elegibilidade para matching."
      actions={[{ href: '/cadastros/veiculos/novo', label: 'Novo veículo' }]}
      filters={[
        { label: 'Status', name: 'status', options: ['active', 'blocked', 'inactive'] },
        {
          label: 'Rastreamento',
          name: 'tracking',
          options: [
            { label: 'Disponível', value: 'true' },
            { label: 'Indisponível', value: 'false' },
          ],
        },
      ]}
      columns={[
        { key: 'identifier', label: 'Identificador' },
        { key: 'plate', label: 'Placa' },
        { key: 'classification', label: 'Tipo / carroceria' },
        { key: 'capacity', label: 'Capacidade' },
        { key: 'tracking', label: 'Rastreamento' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (item.assetKind !== 'vehicle') return false;
        if (values.status && item.status !== values.status) return false;
        if (values.tracking && String(item.trackingAvailable) !== values.tracking) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        identifier: collectionText(item.identifier),
        plate: collectionText(item.plate),
        classification: `${collectionText(item.vehicleType)} / ${collectionText(item.bodyType)}`,
        capacity: `${collectionText(item.capacityWeightKg)} kg${item.capacityVolumeM3 ? ` • ${collectionText(item.capacityVolumeM3)} m³` : ''}`,
        tracking: collectionBoolean(item.trackingAvailable),
        status: collectionText(item.status),
      })}
      integrationNotes={[
        'A PR #56 adiciona vehicle_type_id/body_type_id tenant-aware e qualificação operacional de ativos.',
      ]}
    />
  );
}
