import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Contratos de transporte' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Matching • Contracting"
      title="Contratos"
      description="Formalização operacional do aceite da negociação, preparada para programação de viagem e obrigações financeiras."
      filters={[
        { label: 'Estado', name: 'status', options: ['Ativo', 'Executado', 'Cancelado'] },
        { label: 'Carga', name: 'load' },
        { label: 'Contratado', name: 'contractor' },
      ]}
      columns={[
        { key: 'contract', label: 'Contrato' },
        { key: 'load', label: 'Carga' },
        { key: 'contractor', label: 'Contratado' },
        { key: 'amount', label: 'Valor', align: 'right' },
        { key: 'status', label: 'Estado' },
      ]}
      integrationNotes={['O contrato será consequência da negociação aceita e não permitirá reescrever o histórico de propostas.']}
    />
  );
}
