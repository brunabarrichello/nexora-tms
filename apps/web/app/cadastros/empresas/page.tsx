import { ModulePage } from '../../_components/module-page';

export default function EmpresasPage() {
  return (
    <ModulePage
      eyebrow="Cadastros · Organização"
      title="Empresas e unidades"
      description="Estrutura cadastral para empresas, filiais, unidades operacionais e vínculos organizacionais do tenant."
      status="Em construção"
      highlights={[
        { title: 'Identificação', description: 'Razão social, nome fantasia, documentos fiscais, contatos e situação cadastral.' },
        { title: 'Estrutura', description: 'Unidades, centros operacionais, departamentos e centros de custo vinculados.' },
        { title: 'Governança', description: 'Lifecycle, auditoria, soft delete e isolamento multi-tenant desde a origem.' },
      ]}
    />
  );
}
