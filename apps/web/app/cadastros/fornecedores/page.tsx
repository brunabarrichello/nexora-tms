import {
  ApiCollectionPage,
  collectionRoles,
  collectionText,
  hasCollectionRole,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Fornecedores' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/business-parties"
      basePath="/cadastros/fornecedores"
      eyebrow="Master Data • Business Parties"
      title="Fornecedores"
      description="Fornecedores e parceiros operacionais derivados do aggregate root canônico de business parties."
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: [
            { label: 'Ativo', value: 'active' },
            { label: 'Inativo', value: 'inactive' },
          ],
        },
        {
          label: 'Homologação',
          name: 'homologation',
          options: ['pending', 'approved', 'rejected'],
        },
      ]}
      columns={[
        { key: 'legalName', label: 'Razão social' },
        { key: 'taxId', label: 'CPF/CNPJ' },
        { key: 'roles', label: 'Papéis' },
        { key: 'homologation', label: 'Homologação' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (!hasCollectionRole(item, ['supplier', 'partner'])) return false;
        if (values.status && item.status !== values.status) return false;
        if (values.homologation && item.homologationStatus !== values.homologation) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        legalName: collectionText(item.legalName),
        taxId: collectionText(item.taxId),
        roles: collectionRoles(item.roles),
        homologation: collectionText(item.homologationStatus),
        status: collectionText(item.status),
      })}
    />
  );
}
