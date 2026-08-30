import { ModulePage } from '../../_components/module-page';

export default function VeiculosPage() {
  return (
    <ModulePage
      eyebrow="Cadastros · Pessoas e ativos"
      title="Veículos e carrocerias"
      description="Cadastro técnico e operacional da frota própria e agregada, preparado para matching, manutenção e execução de viagens."
      status="Em construção"
      highlights={[
        { title: 'Dados do ativo', description: 'Placa, identificação, tipo, capacidade, carroceria, propriedade e status operacional.' },
        { title: 'Conformidade', description: 'Documentos, seguros, inspeções, vencimentos e impedimentos de utilização.' },
        { title: 'Disponibilidade', description: 'Situação, manutenção, localização e capacidades que alimentarão o motor de matching.' },
      ]}
    />
  );
}
