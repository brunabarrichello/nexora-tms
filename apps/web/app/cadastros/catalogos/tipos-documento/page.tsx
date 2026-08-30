import {
  displayBoolean,
  displayStatus,
  displayValue,
  ReferenceCatalogPage,
  type CatalogSearchParams,
} from '../_components/reference-catalog-page';

export const metadata = { title: 'Tipos de documento' };

export default function Page({ searchParams }: Readonly<{ searchParams: CatalogSearchParams }>) {
  return (
    <ReferenceCatalogPage
      searchParams={searchParams}
      slug="document-types"
      basePath="/cadastros/catalogos/tipos-documento"
      eyebrow="Catálogos • document_types"
      title="Tipos de documento"
      description="Catálogo de documentos por escopo, validade e necessidade de validação."
      filters={[
        {
          label: 'Escopo',
          name: 'subjectScope',
          options: ['party', 'driver', 'asset', 'request', 'trip', 'financial', 'other'],
        },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'scope', label: 'Escopo' },
        { key: 'controls', label: 'Controles' },
        { key: 'status', label: 'Status' },
      ]}
      mapRow={(item) => ({
        id: item.id,
        code: displayValue(item.code),
        name: item.name,
        scope: displayValue(item.subjectScope),
        controls: `Validade: ${displayBoolean(item.hasExpiry)} • Validação: ${displayBoolean(item.requiresValidation)}`,
        status: displayStatus(item),
      })}
    />
  );
}
