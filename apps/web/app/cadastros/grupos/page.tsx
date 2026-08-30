import {
  ApiCollectionPage,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Grupos' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/business-party-groups"
      basePath="/cadastros/grupos"
      eyebrow="Wave 0016 • Business Party Groups"
      title="Grupos de parceiros"
      description="Agrupamentos econômicos, comerciais, operacionais e de risco para business parties."
      filters={[
        {
          label: 'Tipo',
          name: 'type',
          options: ['economic', 'commercial', 'operational', 'risk', 'other'],
        },
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
        { key: 'name', label: 'Grupo' },
        { key: 'type', label: 'Tipo' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (values.type && item.groupType !== values.type) return false;
        if (values.active && String(item.isActive) !== values.active) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        code: collectionText(item.code),
        name: collectionText(item.name),
        type: collectionText(item.groupType),
        status: item.isActive === true ? 'Ativo' : 'Inativo',
      })}
    />
  );
}
