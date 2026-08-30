import { ModulePage } from '../_components/module-page';

export default function ViagensPage() {
  return (
    <ModulePage
      eyebrow="Módulo 05"
      title="Viagens"
      description="Execução operacional da carga com motorista, veículo, rota, tracking, despesas, pedágios, combustível, ocorrências e comprovantes de entrega."
      status="Planejado"
      highlights={[
        { title: 'Despacho', description: 'Formação da viagem, alocação de recursos, documentos e instruções operacionais.' },
        { title: 'Execução', description: 'Eventos de coleta, trânsito, entrega, tracking e ocorrências ao longo da rota.' },
        { title: 'Fechamento', description: 'POD, despesas, pedágios, combustível e consolidação dos dados da operação.' },
      ]}
    />
  );
}
