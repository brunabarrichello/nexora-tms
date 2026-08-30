import { ModulePage } from '../../_components/module-page';

export default function MotoristasPage() {
  return (
    <ModulePage
      eyebrow="Cadastros · Pessoas e ativos"
      title="Motoristas"
      description="Base operacional para motoristas, documentos, cursos, capacidades, disponibilidade e elegibilidade para cargas."
      status="Em construção"
      highlights={[
        { title: 'Perfil operacional', description: 'Dados pessoais, contatos, vínculo, localização base e disponibilidade.' },
        { title: 'Conformidade', description: 'CNH, documentos, cursos, vencimentos, validações e bloqueios operacionais.' },
        { title: 'Capabilities', description: 'Tipos de veículo, carroceria, carga, rotas e requisitos que o motorista atende.' },
      ]}
    />
  );
}
