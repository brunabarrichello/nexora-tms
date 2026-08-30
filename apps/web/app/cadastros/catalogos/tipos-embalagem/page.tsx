import {
  displayBoolean,
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Tipos de embalagem' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="package-types"
      basePath="/cadastros/catalogos/tipos-embalagem"
      eyebrow="Catálogos • package_types"
      title="Tipos de embalagem"
      description="Tipos de volume/embalagem e comportamento padrão de empilhamento."
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'stackable', label: 'Empilhável padrão' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        stackable: displayBoolean(item.stackableDefault),
        status: displayStatus(item),
      })}
    />
  );
}
