import { ModulePage } from '../../_components/module-page';

export default function ClientesPage() {
  return (
    <ModulePage
      eyebrow="Cadastros · Comercial"
      title="Clientes e embarcadores"
      description="Cadastro de clientes, embarcadores, pagadores, grupos econômicos e requisitos operacionais associados."
      status="Em construção"
      highlights={[
        { title: 'Perfil comercial', description: 'Dados fiscais, contatos, condições operacionais e relacionamento comercial.' },
        { title: 'Requisitos', description: 'Restrições, documentos, regras de atendimento e preferências por operação.' },
        { title: 'Rede', description: 'Vínculos com locais de coleta, entrega, unidades e pontos recorrentes.' },
      ]}
    />
  );
}
