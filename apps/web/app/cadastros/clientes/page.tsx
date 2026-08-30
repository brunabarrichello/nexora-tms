import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Clientes e embarcadores' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Comercial"
      title="Clientes e embarcadores"
      description="Cadastro comercial dos contratantes, embarcadores, contatos, condições e pontos relacionados."
      actions={[{ href: '/cadastros/clientes/novo', label: 'Novo cliente' }]}
      metrics={[
        { label: 'Clientes ativos', helper: 'API de customers' },
        { label: 'Com dados completos', helper: 'Validação cadastral' },
        { label: 'Com operação recente', helper: 'Relacionamento com cargas' },
      ]}
      filters={[
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo', 'Bloqueado'] },
        { label: 'Tipo', name: 'type', options: ['Embarcador', 'Contratante', 'Destinatário'] },
        { label: 'UF', name: 'uf' },
      ]}
      columns={[
        { key: 'name', label: 'Cliente' },
        { key: 'document', label: 'Documento' },
        { key: 'type', label: 'Tipo' },
        { key: 'city', label: 'Cidade/UF' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={[
        'Condições comerciais e vínculos com freight lanes serão associados sem duplicar o cadastro mestre.',
      ]}
    />
  );
}
