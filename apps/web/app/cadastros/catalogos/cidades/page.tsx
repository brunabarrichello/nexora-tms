import {
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Cidades' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="cities"
      basePath="/cadastros/catalogos/cidades"
      eyebrow="Geografia global • cities"
      title="Cidades"
      description="Municípios com código IBGE e coordenadas geográficas opcionais."
      filters={[{ label: 'State ID', name: 'stateId', placeholder: 'UUID do estado' }]}
      columns={[
        { key: 'ibgeCode', label: 'IBGE' },
        { key: 'name', label: 'Nome' },
        { key: 'stateId', label: 'Estado' },
        { key: 'coordinates', label: 'Coordenadas' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        ibgeCode: displayValue(item.ibgeCode),
        name: item.name,
        stateId: displayValue(item.stateId),
        coordinates:
          item.latitude && item.longitude
            ? `${displayValue(item.latitude)}, ${displayValue(item.longitude)}`
            : '—',
        status: displayStatus(item),
      })}
      readOnly
    />
  );
}
