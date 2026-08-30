import {
  ApiCollectionPage,
  collectionText,
  hasCollectionRole,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Transportadoras' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/business-parties"
      basePath="/cadastros/transportadoras"
      eyebrow="Master Data • Carriers"
      title="Transportadoras"
      description="Transportadoras parceiras usando o papel carrier do aggregate root de business parties."
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
        { key: 'legalName', label: 'Transportadora' },
        { key: 'taxId', label: 'CPF/CNPJ' },
        { key: 'contact', label: 'Contato' },
        { key: 'homologation', label: 'Homologação' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (!hasCollectionRole(item, ['carrier'])) return false;
        if (values.status && item.status !== values.status) return false;
        if (values.homologation && item.homologationStatus !== values.homologation) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        legalName: collectionText(item.legalName),
        taxId: collectionText(item.taxId),
        contact:
          [item.email, item.phone]
            .filter((value) => typeof value === 'string' && value)
            .join(' • ') || '—',
        homologation: collectionText(item.homologationStatus),
        status: collectionText(item.status),
      })}
    />
  );
}
