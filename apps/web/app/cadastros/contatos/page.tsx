import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Contatos' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Master Data"
      title="Contatos"
      description="Contatos reutilizáveis vinculados a clientes, parceiros, unidades e pontos operacionais."
      filters={[
        {
          label: 'Tipo',
          name: 'type',
          options: ['Comercial', 'Operacional', 'Financeiro', 'Fiscal', 'Outro'],
        },
        { label: 'Entidade', name: 'entity' },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
      ]}
      columns={[
        { key: 'name', label: 'Contato' },
        { key: 'entity', label: 'Vinculado a' },
        { key: 'email', label: 'E-mail' },
        { key: 'phone', label: 'Telefone' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={[
        'Contatos permanecem entidades de Master Data e não serão duplicados por módulo consumidor.',
      ]}
    />
  );
}
