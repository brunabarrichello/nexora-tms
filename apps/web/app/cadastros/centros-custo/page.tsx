import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Centros de custo' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Financeiro"
      title="Centros de custo"
      description="Estrutura para classificação financeira de cargas, viagens, despesas, receitas e unidades."
      metrics={[
        { label: 'Ativos', helper: 'API de cost centers' },
        { label: 'Com responsável', helper: 'Governança interna' },
        { label: 'Em uso', helper: 'Lançamentos relacionados' },
      ]}
      filters={[
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
        { label: 'Unidade', name: 'unit' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Centro de custo' },
        { key: 'unit', label: 'Unidade' },
        { key: 'owner', label: 'Responsável' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
