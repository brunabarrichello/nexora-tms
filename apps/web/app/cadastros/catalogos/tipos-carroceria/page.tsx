import {
  displayBoolean,
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Tipos de carroceria' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="body-types"
      basePath="/cadastros/catalogos/tipos-carroceria"
      eyebrow="Catálogos • body_types"
      title="Tipos de carroceria"
      description="Características de carrocerias e possibilidades de carregamento."
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'closed', label: 'Fechada' },
        { key: 'loading', label: 'Carregamento' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        closed: displayBoolean(item.isClosed),
        loading: [
          item.supportsSideLoading === true ? 'Lateral' : null,
          item.supportsRearLoading === true ? 'Traseiro' : null,
        ]
          .filter(Boolean)
          .join(' + ') || '—',
        status: displayStatus(item),
      })}
    />
  );
}
