import {
  ApiCollectionPage,
  collectionBoolean,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Motoristas' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/capacity/drivers"
      basePath="/cadastros/motoristas"
      eyebrow="Capacity • Drivers"
      title="Motoristas"
      description="Motoristas tenant-scoped com situação cadastral, operacional e elegibilidade de matching."
      actions={[{ href: '/cadastros/motoristas/novo', label: 'Novo motorista' }]}
      filters={[
        {
          label: 'Cadastro',
          name: 'registration',
          options: ['pending', 'qualified', 'blocked', 'inactive'],
        },
        {
          label: 'Operacional',
          name: 'operational',
          options: ['active', 'blocked', 'inactive'],
        },
      ]}
      columns={[
        { key: 'name', label: 'Motorista' },
        { key: 'phone', label: 'Telefone' },
        { key: 'cnh', label: 'CNH' },
        { key: 'registration', label: 'Cadastro' },
        { key: 'operational', label: 'Operacional' },
        { key: 'matching', label: 'Matching' },
      ]}
      filterItem={(item, values) => {
        if (values.registration && item.registrationStatus !== values.registration) return false;
        if (values.operational && item.operationalStatus !== values.operational) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        name: collectionText(item.fullName),
        phone: collectionText(item.phone),
        cnh: `${collectionText(item.cnhNumber)} • ${collectionText(item.cnhCategory)} • vence ${collectionText(item.cnhExpiresOn)}`,
        registration: collectionText(item.registrationStatus),
        operational: collectionText(item.operationalStatus),
        matching: collectionBoolean(item.eligibleForMatching, 'Elegível', 'Não elegível'),
      })}
      integrationNotes={[
        'A Wave 0017 da PR #56 ampliará esta área com documentos, cursos, disponibilidade, bloqueios e ratings.',
      ]}
    />
  );
}
