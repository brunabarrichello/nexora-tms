import { HubPage } from '../_components/hub-page';
export const metadata = { title: 'Administração' };
export default function Page() { return <HubPage eyebrow="Sistema" title="Administração" description="Governança da plataforma, preparada para identidade, autorização, tenant, auditoria e configurações." items={[
  {href:'/administracao/configuracoes',title:'Configurações',description:'Preferências operacionais, catálogos e parâmetros do tenant.'},
  {href:'/administracao/auditoria',title:'Auditoria',description:'Trilha transversal de eventos administrativos e operacionais.'},
  {href:'/cadastros/empresas',title:'Empresa e unidades',description:'Contexto organizacional e lifecycle do tenant.'},
  {href:'/documentos',title:'Compliance',description:'Regras e evidências documentais relacionadas ao ambiente.'},
 ]} />; }
