import {
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Estados' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="states"
      basePath="/cadastros/catalogos/estados"
      eyebrow="Geografia global • states"
      title="Estados"
      description="Estados e subdivisões vinculados ao catálogo global de países."
      filters={[{ label: 'Country ID', name: 'countryId', placeholder: 'UUID do país' }]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'countryId', label: 'País' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        countryId: displayValue(item.countryId),
        status: displayStatus(item),
      })}
      readOnly
    />
  );
}
