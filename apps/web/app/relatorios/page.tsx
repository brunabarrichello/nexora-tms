import { HubPage } from '../_components/hub-page';
export const metadata = { title: 'Relatórios' };
export default function Page() { return <HubPage eyebrow="Inteligência gerencial" title="Relatórios e dashboards" description="Camada de análise preparada para indicadores operacionais, comerciais, financeiros e de qualidade." items={[
  {href:'/cargas',title:'Operação de cargas',description:'Volume, status, corredores, clientes e lead times.'},
  {href:'/matching',title:'Eficiência de matching',description:'Cobertura, scores, blockers e taxa de conversão.'},
  {href:'/viagens',title:'Execução de viagens',description:'Pontualidade, ocorrências, tracking e produtividade.'},
  {href:'/financeiro',title:'Resultado financeiro',description:'Receitas, custos, margens e centros de custo.'},
  {href:'/documentos',title:'Compliance documental',description:'Validade, pendências, bloqueios e SLA de validação.'},
  {href:'/ocorrencias',title:'Qualidade operacional',description:'Incidentes, severidade, causa e tempo de resolução.'},
 ]} />; }
