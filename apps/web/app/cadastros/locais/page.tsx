import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Locais' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Geografia"
      title="Locais"
      description="Pontos reutilizáveis de coleta, entrega, armazém, base, terminal e demais referências geográficas."
      metrics={[
        { label: 'Locais ativos', helper: 'API de locations' },
        { label: 'Geocodificados', helper: 'Latitude/longitude válidas' },
        { label: 'Com janela operacional', helper: 'Horários e restrições' },
      ]}
      filters={[
        {
          label: 'Tipo',
          name: 'type',
          options: ['Coleta', 'Entrega', 'Armazém', 'Base', 'Terminal', 'Outro'],
        },
        { label: 'UF', name: 'uf' },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
      ]}
      columns={[
        { key: 'name', label: 'Local' },
        { key: 'type', label: 'Tipo' },
        { key: 'city', label: 'Cidade/UF' },
        { key: 'window', label: 'Janela' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={[
        'Geocodificação e cálculo de distância serão adapters externos, não campos acoplados ao frontend.',
      ]}
    />
  );
}
