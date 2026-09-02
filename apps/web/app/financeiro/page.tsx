import { HubPage } from '../_components/hub-page';
export const metadata = { title: 'Financeiro' };
export default function Page() {
  return (
    <HubPage
      eyebrow="Financeiro"
      title="Financeiro"
      description="Custos, margens, pagamentos, faturamento e conciliação por carga e viagem."
      items={[
        {
          href: '/financeiro/margens',
          title: 'Margens',
          description: 'Receita, custos e rentabilidade antes e depois da contratação.',
          badge: 'NEX-50',
        },
        {
          href: '/financeiro/lancamentos',
          title: 'Lançamentos',
          description: 'Receitas, despesas e ajustes operacionais.',
          badge: 'Core',
        },
        {
          href: '/financeiro/pagamentos',
          title: 'Pagamentos',
          description: 'Obrigações com motoristas, parceiros e fornecedores.',
        },
        {
          href: '/financeiro/recebimentos',
          title: 'Recebimentos',
          description: 'Contas a receber e baixa de clientes.',
        },
        {
          href: '/financeiro/faturamento',
          title: 'Faturamento',
          description: 'Preparação de faturamento por cliente, carga e período.',
        },
        {
          href: '/financeiro/conciliacao',
          title: 'Conciliação',
          description: 'Liquidação e conciliação de obrigações, recebíveis e ajustes.',
          badge: 'Settlements',
        },
      ]}
    />
  );
}
