import {
  ApiCollectionPage,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Departamentos' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/dimensions/departments"
      basePath="/cadastros/departamentos"
      eyebrow="Wave 0016 • Organizational Dimensions"
      title="Departamentos"
      description="Dimensão organizacional tenant-scoped vinculada à organização e, opcionalmente, à unidade de negócio."
      filters={[
        {
          label: 'Status',
          name: 'active',
          options: [
            { label: 'Ativo', value: 'true' },
            { label: 'Inativo', value: 'false' },
          ],
        },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Departamento' },
        { key: 'organization', label: 'Organização' },
        { key: 'businessUnit', label: 'Unidade' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => !values.active || String(item.isActive) === values.active}
      mapRow={(item) => ({
        id: item.id,
        code: collectionText(item.code),
        name: collectionText(item.name),
        organization: collectionText(item.organizationId),
        businessUnit: collectionText(item.businessUnitId),
        status: item.isActive === true ? 'Ativo' : 'Inativo',
      })}
    />
  );
}
