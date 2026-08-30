import { ModulePage } from '../_components/module-page';

export default function CargasPage() {
  return (
    <ModulePage
      eyebrow="Módulo 02"
      title="Cargas"
      description="Gestão da demanda de transporte com itens, volumes, requisitos, referências, histórico de status, eventos e corredores de frete."
      status="Próximo"
      highlights={[
        { title: 'Ordem de carga', description: 'Origem, destino, cliente, janela operacional, valores e informações comerciais.' },
        { title: 'Itens e volumes', description: 'Peso, cubagem, dimensões, espécie, embalagem e restrições de manuseio.' },
        { title: 'Requisitos', description: 'Veículo, carroceria, rastreamento, documentos e capacidades necessárias.' },
      ]}
    />
  );
}
