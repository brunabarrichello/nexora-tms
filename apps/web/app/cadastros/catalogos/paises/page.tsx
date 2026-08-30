import {
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Países' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="countries"
      basePath="/cadastros/catalogos/paises"
      eyebrow="Geografia global • countries"
      title="Países"
      description="Referência geográfica global com códigos ISO e lifecycle administrativo."
      columns={[
        { key: 'code', label: 'ISO-2' },
        { key: 'iso3', label: 'ISO-3' },
        { key: 'name', label: 'Nome' },
        { key: 'numericCode', label: 'Código numérico' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        iso3: displayValue(item.iso3),
        name: item.name,
        numericCode: displayValue(item.numericCode),
        status: displayStatus(item),
      })}
      readOnly
    />
  );
}
