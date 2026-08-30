import { HubPage } from '../_components/hub-page';
export const metadata = { title: 'Financeiro' };
export default function Page() { return <HubPage eyebrow="Financeiro" title="Financeiro" description="Estrutura preparada para custos, receitas, repasses, faturamento e conciliação por carga e viagem." items={[
  {href:'/financeiro/lancamentos',title:'Lançamentos',description:'Receitas, despesas e ajustes operacionais.',badge:'Core'},
  {href:'/financeiro/pagamentos',title:'Pagamentos',description:'Obrigações com motoristas, parceiros e fornecedores.'},
  {href:'/financeiro/recebimentos',title:'Recebimentos',description:'Contas a receber e baixa de clientes.'},
  {href:'/financeiro/faturamento',title:'Faturamento',description:'Preparação de faturamento por cliente, carga e período.'},
 ]} />; }
