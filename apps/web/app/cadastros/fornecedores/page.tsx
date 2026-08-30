import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Fornecedores' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Suprimentos"
      title="Fornecedores"
      description="Prestadores e fornecedores de serviços vinculáveis a viagens, manutenção, despesas e documentos."
      metrics={[
        { label: 'Ativos', helper: 'API de suppliers' },
        { label: 'Categorias', helper: 'Catálogo de serviços' },
        { label: 'Com documentos válidos', helper: 'Módulo documental' },
      ]}
      filters={[
        {
          label: 'Categoria',
          name: 'category',
          options: ['Manutenção', 'Combustível', 'Pedágio', 'Serviços', 'Outros'],
        },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo', 'Bloqueado'] },
        { label: 'UF', name: 'uf' },
      ]}
      columns={[
        { key: 'name', label: 'Fornecedor' },
        { key: 'document', label: 'Documento' },
        { key: 'category', label: 'Categoria' },
        { key: 'city', label: 'Cidade/UF' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
