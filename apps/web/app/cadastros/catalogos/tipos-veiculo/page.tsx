import {
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Tipos de veículo' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="vehicle-types"
      basePath="/cadastros/catalogos/tipos-veiculo"
      eyebrow="Catálogos • vehicle_types"
      title="Tipos de veículo"
      description="Catálogo tenant-scoped de categorias de veículo com peso máximo padrão."
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'maxWeight', label: 'Peso máximo padrão' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        maxWeight: item.defaultMaxWeightKg ? `${displayValue(item.defaultMaxWeightKg)} kg` : '—',
        status: displayStatus(item),
      })}
      integrationNotes={['Persistência em vehicle_types protegida por RLS por tenant.']}
    />
  );
}
