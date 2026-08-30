import {
  ApiCollectionPage,
  collectionRoles,
  collectionText,
  hasCollectionRole,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Clientes e embarcadores' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/business-parties"
      basePath="/cadastros/clientes"
      eyebrow="Master Data • Business Parties"
      title="Clientes e embarcadores"
      description="Contratantes e embarcadores reais do tenant, reutilizando o aggregate root de business parties."
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
          label: 'Papel',
          name: 'role',
          options: [
            { label: 'Cliente', value: 'customer' },
            { label: 'Embarcador', value: 'shipper' },
            { label: 'Consignatário', value: 'consignee' },
          ],
        },
      ]}
      columns={[
        { key: 'legalName', label: 'Razão social' },
        { key: 'taxId', label: 'CPF/CNPJ' },
        { key: 'roles', label: 'Papéis' },
        { key: 'contact', label: 'Contato' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (!hasCollectionRole(item, ['customer', 'shipper', 'consignee'])) return false;
        if (values.status && item.status !== values.status) return false;
        if (values.role && !hasCollectionRole(item, [values.role])) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        legalName: collectionText(item.legalName),
        taxId: collectionText(item.taxId),
        roles: collectionRoles(item.roles),
        contact:
          [item.email, item.phone]
            .filter((value) => typeof value === 'string' && value)
            .join(' • ') || '—',
        status: collectionText(item.status),
      })}
      integrationNotes={[
        'Roles customer/shipper/consignee filtrados sobre o mesmo business party canônico.',
      ]}
    />
  );
}
