import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Regras de Matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Motor de decisão"
      title="Regras de Matching"
      description="Catálogo tenant-scoped das regras que classificam, pontuam ou bloqueiam candidatos, com categoria, versão, peso e configuração controlada."
      metrics={[
        { label: 'Regras ativas', helper: 'Participam das execuções' },
        { label: 'Bloqueadoras', helper: 'Geram rejeição impeditiva' },
        { label: 'Pontuação', helper: 'Regras com peso' },
        { label: 'Versões', helper: 'Evolução auditável' },
      ]}
      filters={[
        { label: 'Categoria', name: 'category', options: ['eligibility', 'capacity', 'equipment', 'compliance', 'availability', 'commercial', 'preference'] },
        { label: 'Tipo', name: 'blocking', options: [{ label: 'Bloqueadora', value: 'true' }, { label: 'Não bloqueadora', value: 'false' }] },
        { label: 'Estado', name: 'active', options: [{ label: 'Ativa', value: 'true' }, { label: 'Inativa', value: 'false' }] },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Regra' },
        { key: 'category', label: 'Categoria' },
        { key: 'version', label: 'Versão', align: 'right' },
        { key: 'weight', label: 'Peso', align: 'right' },
        { key: 'blocking', label: 'Bloqueadora' },
        { key: 'status', label: 'Status' },
      ]}
      actions={[{ href: '/matching/regras/nova', label: 'Nova regra' }]}
      tabs={[
        { href: '/matching', label: 'Visão geral' },
        { href: '/matching/regras', label: 'Regras' },
        { href: '/matching/preferencias', label: 'Preferências' },
        { href: '/matching/execucoes', label: 'Execuções' },
      ]}
      integrationNotes={[
        'As regras mutáveis são configuração; os resultados produzidos por uma execução permanecem imutáveis.',
        'Cada execução preservará snapshot das regras para permitir reprodução mesmo após alterações futuras.',
      ]}
    />
  );
}
