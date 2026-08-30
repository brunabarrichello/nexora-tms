import {
  ApiCollectionPage,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Atribuições de capacidade' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/capacity/assignments/history"
      basePath="/cadastros/atribuicoes"
      eyebrow="Capacity • Assignments"
      title="Atribuições motorista–veículo"
      description="Histórico real de composições entre motorista, veículo e transportadora, preservando vigência temporal."
      filters={[{ label: 'Status', name: 'status', options: ['active', 'closed', 'cancelled'] }]}
      columns={[
        { key: 'driver', label: 'Motorista' },
        { key: 'vehicle', label: 'Veículo' },
        { key: 'carrier', label: 'Transportadora' },
        { key: 'period', label: 'Vigência' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => !values.status || item.status === values.status}
      mapRow={(item) => ({
        id: item.id,
        driver: collectionText(item.driverName),
        vehicle: `${collectionText(item.vehicleIdentifier)}${item.vehiclePlate ? ` • ${collectionText(item.vehiclePlate)}` : ''}`,
        carrier: collectionText(item.carrierName),
        period: `${collectionText(item.startsAt)} → ${collectionText(item.endsAt, 'aberta')}`,
        status: collectionText(item.status),
      })}
    />
  );
}
