import { ModulePage } from '../_components/module-page';

export default function OcorrenciasPage() {
  return (
    <ModulePage
      eyebrow="Módulo 07"
      title="Ocorrências"
      description="Acompanhamento de eventos operacionais vinculados às cargas e viagens, com status, responsáveis e histórico de tratamento."
      status="Planejado"
      highlights={[
        { title: 'Eventos', description: 'Registro estruturado de situações que exigem acompanhamento durante a operação.' },
        { title: 'Tratamento', description: 'Responsáveis, ações, prazos e atualização do andamento até a conclusão.' },
        { title: 'Histórico', description: 'Vínculos com carga, viagem, motorista, veículo e trilha de auditoria.' },
      ]}
    />
  );
}
