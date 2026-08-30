import { HubPage } from '../_components/hub-page';

export const metadata = { title: 'Cadastros' };

export default function CadastrosPage() {
  return <HubPage eyebrow="Cadastros mestres" title="Cadastros" description="Base operacional compartilhada por cargas, matching, negociação, viagens, documentos e financeiro." items={[
    { href: '/cadastros/empresas', title: 'Empresas e unidades', description: 'Tenants, unidades operacionais, dados fiscais e lifecycle.', badge: 'Fundação' },
    { href: '/cadastros/clientes', title: 'Clientes e embarcadores', description: 'Contratantes, contatos, endereços e preferências comerciais.' },
    { href: '/cadastros/fornecedores', title: 'Fornecedores', description: 'Prestadores, parceiros e fornecedores operacionais.' },
    { href: '/cadastros/transportadoras', title: 'Transportadoras', description: 'Transportadoras parceiras, RNTRC e capacidades.' },
    { href: '/cadastros/motoristas', title: 'Motoristas', description: 'Dados pessoais, documentos, cursos, capabilities e disponibilidade.', badge: 'Wave 0017' },
    { href: '/cadastros/veiculos', title: 'Veículos e ativos', description: 'Frota, tipos, carrocerias, capacidade, manutenção e disponibilidade.', badge: 'Wave 0017' },
    { href: '/cadastros/locais', title: 'Locais', description: 'Origens, destinos, armazéns, pontos de coleta e entrega.' },
    { href: '/cadastros/centros-custo', title: 'Centros de custo', description: 'Estrutura financeira e apropriação gerencial.' },
    { href: '/cadastros/departamentos', title: 'Departamentos', description: 'Estrutura organizacional e vínculos operacionais.' },
  ]} />;
}
