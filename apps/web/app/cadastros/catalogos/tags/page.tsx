import {
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Tags' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="tags"
      basePath="/cadastros/catalogos/tags"
      eyebrow="Catálogos • tags"
      title="Tags"
      description="Classificadores reutilizáveis e tenant-scoped para entidades operacionais."
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'description', label: 'Descrição' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        description: displayValue(item.description),
        status: displayStatus(item),
      })}
    />
  );
}
