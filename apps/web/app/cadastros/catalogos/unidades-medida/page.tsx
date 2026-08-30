import {
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Unidades de medida' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="units-of-measure"
      basePath="/cadastros/catalogos/unidades-medida"
      eyebrow="Catálogos globais • units_of_measure"
      title="Unidades de medida"
      description="Unidades padronizadas para massa, volume, comprimento, quantidade e tempo."
      filters={[
        {
          label: 'Dimensão',
          name: 'dimension',
          options: ['mass', 'volume', 'length', 'count', 'time', 'other'],
        },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'dimension', label: 'Dimensão' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        dimension: displayValue(item.dimension),
        status: displayStatus(item),
      })}
      readOnly
    />
  );
}
