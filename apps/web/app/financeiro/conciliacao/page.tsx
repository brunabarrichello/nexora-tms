import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Conciliação financeira' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Finance • Settlements"
      title="Conciliação"
      description="Conciliação e liquidação de obrigações e recebíveis com rastreabilidade até carga, viagem e lançamento."
      metrics={[
        { label: 'Pendentes', helper: 'Itens aguardando conciliação' },
        { label: 'Divergentes', helper: 'Valor ou referência incompatível' },
        { label: 'Conciliados', helper: 'Período selecionado' },
      ]}
      filters={[
        { label: 'Estado', name: 'status', options: ['Pendente', 'Conciliado', 'Divergente', 'Revisão'] },
        { label: 'Natureza', name: 'nature', options: ['Pagamento', 'Recebimento', 'Ajuste'] },
        { label: 'Período', name: 'period' },
      ]}
      columns={[
        { key: 'date', label: 'Data' },
        { key: 'reference', label: 'Referência' },
        { key: 'counterparty', label: 'Contraparte' },
        { key: 'amount', label: 'Valor', align: 'right' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
