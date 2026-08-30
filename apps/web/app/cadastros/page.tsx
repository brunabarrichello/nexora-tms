import Link from 'next/link';

const groups = [
  {
    title: 'Organização',
    description: 'Estrutura empresarial e entidades que sustentam o contexto operacional.',
    links: [
      { href: '/cadastros/empresas', label: 'Empresas e unidades' },
      { href: '/cadastros/clientes', label: 'Clientes e embarcadores' },
    ],
  },
  {
    title: 'Pessoas e ativos',
    description: 'Recursos operacionais usados no planejamento e execução das viagens.',
    links: [
      { href: '/cadastros/motoristas', label: 'Motoristas' },
      { href: '/cadastros/veiculos', label: 'Veículos e carrocerias' },
    ],
  },
  {
    title: 'Rede logística',
    description: 'Locais, pontos operacionais e referências geográficas da operação.',
    links: [{ href: '/cadastros/locais', label: 'Locais e pontos operacionais' }],
  },
  {
    title: 'Catálogos mestres',
    description: 'Tipos, unidades, documentos, requisitos e classificações reutilizáveis.',
    links: [
      { href: '/cadastros', label: 'Tipos de veículo · em evolução' },
      { href: '/cadastros', label: 'Tipos de carga · em evolução' },
      { href: '/cadastros', label: 'Unidades de medida · em evolução' },
    ],
  },
];

export default function CadastrosPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Módulo 01</span>
          <div className="title-row">
            <h1>Cadastros</h1>
            <span className="status-badge">Em construção</span>
          </div>
          <p>
            Fonte mestre para empresas, clientes, pessoas, ativos, geografia e catálogos.
            Esta camada prepara os dados que serão consumidos por Cargas, Matching,
            Negociação e Viagens.
          </p>
        </div>
      </section>

      <section className="catalog-grid">
        {groups.map((group) => (
          <article className="catalog-group" key={group.title}>
            <span className="eyebrow">Cadastro</span>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            <div className="catalog-links">
              {group.links.map((link) => (
                <Link className="catalog-link" href={link.href} key={`${group.title}-${link.label}`}>
                  <span>{link.label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
