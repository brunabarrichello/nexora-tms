import { ModulePage } from '../_components/module-page';

export default function FinanceiroPage() {
  return (
    <ModulePage
      eyebrow="Módulo 08"
      title="Financeiro"
      description="Área planejada para consolidação dos dados econômicos e operacionais do transporte."
      status="Planejado"
      highlights={[
        { title: 'Composição', description: 'Estrutura para componentes financeiros vinculados à operação.' },
        { title: 'Acompanhamento', description: 'Visão por carga, viagem, cliente e período.' },
        { title: 'Fechamento', description: 'Consolidação dos registros ao término da operação.' },
      ]}
    />
  );
}
