import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Recebimentos' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Financeiro • Contas a receber"
      title="Recebimentos"
      description="Valores a receber de clientes com vínculo à carga, faturamento e condição comercial."
      metrics={[
        { label: 'A receber', helper: 'Aberto no período' },
        { label: 'Vencidos', helper: 'Inadimplência operacional' },
        { label: 'Recebidos', helper: 'Baixas no período' },
      ]}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: ['Previsto', 'A vencer', 'Vencido', 'Recebido', 'Cancelado'],
        },
        { label: 'Cliente', name: 'customer' },
        { label: 'Período', name: 'period' },
      ]}
      columns={[
        { key: 'dueDate', label: 'Vencimento' },
        { key: 'customer', label: 'Cliente' },
        { key: 'reference', label: 'Referência' },
        { key: 'amount', label: 'Valor', align: 'right' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
