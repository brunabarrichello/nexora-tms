import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Lançamentos financeiros' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Financeiro • Core"
      title="Lançamentos"
      description="Ledger operacional para receitas, despesas e ajustes relacionados a cargas, viagens e centros de custo."
      metrics={[
        { label: 'Receitas', helper: 'Período selecionado' },
        { label: 'Despesas', helper: 'Período selecionado' },
        { label: 'Saldo', helper: 'Receitas - despesas' },
        { label: 'Sem classificação', helper: 'Pendências de centro de custo' },
      ]}
      filters={[
        { label: 'Natureza', name: 'nature', options: ['Receita', 'Despesa', 'Ajuste'] },
        {
          label: 'Status',
          name: 'status',
          options: ['Previsto', 'Pendente', 'Liquidado', 'Cancelado'],
        },
        { label: 'Centro de custo', name: 'costCenter' },
      ]}
      columns={[
        { key: 'date', label: 'Data' },
        { key: 'description', label: 'Descrição' },
        { key: 'relatedTo', label: 'Referência' },
        { key: 'amount', label: 'Valor', align: 'right' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
