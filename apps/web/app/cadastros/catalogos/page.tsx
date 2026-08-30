import { HubPage } from '../../_components/hub-page';
export const metadata = { title: 'Catálogos mestres' };
export default function Page() {
  return (
    <HubPage
      eyebrow="Cadastros • Wave 0015"
      title="Catálogos mestres"
      description="Catálogos fundacionais implementados no PostgreSQL e preparados para consumo transversal pelo TMS."
      items={[
        {
          href: '/cadastros/catalogos/tipos-veiculo',
          title: 'Tipos de veículo',
          description: 'Categorias de veículo e peso máximo padrão.',
          badge: 'vehicle_types',
        },
        {
          href: '/cadastros/catalogos/tipos-carroceria',
          title: 'Tipos de carroceria',
          description: 'Carrocerias, fechamento e formas de carregamento.',
          badge: 'body_types',
        },
        {
          href: '/cadastros/catalogos/tipos-carga',
          title: 'Tipos de carga',
          description: 'Classificação e necessidade de manuseio especial.',
          badge: 'cargo_types',
        },
        {
          href: '/cadastros/catalogos/tipos-embalagem',
          title: 'Tipos de embalagem',
          description: 'Espécies de volume e padrão de empilhamento.',
          badge: 'package_types',
        },
        {
          href: '/cadastros/catalogos/tipos-documento',
          title: 'Tipos de documento',
          description: 'Escopo, validade e necessidade de validação.',
          badge: 'document_types',
        },
        {
          href: '/cadastros/catalogos/tags',
          title: 'Tags',
          description: 'Etiquetas tenant-scoped para organização transversal.',
          badge: 'tags',
        },
        {
          href: '/cadastros/catalogos/unidades-medida',
          title: 'Unidades de medida',
          description: 'Massa, volume, comprimento, contagem, tempo e outras.',
          badge: 'units_of_measure',
        },
        {
          href: '/cadastros/catalogos/paises',
          title: 'Países',
          description: 'Catálogo geográfico global ISO.',
          badge: 'countries',
        },
        {
          href: '/cadastros/catalogos/estados',
          title: 'Estados',
          description: 'Estados/províncias vinculados a país.',
          badge: 'states',
        },
        {
          href: '/cadastros/catalogos/cidades',
          title: 'Cidades',
          description: 'Municípios, código IBGE e coordenadas.',
          badge: 'cities',
        },
      ]}
    />
  );
}
