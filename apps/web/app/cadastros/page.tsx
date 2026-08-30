import { HubPage } from '../_components/hub-page';

export const metadata = { title: 'Cadastros' };

export default function CadastrosPage() {
  return (
    <HubPage
      eyebrow="Cadastros mestres"
      title="Cadastros"
      description="Base operacional compartilhada por cargas, matching, negociação, viagens, documentos e financeiro."
      items={[
        {
          href: '/cadastros/catalogos',
          title: 'Catálogos mestres',
          description:
            'Tipos de veículo, carroceria, carga, embalagem, documento, tags, unidades e geografia.',
          badge: 'Wave 0015',
        },
        {
          href: '/cadastros/empresas',
          title: 'Empresas e unidades',
          description: 'Tenants, unidades operacionais, dados fiscais e lifecycle.',
          badge: 'Fundação',
        },
        {
          href: '/cadastros/clientes',
          title: 'Clientes e embarcadores',
          description: 'Contratantes, contatos, endereços e preferências comerciais.',
        },
        {
          href: '/cadastros/contatos',
          title: 'Contatos',
          description: 'Contatos reutilizáveis vinculados a clientes, parceiros e unidades.',
          badge: 'Master Data',
        },
        {
          href: '/cadastros/fornecedores',
          title: 'Fornecedores',
          description: 'Prestadores, parceiros e fornecedores operacionais.',
        },
        {
          href: '/cadastros/transportadoras',
          title: 'Transportadoras',
          description: 'Transportadoras parceiras, RNTRC e capacidades.',
        },
        {
          href: '/cadastros/motoristas',
          title: 'Motoristas',
          description: 'Dados pessoais, documentos, cursos, capabilities e disponibilidade.',
          badge: 'Wave 0017',
        },
        {
          href: '/cadastros/veiculos',
          title: 'Veículos e ativos',
          description: 'Frota, tipos, carrocerias, capacidade, manutenção e disponibilidade.',
          badge: 'Wave 0017',
        },
        {
          href: '/cadastros/equipamentos',
          title: 'Equipamentos',
          description: 'Equipamentos e acessórios que compõem a capacidade operacional.',
          badge: 'Capacity',
        },
        {
          href: '/cadastros/atribuicoes',
          title: 'Atribuições',
          description: 'Vínculos temporais entre motoristas, veículos, equipamentos e parceiros.',
          badge: 'Capacity',
        },
        {
          href: '/cadastros/locais',
          title: 'Locais',
          description: 'Origens, destinos, armazéns, pontos de coleta e entrega.',
          badge: 'Wave 0016',
        },
        {
          href: '/cadastros/grupos',
          title: 'Grupos',
          description: 'Agrupamentos operacionais e comerciais reutilizáveis.',
          badge: 'Wave 0016',
        },
        {
          href: '/cadastros/requisitos',
          title: 'Requisitos',
          description: 'Requisitos operacionais, documentais e de transporte.',
          badge: 'Wave 0016',
        },
        {
          href: '/cadastros/centros-custo',
          title: 'Centros de custo',
          description: 'Estrutura financeira e apropriação gerencial.',
        },
        {
          href: '/cadastros/departamentos',
          title: 'Departamentos',
          description: 'Estrutura organizacional e vínculos operacionais.',
        },
        {
          href: '/cadastros/campos-personalizados',
          title: 'Campos personalizados',
          description: 'Custom fields governados por entidade e tenant.',
          badge: 'Wave 0016',
        },
      ]}
    />
  );
}
