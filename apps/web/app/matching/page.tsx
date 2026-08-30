import { ModulePage } from '../_components/module-page';

export default function MatchingPage() {
  return (
    <ModulePage
      eyebrow="Módulo 03"
      title="Matching"
      description="Motor persistente e explicável para cruzar cargas com motoristas e ativos compatíveis, registrando critérios, score e motivos de exclusão."
      status="Planejado"
      highlights={[
        { title: 'Compatibilidade', description: 'Veículo, carroceria, capacidade, localização, disponibilidade e requisitos da carga.' },
        { title: 'Score explicável', description: 'Pontuação por critério e justificativas legíveis para cada candidato.' },
        { title: 'Persistência', description: 'Resultados versionados para rastreabilidade, auditoria e evolução do algoritmo.' },
      ]}
    />
  );
}
