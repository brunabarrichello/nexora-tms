import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Motoristas' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Motoristas e ativos"
      title="Motoristas"
      description="Base de motoristas com documentos, cursos, capabilities, disponibilidade e vínculos operacionais."
      actions={[{ href: '/cadastros/motoristas/novo', label: 'Novo motorista' }]}
      metrics={[
        { label: 'Disponíveis', helper: 'Disponibilidade operacional' },
        { label: 'Documentos regulares', helper: 'Validação documental' },
        { label: 'Aptos para matching', helper: 'Capabilities e bloqueios' },
      ]}
      filters={[
        {
          label: 'Disponibilidade',
          name: 'availability',
          options: ['Disponível', 'Em viagem', 'Indisponível'],
        },
        { label: 'Documentos', name: 'docs', options: ['Regulares', 'A vencer', 'Pendentes'] },
        { label: 'UF base', name: 'uf' },
      ]}
      columns={[
        { key: 'name', label: 'Motorista' },
        { key: 'phone', label: 'Contato' },
        { key: 'base', label: 'Base' },
        { key: 'capability', label: 'Capability' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={[
        'Cursos, documentos, disponibilidade e vínculos com veículos serão carregados como sub-recursos.',
      ]}
    />
  );
}
