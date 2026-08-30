import {
  displayBoolean,
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Tipos de carga' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="cargo-types"
      basePath="/cadastros/catalogos/tipos-carga"
      eyebrow="Catálogos • cargo_types"
      title="Tipos de carga"
      description="Classificação das cargas e sinalização de manuseio especial."
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'special', label: 'Manuseio especial' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        special: displayBoolean(item.requiresSpecialHandling),
        status: displayStatus(item),
      })}
    />
  );
}
