import {
  ApiCollectionPage,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Centros de custo' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/dimensions/cost-centers"
      basePath="/cadastros/centros-custo"
      eyebrow="Wave 0016 • Financial Dimensions"
      title="Centros de custo"
      description="Dimensão para apropriação gerencial e futura integração financeira por organização/unidade."
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
        { key: 'name', label: 'Centro de custo' },
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
